-- v0.8.2 source correction: temporary ownership-transfer privileges; existing installations must not rerun table creation.
-- Apply manually after review. No plaintext operational columns. No existing profiles changes.
-- The NOLOGIN/NOBYPASSRLS executor permits CAS-only API writes without granting
-- unrestricted table DML to browser roles. Every function derives ownership from auth.uid().
begin;
do $$ begin
  if current_user<>'postgres' then raise exception 'Run sync migrations as the postgres migration role'; end if;
end $$;
create role tco_sync_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema tco_sync;
revoke all on schema tco_sync from public, anon, authenticated;
grant usage on schema tco_sync to tco_sync_executor;
create table tco_sync.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  format integer not null default 1 check (format = 1),
  key_envelope jsonb not null check (octet_length(key_envelope::text) <= 4096),
  revision bigint not null default 0 check (revision between 0 and 9007199254740000),
  last_operation uuid,
  modified_at timestamptz not null default clock_timestamp()
);
create table tco_sync.records (
  user_id uuid not null references tco_sync.accounts(user_id) on delete cascade,
  record_id text not null check (record_id ~ '^[0-9a-f]{64}$'),
  revision bigint not null check (revision between 1 and 9007199254740000),
  envelope jsonb not null check (octet_length(envelope::text) <= 360000),
  modified_at timestamptz not null default clock_timestamp(),
  primary key (user_id, record_id)
);
create index sync_incremental on tco_sync.records(user_id, revision);
alter table tco_sync.accounts enable row level security;
alter table tco_sync.accounts force row level security;
alter table tco_sync.records enable row level security;
alter table tco_sync.records force row level security;
revoke all on tco_sync.accounts, tco_sync.records from public, anon, authenticated;
grant select, insert, update on tco_sync.accounts, tco_sync.records to tco_sync_executor;
-- Physical DELETE is intentionally ungranted. Encrypted tombstones retain IDs/revisions indefinitely.
create policy accounts_select on tco_sync.accounts for select to tco_sync_executor using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy accounts_insert on tco_sync.accounts for insert to tco_sync_executor with check (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy accounts_update on tco_sync.accounts for update to tco_sync_executor using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy records_select on tco_sync.records for select to tco_sync_executor using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy records_insert on tco_sync.records for insert to tco_sync_executor with check (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy records_update on tco_sync.records for update to tco_sync_executor using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.tco_sync_pull(p_cursor bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a tco_sync.accounts; result jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' then raise exception 'sync_auth'; end if;
  if p_cursor is null or p_cursor < 0 then raise exception 'sync_invalid'; end if;
  -- Hold the account lock while producing a coherent multi-record snapshot.
  select * into a from tco_sync.accounts where user_id=auth.uid() for share;
  if not found then
    if p_cursor <> 0 then raise exception 'sync_invalid'; end if;
    return jsonb_build_object('version',1,'userId',auth.uid(),'revision',0,'envelope',null,'records','[]'::jsonb,'count',0,'total',0);
  end if;
  if p_cursor > a.revision or a.format <> 1 then raise exception 'sync_invalid'; end if;
  select coalesce(jsonb_agg(envelope order by revision,record_id),'[]'::jsonb) into result from tco_sync.records where user_id=auth.uid() and revision>p_cursor;
  return jsonb_build_object('version',a.format,'userId',auth.uid(),'revision',a.revision,'envelope',a.key_envelope,'records',result,'count',jsonb_array_length(result),'total',(select count(*) from tco_sync.records where user_id=auth.uid()));
end $$;

create function public.tco_sync_initialize(p_envelope jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' then raise exception 'sync_auth'; end if;
  if p_envelope is null or jsonb_typeof(p_envelope) <> 'object' or octet_length(p_envelope::text)>4096
    or (select count(*) from jsonb_object_keys(p_envelope)) <> 7
    or p_envelope->>'version' is distinct from '1' or p_envelope->>'userId' is distinct from auth.uid()::text
    or p_envelope->>'iterations' is distinct from '600000'
    or coalesce(p_envelope->>'keyId','') !~ '^[0-9a-f-]{36}$'
    or coalesce(p_envelope->>'salt','') !~ '^[A-Za-z0-9+/]{22}==$'
    or coalesce(p_envelope->>'iv','') !~ '^[A-Za-z0-9+/]{16}$'
    or coalesce(p_envelope->>'ciphertext','') !~ '^[A-Za-z0-9+/]{64}$' then raise exception 'sync_invalid'; end if;
  insert into tco_sync.accounts(user_id,key_envelope) values(auth.uid(),p_envelope);
  -- An existing key can never be replaced through this API.
end $$;

create function public.tco_sync_push(p_expected bigint, p_operation uuid, p_records jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare a tco_sync.accounts; e jsonb; target bigint; n bigint; total bigint;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' then raise exception 'sync_auth'; end if;
  if p_operation is null or p_expected is null or p_expected<0 or p_records is null or jsonb_typeof(p_records)<>'array'
    or jsonb_array_length(p_records) not between 1 and 5000 or octet_length(p_records::text)>8388608 then raise exception 'sync_capacity'; end if;
  select * into a from tco_sync.accounts where user_id=auth.uid() for update;
  if not found then raise exception 'sync_setup'; end if;
  if a.revision<>p_expected then raise exception 'sync_conflict'; end if;
  if a.format<>1 then raise exception 'sync_invalid'; end if;
  target=a.revision+1;
  if (select count(distinct value->>'recordId') from jsonb_array_elements(p_records))<>jsonb_array_length(p_records) then raise exception 'sync_invalid'; end if;
  for e in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(e)<>'object' or (select count(*) from jsonb_object_keys(e))<>7
      or e->>'version' is distinct from '1' or e->>'userId' is distinct from auth.uid()::text
      or e->>'keyId' is distinct from a.key_envelope->>'keyId' or e->>'revision' is distinct from target::text
      or coalesce(e->>'recordId','') !~ '^[0-9a-f]{64}$'
      or coalesce(e->>'iv','') !~ '^[A-Za-z0-9+/]{16}$'
      or length(coalesce(e->>'ciphertext','')) not between 24 and 349528
      or coalesce(e->>'ciphertext','') !~ '^[A-Za-z0-9+/]+={0,2}$'
      then raise exception 'sync_invalid'; end if;
    insert into tco_sync.records(user_id,record_id,revision,envelope) values(auth.uid(),e->>'recordId',target,e)
    on conflict(user_id,record_id) do update set revision=excluded.revision,envelope=excluded.envelope,modified_at=clock_timestamp();
  end loop;
  select count(*),coalesce(sum(octet_length(envelope::text)),0) into n,total from tco_sync.records where user_id=auth.uid();
  if n>5000 or total>8388608 then raise exception 'sync_capacity'; end if;
  update tco_sync.accounts set revision=target,last_operation=p_operation,modified_at=clock_timestamp() where user_id=auth.uid();
  return target;
end $$;
-- Restrict function ownership to a role with neither BYPASSRLS nor table ownership.
grant usage, create on schema public to tco_sync_executor;
grant tco_sync_executor to postgres with admin false, inherit false, set true granted by postgres;
alter function public.tco_sync_pull(bigint) owner to tco_sync_executor;
alter function public.tco_sync_initialize(jsonb) owner to tco_sync_executor;
alter function public.tco_sync_push(bigint,uuid,jsonb) owner to tco_sync_executor;
set local role tco_sync_executor;
revoke all on function public.tco_sync_pull(bigint), public.tco_sync_initialize(jsonb), public.tco_sync_push(bigint,uuid,jsonb) from public, anon, authenticated;
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
