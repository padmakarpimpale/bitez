alter table public.order_hubs alter column status set not null;
alter table public.sub_orders alter column order_status set not null;
alter table public.order_hubs alter column pickup_latitude set not null;
alter table public.order_hubs alter column pickup_longitude set not null;
alter table public.order_hubs alter column pickup_postal_code set not null;
alter table public.order_hubs alter column host_name set not null;
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
 if octet_length(p_items::text)>10000 then raise exception 'Order payload is too large.'; end if;
 if jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Add 1 to 20 items.'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not (item ?& array['name','qty','price']) or jsonb_typeof(item->'name')<>'string' or length(trim(item->>'name')) not between 1 and 100 or jsonb_typeof(item->'qty')<>'number' or jsonb_typeof(item->'price')<>'number' then raise exception 'Invalid item.'; end if;
  if (item->>'qty')::numeric not between 1 and 20 or (item->>'qty')::numeric<>trunc((item->>'qty')::numeric) or (item->>'price')::numeric not between 0 and 200 or (item->>'price')::numeric<>round((item->>'price')::numeric,2) then raise exception 'Invalid quantity or price.'; end if;
  total:=total+(item->>'qty')::numeric*(item->>'price')::numeric;
 end loop;
 if total>9999 then raise exception 'Order total is too large.'; end if;
 select jsonb_agg(jsonb_build_object('name',trim(i->>'name'),'qty',(i->>'qty')::integer,'price',(i->>'price')::numeric)) into p_items from jsonb_array_elements(p_items) i;
 insert into public.sub_orders(hub_id,user_id,cart_items,items_total_price,participant_name) values(p_hub,u,p_items,total,p.full_name)
 on conflict(hub_id,user_id) do update set cart_items=excluded.cart_items,items_total_price=excluded.items_total_price,participant_name=excluded.participant_name,order_status='RESERVED',created_at=now() returning id into result;
 perform private.sync_split(p_hub); return result;
end$$;


create or replace function private.set_run_status(p_hub uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); h public.order_hubs; begin
 select * into h from public.order_hubs where id=p_hub for update;
 if h.id is null or h.host_id<>u then raise exception 'Only the host can manage this run.'; end if;
 if p_status is null or not ((h.status='OPEN' and p_status in ('LOCKED','CANCELLED')) or (h.status='LOCKED' and p_status in ('ARRIVED','CANCELLED'))) then raise exception 'Invalid run status transition.'; end if;
 update public.order_hubs set status=p_status where id=p_hub;
 if p_status='CANCELLED' then update public.sub_orders set order_status='CANCELLED' where hub_id=p_hub; perform private.sync_split(p_hub); end if;
end$$;
