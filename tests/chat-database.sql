-- Run as owner. Test identities, runs, orders and messages are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000011','chat-host@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000012','chat-member@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000013','chat-outsider@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000014','chat-unverified@example.invalid',null);
insert into public.profiles(id,full_name,postal_code,hdb_block) values
 ('00000000-0000-4000-8000-000000000011','Chat host','640001','1'),
 ('00000000-0000-4000-8000-000000000012','Chat member','640002','2'),
 ('00000000-0000-4000-8000-000000000013','Chat outsider','640003','3');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
set local role authenticated;
do $$declare h uuid; m uuid; begin
 h:=public.create_social_run('Chat test kitchen','Public chat test pickup','640001',1.34,103.70,now()+interval '1 hour',6,6,'Optional lunch at the public picnic tables');
 perform set_config('bitez.chat_hub',h::text,true);
 m:=public.send_run_message(h,'Hello neighbours!','00000000-0000-4000-8000-000000000021','announcement');
 perform set_config('bitez.chat_message',m::text,true);
 if public.send_run_message(h,'Hello neighbours!','00000000-0000-4000-8000-000000000021','announcement')<>m then raise exception 'TEST FAILED: retry created duplicate';end if;
 if (select count(*) from public.run_messages where hub_id=h)<>2 then raise exception 'TEST FAILED: host history';end if;
 perform public.edit_run_order(h,'[{"name":"Noodles","qty":1,"price":4.5}]');
 if (select cart_items->0->>'name' from public.run_host_orders where hub_id=h)<>'Noodles' then raise exception 'TEST FAILED: host order';end if;
 begin insert into public.run_messages(hub_id,sender_id,sender_name,body,kind,client_id) values(h,auth.uid(),'Fake','Bypass','system',gen_random_uuid());raise exception 'TEST FAILED: direct insert';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000013',true);
do $$declare h uuid:=current_setting('bitez.chat_hub')::uuid; begin
 if (select count(*) from public.run_messages where hub_id=h)<>0 then raise exception 'TEST FAILED: outsider history leak';end if;
 if (select count(*) from public.run_host_orders where hub_id=h)<>0 then raise exception 'TEST FAILED: host food privacy';end if;
 begin perform public.send_run_message(h,'Outsider message',gen_random_uuid(),'message');raise exception 'TEST FAILED: outsider send';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform public.moderate_run_message(current_setting('bitez.chat_message')::uuid);raise exception 'TEST FAILED: outsider moderate';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform public.edit_run_order(h,'[{"name":"Rice","qty":1,"price":3}]');raise exception 'TEST FAILED: outsider edit';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
do $$declare h uuid:=current_setting('bitez.chat_hub')::uuid; o uuid; m uuid; begin
 o:=public.join_run_chat(h);perform set_config('bitez.chat_order',o::text,true);
 if (select count(*) from public.run_messages where hub_id=h)<4 then raise exception 'TEST FAILED: member history';end if;
 m:=public.send_run_message(h,'Can we collect together?',gen_random_uuid(),'message');
 perform public.report_run_message(current_setting('bitez.chat_message')::uuid,'Test concern about this announcement.');
 begin perform public.send_run_message(h,'Spoofed announcement',gen_random_uuid(),'announcement');raise exception 'TEST FAILED: announcement spoof';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform public.moderate_run_message(current_setting('bitez.chat_message')::uuid);raise exception 'TEST FAILED: nonhost moderation';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.moderate_run_message(m);
 if (select removed_at from public.run_messages where id=m) is null then raise exception 'TEST FAILED: remove own message';end if;
 begin perform public.edit_run_order(h,'[{"name":"Rice","qty":-1,"price":3}]');raise exception 'TEST FAILED: invalid edit';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.edit_run_order(h,'[{"name":" Rice ","qty":2,"price":3.5}]');
 if (select items_total_price from public.sub_orders where id=o)<>7 then raise exception 'TEST FAILED: edit total';end if;
 if (select current_split_fee from public.order_hubs where id=h)<>3 then raise exception 'TEST FAILED: edit changed split';end if;
 begin perform public.send_run_message(h,repeat('x',1001),gen_random_uuid(),'message');raise exception 'TEST FAILED: oversized message';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 insert into public.user_blocks(user_id,blocked_user_id,blocked_name) values(auth.uid(),'00000000-0000-4000-8000-000000000011','Chat host');
 if (select count(*) from public.run_messages where id=current_setting('bitez.chat_message')::uuid)<>0 then raise exception 'TEST FAILED: blocked author visible';end if;
 begin perform public.send_run_message(h,'Blocked message',gen_random_uuid(),'message');raise exception 'TEST FAILED: blocked send';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 delete from public.user_blocks where user_id=auth.uid();
 perform public.cancel_order(o);
 if (select count(*) from public.run_messages where hub_id=h)<>0 then raise exception 'TEST FAILED: left member retained chat';end if;
 begin perform public.send_run_message(h,'Still here?',gen_random_uuid(),'message');raise exception 'TEST FAILED: left member send';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.join_run_chat(h);
end$$;
reset role;
insert into public.user_blocks(user_id,blocked_user_id,blocked_name) values('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012','Chat member');
set local role authenticated;
do $$begin if (select count(*) from public.run_messages where id=current_setting('bitez.chat_message')::uuid)<>0 then raise exception 'TEST FAILED: reverse block visibility';end if;end$$;
reset role;
delete from public.user_blocks where user_id='00000000-0000-4000-8000-000000000011' and blocked_user_id='00000000-0000-4000-8000-000000000012';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000014',true);
do $$begin
 if (select count(*) from public.run_messages where hub_id=current_setting('bitez.chat_hub')::uuid)<>0 then raise exception 'TEST FAILED: unverified chat leak';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
do $$declare h uuid:=current_setting('bitez.chat_hub')::uuid;begin
 begin perform public.set_run_status(h,'LOCKED');raise exception 'TEST FAILED: unfinished lock';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.remove_unready_reservation(current_setting('bitez.chat_order')::uuid);
 perform public.set_run_status(h,'LOCKED');
 begin perform public.edit_run_order(h,'[{"name":"Rice","qty":1,"price":3}]');raise exception 'TEST FAILED: locked edit';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.send_run_message(h,'Order placed. Meet at the pickup point.',gen_random_uuid(),'announcement');
 for idx in 1..18 loop perform public.send_run_message(h,'Rate limit test',gen_random_uuid(),'message');end loop;
 begin perform public.send_run_message(h,'Over the limit',gen_random_uuid(),'message');raise exception 'TEST FAILED: message rate limit';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.set_run_status(h,'CANCELLED');
 begin perform public.send_run_message(h,'After cancellation',gen_random_uuid(),'message');raise exception 'TEST FAILED: cancelled send';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end$$;
reset role;
update public.order_hubs set cutoff_time=now()-interval '25 hours',status='LOCKED' where id=current_setting('bitez.chat_hub')::uuid;
set local role authenticated;
do $$declare h uuid:=current_setting('bitez.chat_hub')::uuid;begin
 if (select count(*) from public.run_messages where hub_id=h)=0 then raise exception 'TEST FAILED: archived host history';end if;
 begin perform public.send_run_message(h,'After 24 hours',gen_random_uuid(),'message');raise exception 'TEST FAILED: archived write';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end$$;
reset role;
update public.order_hubs set cutoff_time=now()-interval '31 days' where id=current_setting('bitez.chat_hub')::uuid;
set local role authenticated;
do $$begin if (select count(*) from public.run_messages where hub_id=current_setting('bitez.chat_hub')::uuid)<>0 then raise exception 'TEST FAILED: expired history';end if;end$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 begin perform public.send_run_message(current_setting('bitez.chat_hub')::uuid,'Anon',gen_random_uuid(),'message');raise exception 'TEST FAILED: anonymous send';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.run_messages;raise exception 'TEST FAILED: anonymous read';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'Chat authorization, retry, moderation, membership and order checks passed.' as result;
rollback;
