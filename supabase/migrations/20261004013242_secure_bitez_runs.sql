-- Upgrade existing KampongDrop tables without discarding user data.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter table public.profiles alter column phone_number drop not null;
alter table public.profiles alter column latitude drop not null;
alter table public.profiles alter column longitude drop not null;
alter table public.order_hubs add column if not exists host_name text;
alter table public.order_hubs add column if not exists pickup_latitude numeric(10,7);
alter table public.order_hubs add column if not exists pickup_longitude numeric(10,7);
alter table public.order_hubs add column if not exists pickup_postal_code text;
alter table public.order_hubs add column if not exists max_participants integer not null default 10;
alter table public.order_hubs add column if not exists participant_count integer not null default 1;
alter table public.sub_orders add column if not exists participant_name text;
update public.order_hubs h set host_name=p.full_name, pickup_latitude=p.latitude, pickup_longitude=p.longitude, pickup_postal_code=p.postal_code from public.profiles p where p.id=h.host_id and h.host_name is null;
update public.sub_orders o set participant_name=p.full_name from public.profiles p where p.id=o.user_id and o.participant_name is null;
alter table public.order_hubs add constraint bitez_hub_limits check (base_delivery_fee between 0 and 200 and max_participants between 2 and 50 and participant_count between 1 and 50);
alter table public.order_hubs add constraint bitez_pickup_bounds check (pickup_latitude between 1.15 and 1.50 and pickup_longitude between 103.6 and 104.1);
alter table public.profiles add constraint bitez_profile_name check (length(trim(full_name)) between 2 and 80);
alter table public.profiles add constraint bitez_postal check (postal_code ~ '^[0-9]{6}$');
create unique index if not exists bitez_one_order_per_run on public.sub_orders(hub_id,user_id);
create index if not exists bitez_host_idx on public.order_hubs(host_id);
create index if not exists bitez_orders_user_idx on public.sub_orders(user_id);
create index if not exists bitez_hub_merchant_idx on public.order_hubs(merchant_id);
create index if not exists bitez_menu_merchant_idx on public.menu_items(merchant_id);
create index if not exists bitez_pickup_idx on public.order_hubs(pickup_latitude,pickup_longitude) where status='OPEN';
drop trigger if exists trigger_sync_split_fee on public.sub_orders;
drop function if exists public.recalculate_delivery_split();
-- Remove legacy broad policies, including the live database's public profile policy.
do $$declare r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','order_hubs','sub_orders','merchants','menu_items') loop
 execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop;
end$$;
revoke all on public.profiles,public.order_hubs,public.sub_orders,public.merchants,public.menu_items from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.order_hubs,public.sub_orders to authenticated;
grant select on public.merchants,public.menu_items to anon,authenticated;
create policy bitez_profile_read on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy bitez_profile_insert on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy bitez_profile_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy bitez_hubs_read on public.order_hubs for select to authenticated using (true);
create policy bitez_orders_read on public.sub_orders for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.order_hubs h where h.id=hub_id and h.host_id=(select auth.uid())));
create policy bitez_merchants_read on public.merchants for select to anon,authenticated using (is_active);
create policy bitez_menu_read on public.menu_items for select to anon,authenticated using (is_available);
-- Privileged operations live in a non-exposed schema. Public wrappers are invokers.
create or replace function private.require_member() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null or not exists(select 1 from auth.users where id=u and deleted_at is null and email_confirmed_at is not null) then raise exception 'Sign in with a verified email first.'; end if;
 return u;
end$$;
create or replace function private.sync_split(p_hub uuid) returns void language sql security definer set search_path='' as $$
 update public.order_hubs h set participant_count=x.n, current_split_fee=round(h.base_delivery_fee/x.n,2)
 from (select 1+count(*)::int n from public.sub_orders where hub_id=p_hub and order_status in ('RESERVED','COLLECTED')) x where h.id=p_hub;
$$;
revoke all on function private.require_member(),private.sync_split(uuid) from public,anon,authenticated;
create or replace function private.create_run(p_restaurant text,p_pickup text,p_postal text,p_lat numeric,p_lng numeric,p_cutoff timestamptz,p_fee numeric,p_capacity integer) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); p public.profiles; m uuid; h uuid; begin
 select * into p from public.profiles where id=u;
 if p.id is null then raise exception 'Save your profile first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.order_hubs where host_id=u and status in ('OPEN','LOCKED'))>=3 then raise exception 'Finish or cancel an existing run first (maximum 3 active runs).'; end if;
 if p_restaurant is null or length(trim(p_restaurant)) not between 2 and 100 or p_pickup is null or length(trim(p_pickup)) not between 5 and 300 or p_postal is null or p_postal !~ '^[0-9]{6}$' or p_lat is null or p_lng is null or p_lat not between 1.15 and 1.50 or p_lng not between 103.6 and 104.1 or p_cutoff is null or p_cutoff<now()+interval '5 minutes' or p_cutoff>now()+interval '48 hours' or p_fee is null or p_fee not between 0 and 200 or p_fee<>round(p_fee,2) or p_capacity is null or p_capacity not between 2 and 50 then raise exception 'Check the restaurant, pickup, Singapore location, fee, capacity and cutoff (5 minutes to 48 hours).'; end if;
 insert into public.merchants(name,address,latitude,longitude,is_active,description) values(trim(p_restaurant),p_postal,p_lat,p_lng,true,'Neighbour-organised order. Restaurant is not a Bitez partner.') returning id into m;
 insert into public.order_hubs(host_id,merchant_id,cutoff_time,void_deck_notes,base_delivery_fee,current_split_fee,host_name,pickup_latitude,pickup_longitude,pickup_postal_code,max_participants)
 values(u,m,p_cutoff,trim(p_pickup),p_fee,p_fee,p.full_name,p_lat,p_lng,p_postal,p_capacity) returning id into h;
 return h;
end$$;
create or replace function public.create_run(p_restaurant text,p_pickup text,p_postal text,p_lat numeric,p_lng numeric,p_cutoff timestamptz,p_fee numeric,p_capacity integer) returns uuid language sql security invoker set search_path='' as $$ select private.create_run(p_restaurant,p_pickup,p_postal,p_lat,p_lng,p_cutoff,p_fee,p_capacity); $$;
create or replace function private.reserve_order(p_hub uuid,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; p public.profiles; item jsonb; total numeric:=0; result uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into p from public.profiles where id=u;
 if p.id is null then raise exception 'Save your profile first.'; end if;
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.status<>'OPEN' or h.cutoff_time<=now() then raise exception 'This run is closed for reservations.'; end if;
 if h.host_id=u then raise exception 'The host already counts in the delivery split.'; end if;
 if exists(select 1 from public.sub_orders where hub_id=p_hub and user_id=u and order_status<>'CANCELLED') then raise exception 'You already joined this run.'; end if;
 if h.participant_count>=h.max_participants then raise exception 'This run is full.'; end if;
 if (select count(*) from public.sub_orders o join public.order_hubs x on x.id=o.hub_id where o.user_id=u and o.order_status='RESERVED' and x.status in ('OPEN','LOCKED'))>=10 then raise exception 'Maximum 10 active reservations.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Add at least one valid item.'; end if;
 if jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Add 1 to 20 items.'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not (item ?& array['name','qty','price']) or jsonb_typeof(item->'name')<>'string' or length(trim(item->>'name')) not between 1 and 100 or jsonb_typeof(item->'qty')<>'number' or jsonb_typeof(item->'price')<>'number' then raise exception 'Invalid item.'; end if;
  if (item->>'qty')::numeric not between 1 and 20 or (item->>'qty')::numeric<>trunc((item->>'qty')::numeric) or (item->>'price')::numeric not between 0 and 200 or (item->>'price')::numeric<>round((item->>'price')::numeric,2) then raise exception 'Invalid quantity or price.'; end if;
  total:=total+(item->>'qty')::numeric*(item->>'price')::numeric;
 end loop;
 if total>9999 then raise exception 'Order total is too large.'; end if;
 insert into public.sub_orders(hub_id,user_id,cart_items,items_total_price,participant_name) values(p_hub,u,p_items,total,p.full_name)
 on conflict(hub_id,user_id) do update set cart_items=excluded.cart_items,items_total_price=excluded.items_total_price,participant_name=excluded.participant_name,order_status='RESERVED',created_at=now() returning id into result;
 perform private.sync_split(p_hub); return result;
end$$;
create or replace function public.reserve_order(p_hub uuid,p_items jsonb) returns uuid language sql security invoker set search_path='' as $$select private.reserve_order(p_hub,p_items);$$;
create or replace function private.cancel_order(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); o public.sub_orders; h public.order_hubs; begin
 select * into o from public.sub_orders where id=p_order and user_id=u;
 if o.id is null then raise exception 'Reservation not found.'; end if;
 select * into h from public.order_hubs where id=o.hub_id for update;
 if h.status<>'OPEN' or h.cutoff_time<=now() then raise exception 'The cutoff has passed. Contact the host at pickup; cancellation is closed.'; end if;
 update public.sub_orders set order_status='CANCELLED' where id=p_order and user_id=u;
 perform private.sync_split(o.hub_id);
end$$;
create or replace function public.cancel_order(p_order uuid) returns void language sql security invoker set search_path='' as $$select private.cancel_order(p_order);$$;
create or replace function private.set_run_status(p_hub uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; begin
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.host_id<>u then raise exception 'Only the host can manage this run.'; end if;
 if not ((h.status='OPEN' and p_status in ('LOCKED','CANCELLED')) or (h.status='LOCKED' and p_status in ('ARRIVED','CANCELLED'))) then raise exception 'Invalid run status transition.'; end if;
 update public.order_hubs set status=p_status where id=p_hub;
 if p_status='CANCELLED' then update public.sub_orders set order_status='CANCELLED' where hub_id=p_hub; perform private.sync_split(p_hub); end if;
end$$;
create or replace function public.set_run_status(p_hub uuid,p_status text) returns void language sql security invoker set search_path='' as $$select private.set_run_status(p_hub,p_status);$$;
create or replace function private.collect_order(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); o public.sub_orders; h public.order_hubs; begin
 select * into o from public.sub_orders where id=p_order;
 select * into h from public.order_hubs where id=o.hub_id for update;
 if h.id is null or h.status<>'ARRIVED' or h.host_id<>u or o.order_status<>'RESERVED' then raise exception 'Only the host can mark an arrived order collected.'; end if;
 update public.sub_orders set order_status='COLLECTED' where id=p_order;
end$$;
create or replace function public.collect_order(p_order uuid) returns void language sql security invoker set search_path='' as $$select private.collect_order(p_order);$$;
create table public.safety_reports(id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade, hub_id uuid references public.order_hubs(id) on delete set null, reason text not null check(length(trim(reason)) between 10 and 1000), created_at timestamptz not null default now());
alter table public.safety_reports enable row level security;
revoke all on public.safety_reports from anon,authenticated;
grant select,insert on public.safety_reports to authenticated;
create policy bitez_report_insert on public.safety_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy bitez_report_read on public.safety_reports for select to authenticated using(reporter_id=(select auth.uid()));
create index bitez_reports_reporter_idx on public.safety_reports(reporter_id);
create index bitez_reports_hub_idx on public.safety_reports(hub_id);
-- Delete only the caller's account; reject outstanding runs/orders to avoid stranding neighbours.
create or replace function private.delete_my_account() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if exists(select 1 from public.order_hubs where host_id=u and (status in ('OPEN','LOCKED') or exists(select 1 from public.sub_orders o where o.hub_id=public.order_hubs.id and o.order_status='RESERVED'))) or exists(select 1 from public.sub_orders o join public.order_hubs h on h.id=o.hub_id where o.user_id=u and o.order_status='RESERVED' and h.status<>'CANCELLED') then raise exception 'Finish or cancel your active runs and reservations before deleting your account.'; end if;
 delete from auth.sessions where user_id=u;
 delete from public.sub_orders where hub_id in(select id from public.order_hubs where host_id=u) or user_id=u;
 delete from public.order_hubs where host_id=u;
 delete from public.profiles where id=u;
 delete from auth.users where id=u;
end$$;
create or replace function public.delete_my_account() returns void language sql security invoker set search_path='' as $$select private.delete_my_account();$$;
-- Explicit execution grants on both wrapper and implementation; no anonymous writes.
do $$declare r record; begin
 for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('create_run','reserve_order','cancel_order','set_run_status','collect_order','delete_my_account') loop
 execute format('revoke all on function %I.%I(%s) from public,anon',r.nspname,r.proname,r.args);
 execute format('grant execute on function %I.%I(%s) to authenticated',r.nspname,r.proname,r.args);
 end loop;
end$$;
create or replace function private.discover_runs(p_lat double precision,p_lng double precision,p_radius integer,p_search text,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); result jsonb; begin
 if p_lat is null or p_lng is null or p_lat not between 1.15 and 1.50 or p_lng not between 103.6 and 104.1 or p_radius is null or p_radius not between 100 and 20000 or p_offset is null or p_offset not between 0 and 10000 or length(coalesce(p_search,''))>100 then raise exception 'Invalid search location or filter.'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
 select h.*,jsonb_build_object('name',m.name,'description',m.description) merchant,
 6371000*2*asin(sqrt(least(1.0,power(sin(radians(h.pickup_latitude-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(h.pickup_latitude))*power(sin(radians(h.pickup_longitude-p_lng)/2),2)))) distance
 from public.order_hubs h join public.merchants m on m.id=h.merchant_id
 where h.status='OPEN' and h.cutoff_time>now() and h.participant_count<h.max_participants
 and h.pickup_latitude between p_lat-p_radius/110000.0 and p_lat+p_radius/110000.0
 and h.pickup_longitude between p_lng-p_radius/110000.0 and p_lng+p_radius/110000.0
 and (coalesce(p_search,'')='' or strpos(lower(m.name||' '||h.void_deck_notes||' '||coalesce(h.pickup_postal_code,'')||' '||coalesce(h.host_name,'')),lower(p_search))>0)
 and 6371000*2*asin(sqrt(least(1.0,power(sin(radians(h.pickup_latitude-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(h.pickup_latitude))*power(sin(radians(h.pickup_longitude-p_lng)/2),2))))<=p_radius
 order by distance,h.cutoff_time,h.id limit 21 offset p_offset
 )r; return result;
end$$;
create or replace function public.discover_runs(p_lat double precision,p_lng double precision,p_radius integer,p_search text,p_offset integer) returns jsonb language sql security invoker set search_path='' as $$select private.discover_runs(p_lat,p_lng,p_radius,p_search,p_offset);$$;
revoke all on function public.discover_runs(double precision,double precision,integer,text,integer),private.discover_runs(double precision,double precision,integer,text,integer) from public,anon;
grant execute on function public.discover_runs(double precision,double precision,integer,text,integer),private.discover_runs(double precision,double precision,integer,text,integer) to authenticated;
