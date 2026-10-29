-- v0.9.0 mixed-queue recovery. Apply after 202610290001_guest_merge_recovery.sql.
-- Only exact-payload Account-edit receipts are inspected/retired; no record or key deletion.
begin;
do $$ begin
  if current_user<>'postgres' or to_regclass('tco_cloud.operations') is null
    or not exists(select 1 from pg_attribute where attrelid='tco_cloud.operations'::regclass and attname='outcome')
    then raise exception 'account_setup: Guest recovery migration required'; end if;
  if exists(select 1 from pg_roles where rolname='tco_sync_executor' and
    (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
    or exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and
      ((member='postgres'::regrole and (set_option or inherit_option or grantor='postgres'::regrole))
       or member in ('anon'::regrole,'authenticated'::regrole,'authenticator'::regrole,'service_role'::regrole)))
    or exists(select 1 from pg_auth_members where member='tco_sync_executor'::regrole)
    or has_schema_privilege('tco_sync_executor','public','CREATE') then
    raise exception 'account_setup: unsafe executor privileges'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='tco_cloud' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity
    and c.relowner<>'tco_sync_executor'::regrole)<>4 then
    raise exception 'account_setup: forced RLS required'; end if;
end $$;
grant create on schema public to tco_sync_executor;
grant tco_sync_executor to postgres with admin false,inherit false,set true granted by postgres;
set local role tco_sync_executor;
create or replace function public.tco_account_edit_outcome(p_expected bigint,p_operation uuid,p_records jsonb,p_retire boolean default false) returns jsonb
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
  h:=sha256(convert_to(jsonb_build_object('expected',p_expected,'records',p_records,'purpose','edit')::text,'UTF8'));
  select * into prior from tco_cloud.operations where user_id=uid and operation_id=p_operation;
  if found then
    if prior.purpose<>'edit' or prior.request_hash<>h then raise exception 'account_conflict'; end if;
    result:=prior.outcome; op_revision:=prior.revision;
  elsif p_expected<a.replay_floor then
    -- Its receipt may have been manually archived. Never claim it did not commit.
    result:='expired'; op_revision:=null;
  elsif p_retire then
    if (select count(*) from tco_cloud.operations where user_id=uid)>=20000 then raise exception 'account_capacity'; end if;
    insert into tco_cloud.operations(user_id,operation_id,request_hash,revision,purpose,outcome)
    values(uid,p_operation,h,p_expected,'edit','retired');
    result:='retired'; op_revision:=p_expected;
  else
    result:='missing'; op_revision:=null;
  end if;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,
    'operationId',p_operation,'expected',p_expected,'revision',a.revision,
    'replayFloor',a.replay_floor,'outcome',result,'operationRevision',op_revision);
end $$;
revoke all on function public.tco_account_edit_outcome(bigint,uuid,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.tco_account_edit_outcome(bigint,uuid,jsonb,boolean) to authenticated;
set local role postgres;
revoke tco_sync_executor from postgres granted by postgres;
revoke create on schema public from tco_sync_executor;
do $$ begin
  if exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole
    and member='postgres'::regrole and (set_option or inherit_option))
    or has_schema_privilege('tco_sync_executor','public','CREATE') then
    raise exception 'account_setup: temporary privileges not removed'; end if;
end $$;
commit;
