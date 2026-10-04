create or replace function private.remove_unready_reservation(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_member(); o public.sub_orders; h public.order_hubs; begin
 select * into o from public.sub_orders where id=p_order;
 select * into h from public.order_hubs where id=o.hub_id for update;
 select * into o from public.sub_orders where id=p_order;
 if o.id is null or h.host_id<>u or h.status<>'OPEN' or o.order_status<>'RESERVED' or jsonb_array_length(o.cart_items)<>0 then raise exception 'Only the host can remove an unfinished reservation before locking.'; end if;
 update public.sub_orders set order_status='CANCELLED' where id=p_order;
 perform private.sync_split(h.id);
end$$;

-- Block predicates must read both sides; ordinary block RLS only exposes the caller's rows.
create function private.can_read_chat_sender(p_sender uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.user_blocks b where (b.user_id=auth.uid() and b.blocked_user_id=p_sender) or (b.blocked_user_id=auth.uid() and b.user_id=p_sender));
$$;
revoke all on function private.can_read_chat_sender(uuid) from public,anon;
grant execute on function private.can_read_chat_sender(uuid) to authenticated;
drop policy bitez_chat_members on public.run_messages;
create policy bitez_chat_members on public.run_messages for select to authenticated using(private.can_read_run_chat(hub_id) and (sender_id is null or sender_id=(select auth.uid()) or private.can_read_chat_sender(sender_id)));
