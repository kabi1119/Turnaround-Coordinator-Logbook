-- Disposable test database ONLY, after all migrations through v0.8.1.
-- The executor must have NO auth schema USAGE to reproduce the hosted restriction.
-- SET tco.disposable_test = 'yes' in this same admin session, then execute; always rolls back.
begin;
do $$ begin
  if current_setting('tco.disposable_test',true) is distinct from 'yes' then raise exception 'Disposable database marker required'; end if;
  if has_schema_privilege('tco_sync_executor','auth','USAGE') then raise exception 'Test requires executor Auth schema access denied; revoke only in disposable test setup'; end if;
  if (select prosecdef from pg_proc where oid='tco_sync.request_user_id()'::regprocedure) then raise exception 'Identity helper must be SECURITY INVOKER'; end if;
  if has_function_privilege('authenticated','tco_sync.request_user_id()','EXECUTE') or has_function_privilege('anon','tco_sync.request_user_id()','EXECUTE') then raise exception 'Identity helper is not private'; end if;
end $$;
insert into auth.users(id,email) values
('81000000-0000-4000-8000-000000000001','auth-patch-a@example.test'),
('81000000-0000-4000-8000-000000000002','auth-patch-b@example.test');

set local role tco_sync_executor;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true),set_config('request.jwt.claim.is_anonymous','',true);
do $$ declare claims text; begin
  -- Missing/malformed claims, anonymous JWTs, wrong roles and malformed anonymous flags fail closed.
  foreach claims in array array['','null','[]','malformed','{"role":"anon","sub":"81000000-0000-4000-8000-000000000001"}',
    '{"role":"service_role","sub":"81000000-0000-4000-8000-000000000001"}',
    '{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001","is_anonymous":true}',
    '{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001","is_anonymous":"false"}',
    '{"role":"authenticated","sub":"not-a-uuid"}','{"role":"authenticated"}'] loop
    perform set_config('request.jwt.claims',claims,true);
    if tco_sync.request_user_id() is not null then raise exception 'Invalid identity accepted: %',claims; end if;
    begin perform public.tco_sync_pull(0); raise exception 'Invalid identity could pull'; exception when raise_exception then if sqlerrm<>'sync_auth' then raise; end if; end;
    begin perform public.tco_sync_initialize('{}'); raise exception 'Invalid identity could initialize'; exception when raise_exception then if sqlerrm<>'sync_auth' then raise; end if; end;
    begin perform public.tco_sync_push(0,'81000000-0000-4000-8000-000000000003','[]'); raise exception 'Invalid identity could push'; exception when raise_exception then if sqlerrm<>'sync_auth' then raise; end if; end;
  end loop;
  perform set_config('request.jwt.claims','{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
  if tco_sync.request_user_id()<>'81000000-0000-4000-8000-000000000001'::uuid then raise exception 'Modern identity failed'; end if;
  perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
  if tco_sync.request_user_id() is not null then raise exception 'Conflicting subject settings accepted'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claim.role','anon',true);
  if tco_sync.request_user_id() is not null then raise exception 'Conflicting role settings accepted'; end if;
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.is_anonymous','false',true);
  if tco_sync.request_user_id()<>'81000000-0000-4000-8000-000000000001'::uuid then raise exception 'Legacy identity failed'; end if;
  perform set_config('request.jwt.claim.is_anonymous','true',true);
  if tco_sync.request_user_id() is not null then raise exception 'Legacy anonymous identity accepted'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true),set_config('request.jwt.claim.is_anonymous','',true);
select set_config('request.jwt.claims','{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
do $$ begin
  begin perform tco_sync.request_user_id(); raise exception 'Browser role can call private helper'; exception when insufficient_privilege then null; end;
  begin perform * from tco_sync.accounts; raise exception 'Browser role can read cloud keys directly'; exception when insufficient_privilege then null; end;
end $$;
select public.tco_sync_initialize(jsonb_build_object('version',1,'userId','81000000-0000-4000-8000-000000000001','keyId','81000000-0000-4000-8000-000000000011','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('A',64)));
select public.tco_sync_push(0,'81000000-0000-4000-8000-000000000021',jsonb_build_array(jsonb_build_object('version',1,'userId','81000000-0000-4000-8000-000000000001','keyId','81000000-0000-4000-8000-000000000011','recordId',repeat('a',64),'revision',1,'iv',repeat('A',16),'ciphertext',repeat('A',32))));
do $$ declare response jsonb; begin
  response=public.tco_sync_pull(0);
  if (response->>'total')::integer<>1 or response->'envelope'->>'userId'<>'81000000-0000-4000-8000-000000000001' then raise exception 'Own key or record unavailable'; end if;
  if response->'records'->0->>'ciphertext'<>repeat('A',32) then raise exception 'Ciphertext was changed'; end if;
  begin perform public.tco_sync_push(0,'81000000-0000-4000-8000-000000000022',response->'records'); raise exception 'Stale CAS accepted'; exception when raise_exception then if sqlerrm<>'sync_conflict' then raise; end if; end;
  begin perform public.tco_sync_initialize(response->'envelope'); raise exception 'Existing key replaced'; exception when unique_violation then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000002","is_anonymous":false}',true);
do $$ declare response jsonb; begin
  response=public.tco_sync_pull(0);
  if response->'envelope'<>'null'::jsonb or (response->>'total')::integer<>0 then raise exception 'B can read A key or records'; end if;
  begin perform public.tco_sync_initialize(jsonb_build_object('version',1,'userId','81000000-0000-4000-8000-000000000001','keyId','81000000-0000-4000-8000-000000000011','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('A',64))); raise exception 'Key owner forgery accepted'; exception when raise_exception then if sqlerrm<>'sync_invalid' then raise; end if; end;
end $$;
select public.tco_sync_initialize(jsonb_build_object('version',1,'userId','81000000-0000-4000-8000-000000000002','keyId','81000000-0000-4000-8000-000000000012','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('B',64)));
do $$ begin
  begin perform public.tco_sync_push(0,'81000000-0000-4000-8000-000000000023',jsonb_build_array(jsonb_build_object('version',1,'userId','81000000-0000-4000-8000-000000000001','keyId','81000000-0000-4000-8000-000000000011','recordId',repeat('a',64),'revision',1,'iv',repeat('A',16),'ciphertext',repeat('A',32)))); raise exception 'RPC record ownership forgery accepted'; exception when raise_exception then if sqlerrm<>'sync_invalid' then raise; end if; end;
end $$;
reset role;

-- Exercise forced RLS as the exact restricted RPC owner, still without any auth schema access.
set local role tco_sync_executor;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
do $$ declare affected integer; begin
  if (select count(*) from tco_sync.accounts)<>1 or (select count(*) from tco_sync.records)<>1 then raise exception 'Executor bypasses owner RLS'; end if;
  update tco_sync.records set envelope='{}' where user_id='81000000-0000-4000-8000-000000000002'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'A can modify B records'; end if;
  begin update tco_sync.records set user_id='81000000-0000-4000-8000-000000000002'; raise exception 'Record ownership reassignment accepted'; exception when insufficient_privilege then null; end;
  begin update tco_sync.accounts set user_id='81000000-0000-4000-8000-000000000002'; raise exception 'Key ownership reassignment accepted'; exception when insufficient_privilege then null; end;
  begin delete from tco_sync.records; raise exception 'Physical deletion accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"81000000-0000-4000-8000-000000000001","is_anonymous":true}',true);
do $$ begin
  if (select count(*) from tco_sync.accounts)<>0 or (select count(*) from tco_sync.records)<>0 then raise exception 'Anonymous-auth user bypasses RLS'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.tco_sync_pull(0); raise exception 'Anonymous gateway access accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
