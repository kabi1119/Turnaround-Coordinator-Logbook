-- v0.8.2 source correction: run RPC replacement briefly as its restricted owner, then clean up.
-- v0.8.1 additive correction. Apply AFTER 202610270001_encrypted_sync.sql.
-- Preserve cloud rows/keys. Source permissions corrected in v0.8.2 without rewriting Git history.
-- Supabase KB: custom executor roles cannot rely on postgres granting auth schema USAGE.
-- Identity comes only from request settings installed by JWT-validating PostgREST.
begin;
do $$ begin
  if current_user<>'postgres' then raise exception 'Run sync migrations as the postgres migration role'; end if;
end $$;
do $$
declare executor oid; count_ok integer;
begin
  select oid into executor from pg_catalog.pg_roles where rolname='tco_sync_executor';
  if executor is null or pg_catalog.to_regclass('tco_sync.accounts') is null
    or pg_catalog.to_regclass('tco_sync.records') is null then
    raise exception 'v0.8.0 sync migration is required; do not create or reset cloud data';
  end if;
  if exists(select 1 from pg_catalog.pg_roles where oid=executor and
    (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'Unsafe sync executor attributes; review permissions before continuing';
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.member
    where (m.roleid=executor and r.rolname in ('anon','authenticated','authenticator','service_role')) or m.member=executor) then
    raise exception 'Unsafe sync executor membership; do not grant gateway roles executor access';
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members where roleid=executor and member='postgres'::regrole
    and grantor='postgres'::regrole) then
    raise exception 'Existing postgres-issued executor membership requires owner review before migration';
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members where roleid=executor and member='postgres'::regrole
    and (set_option or inherit_option)) then
    raise exception 'Existing executor SET/INHERIT access requires owner review before migration';
  end if;
  if pg_catalog.has_schema_privilege(executor,'tco_sync','CREATE')
    or pg_catalog.has_schema_privilege(executor,'public','CREATE') then
    raise exception 'Sync executor must not have schema CREATE (including through PUBLIC); review grants';
  end if;
  select count(*) into count_ok from pg_catalog.pg_class where oid in
    (pg_catalog.to_regclass('tco_sync.accounts'),pg_catalog.to_regclass('tco_sync.records'))
    and relrowsecurity and relforcerowsecurity and relowner<>executor;
  if count_ok<>2 then raise exception 'Expected forced-RLS tables owned independently of executor'; end if;
  if (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('tco_sync_pull','tco_sync_initialize','tco_sync_push'))<>3 then
    raise exception 'Unexpected sync RPC overload; review signatures before continuing';
  end if;
  select count(*) into count_ok from pg_catalog.pg_proc where oid in
    (pg_catalog.to_regprocedure('public.tco_sync_pull(bigint)'),
     pg_catalog.to_regprocedure('public.tco_sync_initialize(jsonb)'),
     pg_catalog.to_regprocedure('public.tco_sync_push(bigint,uuid,jsonb)'))
    and proowner=executor and prosecdef;
  if count_ok<>3 then raise exception 'Expected v0.8.0 RPC ownership; review rather than using a privileged RPC owner'; end if;
end $$;

create or replace function tco_sync.request_user_id() returns uuid
language plpgsql stable security invoker set search_path = '' as $$
declare
  claims jsonb;
  subject text;
  legacy_subject text := nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'');
  legacy_role text := nullif(pg_catalog.current_setting('request.jwt.claim.role',true),'');
  legacy_anonymous text := nullif(pg_catalog.current_setting('request.jwt.claim.is_anonymous',true),'');
begin
  claims := nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb;
  if claims is not null and pg_catalog.jsonb_typeof(claims)<>'object' then return null; end if;
  if coalesce(claims->>'role',legacy_role,'')<>'authenticated'
    or (claims->>'role' is not null and legacy_role is not null and claims->>'role'<>legacy_role)
    or coalesce(claims->'is_anonymous','false'::jsonb)<>'false'::jsonb
    or (legacy_anonymous is not null and legacy_anonymous<>'false') then return null; end if;
  subject := coalesce(nullif(claims->>'sub',''),legacy_subject);
  if subject is null then return null; end if;
  if legacy_subject is not null and claims->>'sub' is not null
    and legacy_subject::uuid<>(claims->>'sub')::uuid then return null; end if;
  return subject::uuid;
exception when invalid_text_representation then return null;
end $$;
alter function tco_sync.request_user_id() owner to postgres;
revoke all on function tco_sync.request_user_id() from public, anon, authenticated, service_role;
grant execute on function tco_sync.request_user_id() to tco_sync_executor;
revoke all on schema tco_sync from public, anon, authenticated;
grant usage on schema tco_sync to tco_sync_executor;
revoke all on tco_sync.accounts, tco_sync.records from public, anon, authenticated;

alter policy accounts_select on tco_sync.accounts using (user_id=(select tco_sync.request_user_id()));
alter policy accounts_insert on tco_sync.accounts with check (user_id=(select tco_sync.request_user_id()));
alter policy accounts_update on tco_sync.accounts using (user_id=(select tco_sync.request_user_id())) with check (user_id=(select tco_sync.request_user_id()));
alter policy records_select on tco_sync.records using (user_id=(select tco_sync.request_user_id()));
alter policy records_insert on tco_sync.records with check (user_id=(select tco_sync.request_user_id()));
alter policy records_update on tco_sync.records using (user_id=(select tco_sync.request_user_id())) with check (user_id=(select tco_sync.request_user_id()));

-- CREATE OR REPLACE requires schema CREATE and the existing owning role, not merely ADMIN membership.
grant create on schema public to tco_sync_executor;
grant tco_sync_executor to postgres with admin false, inherit false, set true granted by postgres;
set local role tco_sync_executor;

create or replace function public.tco_sync_pull(p_cursor bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a tco_sync.accounts; result jsonb;
begin
  if tco_sync.request_user_id() is null then raise exception 'sync_auth'; end if;
  if p_cursor is null or p_cursor < 0 then raise exception 'sync_invalid'; end if;
  -- Hold the account lock while producing a coherent multi-record snapshot.
  select * into a from tco_sync.accounts where user_id=tco_sync.request_user_id() for share;
  if not found then
    if p_cursor <> 0 then raise exception 'sync_invalid'; end if;
    return jsonb_build_object('version',1,'userId',tco_sync.request_user_id(),'revision',0,'envelope',null,'records','[]'::jsonb,'count',0,'total',0);
  end if;
  if p_cursor > a.revision or a.format <> 1 then raise exception 'sync_invalid'; end if;
  select coalesce(jsonb_agg(envelope order by revision,record_id),'[]'::jsonb) into result from tco_sync.records where user_id=tco_sync.request_user_id() and revision>p_cursor;
  return jsonb_build_object('version',a.format,'userId',tco_sync.request_user_id(),'revision',a.revision,'envelope',a.key_envelope,'records',result,'count',jsonb_array_length(result),'total',(select count(*) from tco_sync.records where user_id=tco_sync.request_user_id()));
end $$;

create or replace function public.tco_sync_initialize(p_envelope jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
    if tco_sync.request_user_id() is null then raise exception 'sync_auth'; end if;
  if p_envelope is null or jsonb_typeof(p_envelope) <> 'object' or octet_length(p_envelope::text)>4096
    or (select count(*) from jsonb_object_keys(p_envelope)) <> 7
    or p_envelope->>'version' is distinct from '1' or p_envelope->>'userId' is distinct from tco_sync.request_user_id()::text
    or p_envelope->>'iterations' is distinct from '600000'
    or coalesce(p_envelope->>'keyId','') !~ '^[0-9a-f-]{36}$'
    or coalesce(p_envelope->>'salt','') !~ '^[A-Za-z0-9+/]{22}==$'
    or coalesce(p_envelope->>'iv','') !~ '^[A-Za-z0-9+/]{16}$'
    or coalesce(p_envelope->>'ciphertext','') !~ '^[A-Za-z0-9+/]{64}$' then raise exception 'sync_invalid'; end if;
  insert into tco_sync.accounts(user_id,key_envelope) values(tco_sync.request_user_id(),p_envelope);
  -- An existing key can never be replaced through this API.
end $$;

create or replace function public.tco_sync_push(p_expected bigint, p_operation uuid, p_records jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare a tco_sync.accounts; e jsonb; target bigint; n bigint; total bigint;
begin
    if tco_sync.request_user_id() is null then raise exception 'sync_auth'; end if;
  if p_operation is null or p_expected is null or p_expected<0 or p_records is null or jsonb_typeof(p_records)<>'array'
    or jsonb_array_length(p_records) not between 1 and 5000 or octet_length(p_records::text)>8388608 then raise exception 'sync_capacity'; end if;
  select * into a from tco_sync.accounts where user_id=tco_sync.request_user_id() for update;
  if not found then raise exception 'sync_setup'; end if;
  if a.revision<>p_expected then raise exception 'sync_conflict'; end if;
  if a.format<>1 then raise exception 'sync_invalid'; end if;
  target=a.revision+1;
  if (select count(distinct value->>'recordId') from jsonb_array_elements(p_records))<>jsonb_array_length(p_records) then raise exception 'sync_invalid'; end if;
  for e in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(e)<>'object' or (select count(*) from jsonb_object_keys(e))<>7
      or e->>'version' is distinct from '1' or e->>'userId' is distinct from tco_sync.request_user_id()::text
      or e->>'keyId' is distinct from a.key_envelope->>'keyId' or e->>'revision' is distinct from target::text
      or coalesce(e->>'recordId','') !~ '^[0-9a-f]{64}$'
      or coalesce(e->>'iv','') !~ '^[A-Za-z0-9+/]{16}$'
      or length(coalesce(e->>'ciphertext','')) not between 24 and 349528
      or coalesce(e->>'ciphertext','') !~ '^[A-Za-z0-9+/]+={0,2}$'
      then raise exception 'sync_invalid'; end if;
    insert into tco_sync.records(user_id,record_id,revision,envelope) values(tco_sync.request_user_id(),e->>'recordId',target,e)
    on conflict(user_id,record_id) do update set revision=excluded.revision,envelope=excluded.envelope,modified_at=clock_timestamp();
  end loop;
  select count(*),coalesce(sum(octet_length(envelope::text)),0) into n,total from tco_sync.records where user_id=tco_sync.request_user_id();
  if n>5000 or total>8388608 then raise exception 'sync_capacity'; end if;
  update tco_sync.accounts set revision=target,last_operation=p_operation,modified_at=clock_timestamp() where user_id=tco_sync.request_user_id();
  return target;
end $$;
-- CREATE OR REPLACE preserves the restricted v0.8.0 function owner and signatures.
revoke all on function public.tco_sync_pull(bigint), public.tco_sync_initialize(jsonb), public.tco_sync_push(bigint,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.tco_sync_pull(bigint), public.tco_sync_initialize(jsonb), public.tco_sync_push(bigint,uuid,jsonb) to authenticated;
set local role postgres;
-- Remove only the temporary grant issued by this migration, not bootstrap ADMIN membership.
revoke tco_sync_executor from postgres granted by postgres;
revoke create on schema public from tco_sync_executor;
do $$ begin
  if exists(select 1 from pg_catalog.pg_auth_members where roleid='tco_sync_executor'::regrole
    and member='postgres'::regrole and (set_option or inherit_option)) then
    raise exception 'Temporary executor SET/INHERIT permission was not fully removed';
  end if;
  if pg_catalog.has_schema_privilege('tco_sync_executor','public','CREATE') then
    raise exception 'Temporary executor schema CREATE permission was not fully removed';
  end if;
end $$;
commit;
