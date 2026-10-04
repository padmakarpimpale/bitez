-- Additive migration: older deployed clients continue to work.
alter table public.order_hubs add column meal_note text not null default '' check(length(meal_note)<=160);

create table public.run_host_orders (
 hub_id uuid primary key references public.order_hubs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 cart_items jsonb not null,
 updated_at timestamptz not null default now()
);
create index bitez_host_orders_user_idx on public.run_host_orders(user_id);
alter table public.run_host_orders enable row level security;
revoke all on public.run_host_orders from public,anon,authenticated;
grant select on public.run_host_orders to authenticated;
create policy bitez_host_cart_read on public.run_host_orders for select to authenticated using(user_id=(select auth.uid()));

create table public.run_messages (
 id uuid primary key default gen_random_uuid(),
 hub_id uuid not null references public.order_hubs(id) on delete cascade,
 sender_id uuid references auth.users(id) on delete cascade,
 sender_name text not null,
 body text not null check(length(trim(body)) between 1 and 1000 and octet_length(body)<=4000),
 kind text not null check(kind in ('message','announcement','system')),
 client_id uuid,
 created_at timestamptz not null default now(),
 removed_at timestamptz,
 unique(hub_id,sender_id,client_id),
 check((kind='system' and sender_id is null and client_id is null) or (kind<>'system' and sender_id is not null and client_id is not null))
);
create index bitez_messages_hub_time_idx on public.run_messages(hub_id,created_at desc,id desc);
create index bitez_messages_sender_time_idx on public.run_messages(sender_id,created_at desc);
alter table public.run_messages enable row level security;
revoke all on public.run_messages from public,anon,authenticated;
grant select on public.run_messages to authenticated;

-- This lookup bypasses the host-only order policy, without exposing other orders.
create function private.can_read_run_chat(p_hub uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.order_hubs h
  where h.id=p_hub and h.cutoff_time>now()-interval '30 days'
  and exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null and u.email_confirmed_at is not null)
  and (h.host_id=auth.uid() or exists(select 1 from public.sub_orders o where o.hub_id=h.id and o.user_id=auth.uid() and o.order_status<>'CANCELLED'))
 );
$$;
revoke all on function private.can_read_run_chat(uuid) from public,anon;
grant execute on function private.can_read_run_chat(uuid) to authenticated;
create policy bitez_chat_members on public.run_messages for select to authenticated
 using(private.can_read_run_chat(hub_id) and (sender_id is null or sender_id=(select auth.uid()) or not exists(select 1 from public.user_blocks b where (b.user_id=(select auth.uid()) and b.blocked_user_id=sender_id) or (b.blocked_user_id=(select auth.uid()) and b.user_id=sender_id))));

create function public.can_open_run_chat(p_hub uuid) returns boolean language sql security invoker set search_path='' as $$select private.can_read_run_chat(p_hub);$$;
revoke all on function public.can_open_run_chat(uuid) from public,anon;
grant execute on function public.can_open_run_chat(uuid) to authenticated;

create function private.join_run_chat(p_hub uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; p public.profiles; result uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into p from public.profiles where id=u;
 if p.id is null then raise exception 'Save your profile first.'; end if;
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.status<>'OPEN' or h.cutoff_time<=now() then raise exception 'This run is closed for reservations.'; end if;
 if h.host_id=u then raise exception 'The host already has chat access.'; end if;
 if exists(select 1 from public.user_blocks where (user_id=h.host_id and blocked_user_id=u) or (user_id=u and blocked_user_id=h.host_id)) then raise exception 'This run is unavailable because a user is blocked.'; end if;
 select id into result from public.sub_orders where hub_id=p_hub and user_id=u and order_status<>'CANCELLED';
 if result is not null then return result; end if;
 if h.participant_count>=h.max_participants then raise exception 'This run is full.'; end if;
 if (select count(*) from public.sub_orders o join public.order_hubs x on x.id=o.hub_id where o.user_id=u and o.order_status='RESERVED' and x.status in ('OPEN','LOCKED'))>=10 then raise exception 'Maximum 10 active reservations.'; end if;
 insert into public.sub_orders(hub_id,user_id,cart_items,items_total_price,participant_name) values(p_hub,u,'[]'::jsonb,0,p.full_name)
 on conflict(hub_id,user_id) do update set cart_items='[]'::jsonb,items_total_price=0,participant_name=excluded.participant_name,order_status='RESERVED',created_at=now() returning id into result;
 perform private.sync_split(p_hub); return result;
end$$;
create function public.join_run_chat(p_hub uuid) returns uuid language sql security invoker set search_path='' as $$select private.join_run_chat(p_hub);$$;
create function private.remove_unready_reservation(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); o public.sub_orders; h public.order_hubs; begin
 select * into o from public.sub_orders where id=p_order;
 select * into h from public.order_hubs where id=o.hub_id for update;
 if o.id is null or h.host_id<>u or h.status<>'OPEN' or o.order_status<>'RESERVED' or jsonb_array_length(o.cart_items)<>0 then raise exception 'Only the host can remove an unfinished reservation before locking.'; end if;
 update public.sub_orders set order_status='CANCELLED' where id=p_order;
 perform private.sync_split(h.id);
end$$;
create function public.remove_unready_reservation(p_order uuid) returns void language sql security invoker set search_path='' as $$select private.remove_unready_reservation(p_order);$$;
create or replace function private.set_run_status(p_hub uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; begin
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.host_id<>u then raise exception 'Only the host can manage this run.'; end if;
 if p_status is null or not ((h.status='OPEN' and p_status in ('LOCKED','CANCELLED')) or (h.status='LOCKED' and p_status in ('ARRIVED','CANCELLED'))) then raise exception 'Invalid run status transition.'; end if;
 if p_status='LOCKED' and exists(select 1 from public.sub_orders where hub_id=p_hub and order_status='RESERVED' and jsonb_array_length(cart_items)=0) then raise exception 'Some neighbours are still choosing. Ask them to save an order or remove their unfinished reservation before locking.'; end if;
 update public.order_hubs set status=p_status where id=p_hub;
 if p_status='CANCELLED' then update public.sub_orders set order_status='CANCELLED' where hub_id=p_hub; perform private.sync_split(p_hub); end if;
end$$;

create function private.send_run_message(p_hub uuid,p_body text,p_client_id uuid,p_kind text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; result uuid; name text; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or not private.can_read_run_chat(p_hub) then raise exception 'Join this run before opening its chat.'; end if;
 if h.status='CANCELLED' or h.cutoff_time<now()-interval '24 hours' then raise exception 'This chat is now read-only.'; end if;
 if exists(select 1 from public.user_blocks where (user_id=h.host_id and blocked_user_id=u) or (user_id=u and blocked_user_id=h.host_id)) then raise exception 'Messaging is unavailable because a user is blocked.'; end if;
 if p_kind is null or p_kind not in ('message','announcement') or (p_kind='announcement' and h.host_id<>u) then raise exception 'Only the host can post an announcement.'; end if;
 if p_body is null or length(trim(p_body)) not between 1 and 1000 or octet_length(p_body)>4000 or p_client_id is null then raise exception 'Write a message of 1 to 1000 characters.'; end if;
 select id into result from public.run_messages where hub_id=p_hub and sender_id=u and client_id=p_client_id;
 if result is not null then return result; end if;
 if (select count(*) from public.run_messages where sender_id=u and created_at>now()-interval '1 minute')>=20 or (select count(*) from public.run_messages where sender_id=u and created_at>now()-interval '1 day')>=300 then raise exception 'Too many messages. Please wait before sending again.'; end if;
 select full_name into name from public.profiles where id=u;
 if name is null then raise exception 'Save your profile before chatting.'; end if;
 insert into public.run_messages(hub_id,sender_id,sender_name,body,kind,client_id) values(p_hub,u,name,trim(p_body),p_kind,p_client_id) returning id into result;
 return result;
end$$;
create function public.send_run_message(p_hub uuid,p_body text,p_client_id uuid,p_kind text default 'message') returns uuid language sql security invoker set search_path='' as $$ select private.send_run_message(p_hub,p_body,p_client_id,p_kind); $$;

create function private.moderate_run_message(p_message uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); m public.run_messages; h public.order_hubs; begin
 select * into m from public.run_messages where id=p_message;
 select * into h from public.order_hubs where id=m.hub_id for update;
 if m.id is null or not private.can_read_run_chat(m.hub_id) or m.kind='system' or (u<>m.sender_id and u<>h.host_id) then raise exception 'Only the author or host can remove this message.'; end if;
 update public.run_messages set body='Message removed.',removed_at=now() where id=p_message;
end$$;
create function public.moderate_run_message(p_message uuid) returns void language sql security invoker set search_path='' as $$select private.moderate_run_message(p_message);$$;
create function private.report_run_message(p_message uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); m public.run_messages; begin
 select * into m from public.run_messages where id=p_message;
 if m.id is null or not private.can_read_run_chat(m.hub_id) then raise exception 'Message unavailable.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 500 then raise exception 'Describe the concern in 10 to 500 characters.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.safety_reports where reporter_id=u and created_at>now()-interval '1 day')>=20 then raise exception 'Report limit reached. Contact the pilot operator for help.'; end if;
 insert into public.safety_reports(reporter_id,hub_id,reason) values(u,m.hub_id,left('Chat message '||m.id::text||' by '||m.sender_name||': '||left(m.body,300)||E'\nReason: '||trim(p_reason),1000));
end$$;
create function public.report_run_message(p_message uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.report_run_message(p_message,p_reason);$$;

-- Validate and normalize carts for both host and neighbour order changes.
create function private.normalize_run_cart(p_items jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; total numeric:=0; begin
 if p_items is null or jsonb_typeof(p_items)<>'array' or octet_length(p_items::text)>10000 then raise exception 'Invalid order.'; end if;
 if jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Add 1 to 20 items.'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['name','qty','price']) or jsonb_typeof(item->'name')<>'string' or length(trim(item->>'name')) not between 1 and 100 or jsonb_typeof(item->'qty')<>'number' or jsonb_typeof(item->'price')<>'number' then raise exception 'Invalid item.'; end if;
  if (item->>'qty')::numeric not between 1 and 20 or (item->>'qty')::numeric<>trunc((item->>'qty')::numeric) or (item->>'price')::numeric not between 0 and 200 or (item->>'price')::numeric<>round((item->>'price')::numeric,2) then raise exception 'Invalid quantity or price.'; end if;
  total:=total+(item->>'qty')::numeric*(item->>'price')::numeric;
 end loop;
 if total>9999 then raise exception 'Order total is too large.'; end if;
 return (select jsonb_agg(jsonb_build_object('name',trim(i->>'name'),'qty',(i->>'qty')::integer,'price',(i->>'price')::numeric)) from jsonb_array_elements(p_items) i);
end$$;
revoke all on function private.normalize_run_cart(jsonb) from public,anon,authenticated;
create function private.edit_run_order(p_hub uuid,p_items jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; items jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.status<>'OPEN' or h.cutoff_time<=now() then raise exception 'Orders can only change before the cutoff while the run is open.'; end if;
 if not private.can_read_run_chat(p_hub) then raise exception 'Join this run before editing your order.'; end if;
 items:=private.normalize_run_cart(p_items);
 if h.host_id=u then
  insert into public.run_host_orders(hub_id,user_id,cart_items) values(p_hub,u,items) on conflict(hub_id) do update set cart_items=excluded.cart_items,updated_at=now();
 else
  update public.sub_orders set cart_items=items,items_total_price=(select sum((i->>'qty')::numeric*(i->>'price')::numeric) from jsonb_array_elements(items) i)
   where hub_id=p_hub and user_id=u and order_status='RESERVED';
  if not found then raise exception 'Your reservation is unavailable.'; end if;
 end if;
end$$;
create function public.edit_run_order(p_hub uuid,p_items jsonb) returns void language sql security invoker set search_path='' as $$select private.edit_run_order(p_hub,p_items);$$;
create function private.create_social_run(p_restaurant text,p_pickup text,p_postal text,p_lat numeric,p_lng numeric,p_cutoff timestamptz,p_fee numeric,p_capacity integer,p_meal_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; begin
 if p_meal_note is null or length(trim(p_meal_note))>160 then raise exception 'Keep the meal invitation under 160 characters.'; end if;
 h:=private.create_run(p_restaurant,p_pickup,p_postal,p_lat,p_lng,p_cutoff,p_fee,p_capacity);
 update public.order_hubs set meal_note=trim(p_meal_note) where id=h;
 return h;
end$$;
create function public.create_social_run(p_restaurant text,p_pickup text,p_postal text,p_lat numeric,p_lng numeric,p_cutoff timestamptz,p_fee numeric,p_capacity integer,p_meal_note text) returns uuid language sql security invoker set search_path='' as $$select private.create_social_run(p_restaurant,p_pickup,p_postal,p_lat,p_lng,p_cutoff,p_fee,p_capacity,p_meal_note);$$;

create function private.run_chat_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare text text; hub uuid; begin
 if tg_table_name='order_hubs' then
  hub:=new.id;
  if tg_op='INSERT' then text:='Run created. Use this chat to agree food choices and collection details.';
  elsif new.status is distinct from old.status then text:=case new.status when 'LOCKED' then 'Orders locked. The host is placing the restaurant order.' when 'ARRIVED' then 'Food has arrived. Head to the pickup point.' when 'CANCELLED' then 'Run cancelled. This chat is closed.' else null end;
  end if;
 elsif tg_table_name='run_host_orders' then
  hub:=new.hub_id; text:='The host updated their order.';
 else
  hub:=new.hub_id;
  if tg_op='INSERT' or (old.order_status='CANCELLED' and new.order_status='RESERVED') then text:='A neighbour joined the run.';
  elsif new.order_status is distinct from old.order_status then text:='A neighbour'||case new.order_status when 'CANCELLED' then ' left the run.' when 'COLLECTED' then ' collected their food.' else ' updated their reservation.' end;
  elsif new.cart_items is distinct from old.cart_items then text:='A neighbour updated their order.';
  end if;
 end if;
 if text is not null then insert into public.run_messages(hub_id,sender_name,body,kind) values(hub,'Bitez',text,'system'); end if;
 return new;
end$$;
revoke all on function private.run_chat_activity() from public,anon,authenticated;
create trigger bitez_hub_chat_activity after insert or update of status on public.order_hubs for each row execute function private.run_chat_activity();
create trigger bitez_host_order_chat_activity after insert or update of cart_items on public.run_host_orders for each row execute function private.run_chat_activity();
create trigger bitez_order_chat_activity after insert or update of order_status,cart_items on public.sub_orders for each row execute function private.run_chat_activity();

do $$declare r record; begin
 for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('join_run_chat','remove_unready_reservation','send_run_message','moderate_run_message','report_run_message','edit_run_order','create_social_run') loop
  execute format('revoke all on function %I.%I(%s) from public,anon',r.nspname,r.proname,r.args);
  execute format('grant execute on function %I.%I(%s) to authenticated',r.nspname,r.proname,r.args);
 end loop;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='run_messages') then alter publication supabase_realtime add table public.run_messages; end if;
end$$;
