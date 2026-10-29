-- v0.9.0 Fourth Pass A: additive Guest merge outcome and retirement fences.
-- Apply after 202610280002_cloud_accounts.sql in a disposable project only.
-- No current/legacy records, keys or history are removed. Safe to verify repeatedly.
begin;
do $$
begin
  if current_user<>'postgres' or to_regclass('tco_cloud.operations') is null then
    raise exception 'account_setup: postgres and staged v0.9.0 migration required';
  end if;
  if exists(select 1 from pg_roles where rolname='tco_sync_executor' and
    (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'account_setup: unsafe executor';
  end if;
  if exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and
    ((member='postgres'::regrole and (set_option or inherit_option or grantor='postgres'::regrole))
      or member in ('anon'::regrole,'authenticated'::regrole,'authenticator'::regrole,'service_role'::regrole)))
    or exists(select 1 from pg_auth_members where member='tco_sync_executor'::regrole)
    or has_schema_privilege('tco_sync_executor','public','CREATE') then
    raise exception 'account_setup: unexpected executor access';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='tco_cloud' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity
    and c.relowner<>'tco_sync_executor'::regrole)<>4 then
    raise exception 'account_setup: expected independent forced-RLS owners';
  end if;
  if exists(select 1 from pg_proc where oid in
    ('public.tco_account_push(bigint,uuid,jsonb,text)'::regprocedure,
     'public.tco_account_archive(bigint,text,boolean)'::regprocedure)
    and (proowner<>'tco_sync_executor'::regrole or not prosecdef)) then
    raise exception 'account_setup: unsafe RPC owner';
  end if;
end $$;
alter table tco_cloud.operations add column if not exists outcome text not null default 'committed'
  check(outcome in ('committed','retired'));
do $$ begin
  if exists(select 1 from tco_cloud.operations where outcome is null or outcome not in ('committed','retired'))
    or not exists(select 1 from pg_attribute where attrelid='tco_cloud.operations'::regclass
      and attname='outcome' and atttypid='text'::regtype and attnotnull) then
    raise exception 'account_setup: unexpected receipt format';
  end if;
end $$;
create or replace function tco_cloud.archive_snapshot() returns text
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; result text;
begin
  if uid is null then raise exception 'account_auth'; end if;
  select * into a from tco_cloud.accounts where user_id=uid;
  if not found or a.conversion_state<>'active' then raise exception 'account_setup'; end if;
  select jsonb_build_object('kind','tco-account-history-archive','version',1,'userId',uid,
    'workspaceId',a.workspace_id,'revision',a.revision,'previousFloor',a.replay_floor,
    'manifest',a.migration_manifest,
    'records',(select coalesce(jsonb_agg(jsonb_build_object('collection',collection,'id',record_id,'value',value,'revision',revision) order by revision,collection,record_id),'[]'::jsonb) from tco_cloud.records where user_id=uid),
    'history',(select coalesce(jsonb_agg(to_jsonb(h)-'user_id' order by replacement_revision,operation_id,collection,record_id),'[]'::jsonb) from tco_cloud.history h where user_id=uid),
    'receipts',(select coalesce(jsonb_agg(jsonb_build_object('operationId',operation_id,'requestHash',encode(request_hash,'hex'),'revision',revision,'purpose',purpose,'outcome',outcome,'createdAt',created_at) order by revision,operation_id),'[]'::jsonb) from tco_cloud.operations where user_id=uid))::text into result;
  if octet_length(result)>67108864 then raise exception 'account_capacity'; end if;
  return result;
end $$;
revoke all on function tco_cloud.archive_snapshot() from public,anon,authenticated,service_role;
grant execute on function tco_cloud.archive_snapshot() to tco_sync_executor;
grant create on schema public to tco_sync_executor;
grant tco_sync_executor to postgres with admin false,inherit false,set true granted by postgres;
set local role tco_sync_executor;

create or replace function public.tco_account_push(p_expected bigint,p_operation uuid,p_records jsonb,p_purpose text default 'edit') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; prior tco_cloud.operations; row jsonb; h bytea; target bigint; n bigint; bytes bigint;
begin
  if uid is null then raise exception 'account_auth'; end if;
  if p_operation is null or p_expected is null or p_expected<0 or p_purpose is null or p_purpose not in ('edit','guest-merge','history-restore')
    or p_records is null or jsonb_typeof(p_records)<>'array' then raise exception 'account_invalid'; end if;
  if jsonb_array_length(p_records) not between 1 and 5000 or octet_length(p_records::text)>8388608 then raise exception 'account_capacity'; end if;
  select * into a from tco_cloud.accounts where user_id=uid for update;
  if not found then raise exception 'account_setup'; end if;
  h:=sha256(convert_to(jsonb_build_object('expected',p_expected,'records',p_records,'purpose',p_purpose)::text,'UTF8'));
  select * into prior from tco_cloud.operations where user_id=uid and operation_id=p_operation;
  if found then
    if prior.request_hash<>h then raise exception 'account_conflict'; end if;
    if prior.outcome='retired' then raise exception 'account_operation_retired'; end if;
    return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',prior.revision,'operationId',p_operation);
  end if;
  if p_expected<a.replay_floor then raise exception 'account_archived_review'; end if;
  if a.conversion_state<>'active' then raise exception 'account_conversion_pending'; end if;
  if a.revision<>p_expected then raise exception 'account_conflict'; end if;
  if a.revision>=9007199254740000 then raise exception 'account_capacity'; end if;
  target:=a.revision+1;
  if (select count(distinct jsonb_build_array(value->>'collection',value->>'id')) from jsonb_array_elements(p_records))<>jsonb_array_length(p_records) then raise exception 'account_invalid'; end if;
  for row in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(row)<>'object' or (select count(*) from jsonb_object_keys(row))<>3
      or not tco_cloud.valid_record(row->>'collection',row->>'id',row->'value') then raise exception 'account_invalid'; end if;
    insert into tco_cloud.history(user_id,operation_id,collection,record_id,previous_revision,replacement_revision,value)
    select uid,p_operation,collection,record_id,revision,target,value from tco_cloud.records
    where user_id=uid and collection=row->>'collection' and record_id=row->>'id';
    insert into tco_cloud.records(user_id,collection,record_id,revision,value)
    values(uid,row->>'collection',row->>'id',target,nullif(row->'value','null'::jsonb))
    on conflict(user_id,collection,record_id) do update set value=excluded.value,revision=excluded.revision,modified_at=clock_timestamp();
  end loop;
  perform tco_cloud.validate_graph();
  select count(*),coalesce(sum(octet_length(value::text)),0) into n,bytes from tco_cloud.history where user_id=uid;
  if n>20000 or bytes>33554432 or (select count(*) from tco_cloud.operations where user_id=uid)>=20000 then raise exception 'account_capacity'; end if;
  insert into tco_cloud.operations(user_id,operation_id,request_hash,revision,purpose) values(uid,p_operation,h,target,p_purpose);
  update tco_cloud.accounts set revision=target,modified_at=clock_timestamp() where user_id=uid;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',target,'operationId',p_operation);
end $$;

create or replace function public.tco_account_merge_outcome(p_expected bigint,p_operation uuid,p_records jsonb,p_retire boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; prior tco_cloud.operations; h bytea; result text; op_revision bigint;
begin
  if uid is null then raise exception 'account_auth'; end if;
  if p_expected is null or p_expected<1 or p_operation is null or p_retire is null
    or p_records is null or jsonb_typeof(p_records)<>'array' then raise exception 'account_invalid'; end if;
  if jsonb_array_length(p_records) not between 1 and 5000 or octet_length(p_records::text)>8388608 then raise exception 'account_capacity'; end if;
  select * into a from tco_cloud.accounts where user_id=uid for update;
  if not found or a.conversion_state<>'active' then raise exception 'account_setup'; end if;
  if p_expected>a.revision then raise exception 'account_invalid'; end if;
  h:=sha256(convert_to(jsonb_build_object('expected',p_expected,'records',p_records,'purpose','guest-merge')::text,'UTF8'));
  select * into prior from tco_cloud.operations where user_id=uid and operation_id=p_operation;
  if found then
    if prior.purpose<>'guest-merge' or prior.request_hash<>h then raise exception 'account_conflict'; end if;
    result:=prior.outcome; op_revision:=prior.revision;
  elsif p_expected<a.replay_floor then
    -- Its receipt may have been manually archived. Never claim it did not commit.
    result:='expired'; op_revision:=null;
  elsif p_retire then
    if (select count(*) from tco_cloud.operations where user_id=uid)>=20000 then raise exception 'account_capacity'; end if;
    insert into tco_cloud.operations(user_id,operation_id,request_hash,revision,purpose,outcome)
    values(uid,p_operation,h,p_expected,'guest-merge','retired');
    result:='retired'; op_revision:=p_expected;
  else
    result:='missing'; op_revision:=null;
  end if;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,
    'operationId',p_operation,'expected',p_expected,'revision',a.revision,
    'replayFloor',a.replay_floor,'outcome',result,'operationRevision',op_revision);
end $$;

create or replace function public.tco_account_archive(p_expected bigint,p_digest text,p_confirmation boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; body text;
begin
  if uid is null then raise exception 'account_auth'; end if;
  if p_confirmation is distinct from true or p_expected is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'account_invalid'; end if;
  select * into a from tco_cloud.accounts where user_id=uid for update;
  if not found or a.conversion_state<>'active' then raise exception 'account_setup'; end if;
  if a.replay_floor=p_expected and a.last_archive_digest=p_digest then
    return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',a.revision,'replayFloor',a.replay_floor);
  end if;
  if a.revision<>p_expected then raise exception 'account_conflict'; end if;
  body:=tco_cloud.archive_snapshot();
  if encode(sha256(convert_to(body,'UTF8')),'hex')<>p_digest then raise exception 'account_conflict'; end if;
  -- Current records (including deletion tombstones), keys, initial receipt and manifest survive.
  -- Offline operations older than this floor must be re-reviewed, never silently replayed.
  delete from tco_cloud.history where user_id=uid;
  -- At the exact floor, a retired request could otherwise still satisfy CAS.
  -- Keep that fence until a later approved archive makes its expected revision stale.
  delete from tco_cloud.operations where user_id=uid and operation_id<>a.initialized_operation
    and (outcome='committed' or revision<p_expected);
  update tco_cloud.accounts set replay_floor=p_expected,last_archive_digest=p_digest,archived_at=clock_timestamp() where user_id=uid;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',a.revision,'replayFloor',p_expected);
end $$;

revoke all on function public.tco_account_push(bigint,uuid,jsonb,text),public.tco_account_archive(bigint,text,boolean),public.tco_account_merge_outcome(bigint,uuid,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.tco_account_push(bigint,uuid,jsonb,text),public.tco_account_archive(bigint,text,boolean),public.tco_account_merge_outcome(bigint,uuid,jsonb,boolean) to authenticated;
set local role postgres;
revoke tco_sync_executor from postgres granted by postgres;
revoke create on schema public from tco_sync_executor;
do $$ begin
  if exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole
    and member='postgres'::regrole and (set_option or inherit_option))
    or has_schema_privilege('tco_sync_executor','public','CREATE') then
    raise exception 'account_setup: temporary privileges not removed';
  end if;
end $$;
commit;
