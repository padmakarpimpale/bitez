-- Keep extension helpers and platform event triggers off the public RPC surface.
alter extension cube set schema extensions;
alter extension earthdistance set schema extensions;
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
create table public.user_blocks(user_id uuid not null references auth.users(id) on delete cascade,blocked_user_id uuid not null references auth.users(id) on delete cascade,blocked_name text not null default 'Neighbour' check(length(blocked_name)<=80),created_at timestamptz not null default now(),primary key(user_id,blocked_user_id),check(user_id<>blocked_user_id));
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon,authenticated;
grant select,insert,delete on public.user_blocks to authenticated;
create policy bitez_blocks_read on public.user_blocks for select to authenticated using(user_id=(select auth.uid()));
create policy bitez_blocks_insert on public.user_blocks for insert to authenticated with check(user_id=(select auth.uid()));
create policy bitez_blocks_delete on public.user_blocks for delete to authenticated using(user_id=(select auth.uid()));
create index bitez_blocks_target_idx on public.user_blocks(blocked_user_id);
-- Reports enter through a bounded RPC rather than an unrestricted insert API.
revoke insert on public.safety_reports from authenticated;
create or replace function private.report_run(p_hub uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member();begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 or not exists(select 1 from public.order_hubs where id=p_hub) then raise exception 'Enter a valid report for an existing run.';end if;
 if(select count(*) from public.safety_reports where reporter_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'Report limit reached. Contact the operator by email for further concerns.';end if;
 insert into public.safety_reports(reporter_id,hub_id,reason)values(u,p_hub,trim(p_reason));
end$$;
create or replace function public.report_run(p_hub uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.report_run(p_hub,p_reason);$$;
revoke all on function private.report_run(uuid,text),public.report_run(uuid,text) from public,anon;
grant execute on function private.report_run(uuid,text),public.report_run(uuid,text) to authenticated;

create or replace function private.create_run(p_restaurant text,p_pickup text,p_postal text,p_lat numeric,p_lng numeric,p_cutoff timestamptz,p_fee numeric,p_capacity integer) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); p public.profiles; m uuid; h uuid; begin
 select * into p from public.profiles where id=u;
 if p.id is null then raise exception 'Save your profile first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.order_hubs where host_id=u and created_at>now()-interval '1 hour')>=10 then raise exception 'Maximum 10 new runs per hour.'; end if;
 if (select count(*) from public.order_hubs where host_id=u and status in ('OPEN','LOCKED'))>=3 then raise exception 'Finish or cancel an existing run first (maximum 3 active runs).'; end if;
 if p_restaurant is null or length(trim(p_restaurant)) not between 2 and 100 or p_pickup is null or length(trim(p_pickup)) not between 5 and 300 or p_postal is null or p_postal !~ '^[0-9]{6}$' or p_lat is null or p_lng is null or p_lat not between 1.15 and 1.50 or p_lng not between 103.6 and 104.1 or p_cutoff is null or p_cutoff<now()+interval '5 minutes' or p_cutoff>now()+interval '48 hours' or p_fee is null or p_fee not between 0 and 200 or p_fee<>round(p_fee,2) or p_capacity is null or p_capacity not between 2 and 50 then raise exception 'Check the restaurant, pickup, Singapore location, fee, capacity and cutoff (5 minutes to 48 hours).'; end if;
 insert into public.merchants(name,address,latitude,longitude,is_active,description) values(trim(p_restaurant),p_postal,p_lat,p_lng,true,'Neighbour-organised order. Restaurant is not a Bitez partner.') returning id into m;
 insert into public.order_hubs(host_id,merchant_id,cutoff_time,void_deck_notes,base_delivery_fee,current_split_fee,host_name,pickup_latitude,pickup_longitude,pickup_postal_code,max_participants)
 values(u,m,p_cutoff,trim(p_pickup),p_fee,p_fee,p.full_name,p_lat,p_lng,p_postal,p_capacity) returning id into h;
 return h;
end$$;

create or replace function private.reserve_order(p_hub uuid,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; p public.profiles; item jsonb; total numeric:=0; result uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into p from public.profiles where id=u;
 if p.id is null then raise exception 'Save your profile first.'; end if;
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.status<>'OPEN' or h.cutoff_time<=now() then raise exception 'This run is closed for reservations.'; end if;
 if exists(select 1 from public.user_blocks where (user_id=h.host_id and blocked_user_id=u) or (user_id=u and blocked_user_id=h.host_id)) then raise exception 'This run is unavailable because a user is blocked.'; end if;
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

create or replace function private.discover_runs(p_lat double precision,p_lng double precision,p_radius integer,p_search text,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); result jsonb; begin
 if p_lat is null or p_lng is null or p_lat not between 1.15 and 1.50 or p_lng not between 103.6 and 104.1 or p_radius is null or p_radius not between 100 and 20000 or p_offset is null or p_offset not between 0 and 10000 or length(coalesce(p_search,''))>100 then raise exception 'Invalid search location or filter.'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
 select h.*,jsonb_build_object('name',m.name,'description',m.description) merchant,
 6371000*2*asin(sqrt(least(1.0,power(sin(radians(h.pickup_latitude-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(h.pickup_latitude))*power(sin(radians(h.pickup_longitude-p_lng)/2),2)))) distance
 from public.order_hubs h join public.merchants m on m.id=h.merchant_id
 where not exists(select 1 from public.user_blocks b where (b.user_id=u and b.blocked_user_id=h.host_id) or (b.user_id=h.host_id and b.blocked_user_id=u))
 and h.status='OPEN' and h.cutoff_time>now() and h.participant_count<h.max_participants
 and h.pickup_latitude between p_lat-p_radius/110000.0 and p_lat+p_radius/110000.0
 and h.pickup_longitude between p_lng-p_radius/110000.0 and p_lng+p_radius/110000.0
 and (coalesce(p_search,'')='' or strpos(lower(m.name||' '||h.void_deck_notes||' '||coalesce(h.pickup_postal_code,'')||' '||coalesce(h.host_name,'')),lower(p_search))>0)
 and 6371000*2*asin(sqrt(least(1.0,power(sin(radians(h.pickup_latitude-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(h.pickup_latitude))*power(sin(radians(h.pickup_longitude-p_lng)/2),2))))<=p_radius
 order by distance,h.cutoff_time,h.id limit 21 offset p_offset
 )r; return result;
end$$;
