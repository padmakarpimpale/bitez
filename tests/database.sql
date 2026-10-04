-- Run as database owner. Everything is rolled back; no test users or orders persist.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000001','bitez-host-test@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000002','bitez-neighbour-test@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000003','bitez-outsider-test@example.invalid',now());
insert into public.profiles(id,full_name,postal_code,hdb_block) values
 ('00000000-0000-4000-8000-000000000001','Test host','640001','1'),
 ('00000000-0000-4000-8000-000000000002','Test neighbour','640002','2'),
 ('00000000-0000-4000-8000-000000000003','Test outsider','640003','3');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare h uuid; h2 uuid; begin
 if (select count(*) from public.profiles)<>1 then raise exception 'TEST FAILED: profile leak';end if;
 h:=public.create_run('Database test stall','Public test pickup','640001',1.34,103.70,now()+interval '1 hour',9,2);
 h2:=public.create_run('Expired test stall','Public test pickup','640001',1.34,103.70,now()+interval '1 hour',6,3);
 perform set_config('bitez.test_hub',h::text,true);perform set_config('bitez.test_hub2',h2::text,true);
 begin perform public.reserve_order(h,'[{"name":"Rice","qty":1,"price":5}]');raise exception 'TEST FAILED: host joined';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin update public.order_hubs set base_delivery_fee=0 where id=h;raise exception 'TEST FAILED: direct hub write';exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.discover_runs(1.34,103.70,500,'Database test',0))<>1 then raise exception 'TEST FAILED: search';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$declare h uuid:=current_setting('bitez.test_hub')::uuid; o uuid; begin
 begin perform public.reserve_order(h,'[{"name":"Rice","qty":-1,"price":5}]');raise exception 'TEST FAILED: negative quantity';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 o:=public.reserve_order(h,'[{"name":"Rice","qty":2,"price":5.5}]');perform set_config('bitez.test_order',o::text,true);
 if (select items_total_price from public.sub_orders where id=o)<>11 then raise exception 'TEST FAILED: calculated total';end if;
 if (select current_split_fee from public.order_hubs where id=h)<>4.5 then raise exception 'TEST FAILED: split';end if;
 begin perform public.reserve_order(h,'[{"name":"Rice","qty":1,"price":5}]');raise exception 'TEST FAILED: duplicate join';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform public.set_run_status(h,'LOCKED');raise exception 'TEST FAILED: nonhost status';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$declare h uuid:=current_setting('bitez.test_hub')::uuid; begin
 if (select count(*) from public.sub_orders)<>0 then raise exception 'TEST FAILED: order privacy';end if;
 begin perform public.reserve_order(h,'[{"name":"Rice","qty":1,"price":5}]');raise exception 'TEST FAILED: over capacity';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$begin perform public.cancel_order(current_setting('bitez.test_order')::uuid); if(select current_split_fee from public.order_hubs where id=current_setting('bitez.test_hub')::uuid)<>9 then raise exception 'TEST FAILED: cancellation split';end if;perform public.reserve_order(current_setting('bitez.test_hub')::uuid,'[{"name":"Rice","qty":1,"price":5}]');end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$declare h uuid:=current_setting('bitez.test_hub')::uuid; begin
 if (select count(*) from public.sub_orders where hub_id=h)<>1 then raise exception 'TEST FAILED: host manifest';end if;
 begin perform public.set_run_status(h,'ARRIVED');raise exception 'TEST FAILED: invalid transition';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.set_run_status(h,'LOCKED');
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$begin begin perform public.cancel_order(current_setting('bitez.test_order')::uuid);raise exception 'TEST FAILED: cancel locked';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;end$$;
reset role;
update public.order_hubs set cutoff_time=now()-interval '1 minute' where id=current_setting('bitez.test_hub2')::uuid;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$begin begin perform public.reserve_order(current_setting('bitez.test_hub2')::uuid,'[{"name":"Rice","qty":1,"price":5}]');raise exception 'TEST FAILED: expired join';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$begin perform public.set_run_status(current_setting('bitez.test_hub')::uuid,'ARRIVED');perform public.collect_order(current_setting('bitez.test_order')::uuid);if(select current_split_fee from public.order_hubs where id=current_setting('bitez.test_hub')::uuid)<>4.5 then raise exception 'TEST FAILED: collection altered split';end if;end$$;
reset role;
set local role anon;
do $$begin begin perform public.reserve_order(current_setting('bitez.test_hub')::uuid,'[]');raise exception 'TEST FAILED: anonymous mutation';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'PASS: profile/order privacy, RPC ownership, host restriction, server totals, duplicates, capacity, cancellation, locked/expired/anonymous rejection, search and collection split. All fixtures rolled back.' as result;
