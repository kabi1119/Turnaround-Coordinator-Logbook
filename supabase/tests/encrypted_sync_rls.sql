-- ONLY a disposable Supabase test database. This deliberately refuses to run without an explicit marker.
-- SET tco.disposable_test = 'yes'; then run this entire script as its admin. Never use production.
begin;
do $$ begin if current_setting('tco.disposable_test',true) is distinct from 'yes' then raise exception 'Disposable database marker required'; end if; end $$;
insert into auth.users(id,email) values
('80000000-0000-4000-8000-000000000001','sync-a@example.test'),
('80000000-0000-4000-8000-000000000002','sync-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select public.tco_sync_initialize(jsonb_build_object('version',1,'userId','80000000-0000-4000-8000-000000000001','keyId','80000000-0000-4000-8000-000000000011','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('A',64)));
select public.tco_sync_push(0,'80000000-0000-4000-8000-000000000021',jsonb_build_array(jsonb_build_object('version',1,'userId','80000000-0000-4000-8000-000000000001','keyId','80000000-0000-4000-8000-000000000011','recordId',repeat('a',64),'revision',1,'iv',repeat('A',16),'ciphertext',repeat('A',32))));
do $$ begin
 if (public.tco_sync_pull(0)->>'total')::integer<>1 then raise exception 'Own record missing'; end if;
 begin
  perform public.tco_sync_push(0,'80000000-0000-4000-8000-000000000022',public.tco_sync_pull(0)->'records');
  raise exception 'Stale/empty push accepted';
 exception when raise_exception then if sqlerrm not in ('sync_conflict','sync_capacity') then raise; end if; end;
 begin perform * from tco_sync.records; raise exception 'Direct table SELECT allowed'; exception when insufficient_privilege then null; end;
 begin update tco_sync.accounts set revision=99; raise exception 'Direct revision bypass allowed'; exception when insufficient_privilege then null; end;
 begin delete from tco_sync.records; raise exception 'Physical deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
do $$ begin
 if public.tco_sync_pull(0)->'envelope' <> 'null'::jsonb or (public.tco_sync_pull(0)->>'total')::integer<>0 then raise exception 'B can read A'; end if;
 begin
  perform public.tco_sync_initialize(jsonb_build_object('version',1,'userId','80000000-0000-4000-8000-000000000001','keyId','80000000-0000-4000-8000-000000000011','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('A',64)));
  raise exception 'Forged key ownership accepted';
 exception when raise_exception then if sqlerrm<>'sync_invalid' then raise; end if; end;
end $$;
select public.tco_sync_initialize(jsonb_build_object('version',1,'userId','80000000-0000-4000-8000-000000000002','keyId','80000000-0000-4000-8000-000000000012','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('B',64)));
do $$ begin
 begin
  perform public.tco_sync_push(0,'80000000-0000-4000-8000-000000000022',jsonb_build_array(jsonb_build_object('version',1,'userId','80000000-0000-4000-8000-000000000001','keyId','80000000-0000-4000-8000-000000000011','recordId',repeat('a',64),'revision',1,'iv',repeat('A',16),'ciphertext',repeat('A',32))));
  raise exception 'Foreign ciphertext/tombstone write accepted';
 exception when raise_exception then if sqlerrm<>'sync_invalid' then raise; end if; end;
end $$;
-- Exercise RLS directly as the exact NOLOGIN function executor; owner is still A.
reset role;
set local role tco_sync_executor;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
do $$ declare affected integer; begin
 if (select count(*) from tco_sync.accounts)<>1 then raise exception 'Executor bypasses owner RLS'; end if;
 update tco_sync.accounts set revision=99 where user_id='80000000-0000-4000-8000-000000000002'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'A can update B'; end if;
 begin update tco_sync.accounts set user_id='80000000-0000-4000-8000-000000000002'; raise exception 'Ownership reassignment allowed'; exception when insufficient_privilege then null; end;
 begin delete from tco_sync.records; raise exception 'Executor physical delete allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.tco_sync_pull(0); raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.tco_sync_initialize('{}'); raise exception 'Anonymous key creation allowed'; exception when insufficient_privilege then null; end;
 begin perform public.tco_sync_push(0,'80000000-0000-4000-8000-000000000022','[]'); raise exception 'Anonymous push allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
