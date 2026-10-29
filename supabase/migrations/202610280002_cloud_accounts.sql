-- v0.9.0 STAGED storage model. Apply only in a disposable test project until owner acceptance.
-- Server-readable records: NOT E2EE. Keeps all v0.8.x ciphertext/key tables intact.
-- Requires all three reviewed earlier migrations. Frontend rollout must remain OFF until verified.
begin;
do $$
begin
  if current_user <> 'postgres' or to_regprocedure('tco_sync.request_user_id()') is null then
    raise exception 'account_setup: postgres and v0.8.1 authorization migration required';
  end if;
  if exists(select 1 from pg_roles where rolname='tco_sync_executor' and
    (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'account_setup: unsafe executor';
  end if;
  if exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and
    ((member='postgres'::regrole and (set_option or inherit_option or grantor='postgres'::regrole))
      or member in ('anon'::regrole,'authenticated'::regrole,'authenticator'::regrole,'service_role'::regrole)))
    or exists(select 1 from pg_auth_members where member='tco_sync_executor'::regrole) then
    raise exception 'account_setup: unexpected executor membership';
  end if;
  if has_schema_privilege('tco_sync_executor','public','CREATE') then
    raise exception 'account_setup: unexpected schema CREATE';
  end if;
end $$;
create schema tco_cloud;
revoke all on schema tco_cloud from public,anon,authenticated,service_role;
grant usage on schema tco_cloud to tco_sync_executor;
create table tco_cloud.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null unique default pg_catalog.gen_random_uuid(),
  format integer not null default 2 check(format=2),
  revision bigint not null default 0 check(revision between 0 and 9007199254740000),
  consent_version integer not null check(consent_version=1),
  consent_at timestamptz not null default clock_timestamp(),
  legacy_revision bigint,
  initialized_operation uuid not null,
  conversion_state text not null default 'active' check(conversion_state in ('active','verifying')),
  migration_manifest jsonb check(octet_length(migration_manifest::text)<=1048576),
  verified_at timestamptz,
  replay_floor bigint not null default 0 check(replay_floor>=0),
  last_archive_digest text,
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  modified_at timestamptz not null default clock_timestamp()
);
create table tco_cloud.records (
  user_id uuid not null references tco_cloud.accounts(user_id) on delete cascade,
  collection text not null check(collection in ('aircraft','duties','journals','privacy')),
  record_id text not null check(length(record_id) between 1 and 512 and btrim(record_id)<>''),
  revision bigint not null check(revision between 1 and 9007199254740000),
  value jsonb, -- SQL NULL is a durable deletion tombstone, not an empty/missing snapshot.
  modified_at timestamptz not null default clock_timestamp(),
  primary key(user_id,collection,record_id),
  check(octet_length(value::text)<=262144)
);
create index cloud_incremental on tco_cloud.records(user_id,revision,collection,record_id);
create table tco_cloud.history (
  user_id uuid not null references tco_cloud.accounts(user_id) on delete cascade,
  operation_id uuid not null,
  collection text not null,
  record_id text not null,
  previous_revision bigint not null,
  replacement_revision bigint not null,
  value jsonb,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,operation_id,collection,record_id)
);
create index cloud_history_owner on tco_cloud.history(user_id,created_at);
create table tco_cloud.operations (
  user_id uuid not null references tco_cloud.accounts(user_id) on delete cascade,
  operation_id uuid not null,
  request_hash bytea not null check(octet_length(request_hash)=32),
  revision bigint not null,
  purpose text not null check(purpose in ('initialize','edit','guest-merge','legacy-migration','history-restore')),
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,operation_id)
);
-- No browser direct access. Only the reviewed archival RPC deletes owner-scoped history/receipts.
revoke all on all tables in schema tco_cloud from public,anon,authenticated,service_role;
grant select,insert,update on tco_cloud.accounts,tco_cloud.records to tco_sync_executor;
grant select,insert,delete on tco_cloud.history,tco_cloud.operations to tco_sync_executor;
do $$
declare relation text;
begin
  foreach relation in array array['accounts','records','history','operations'] loop
    execute format('alter table tco_cloud.%I enable row level security',relation);
    execute format('alter table tco_cloud.%I force row level security',relation);
    execute format('create policy owner_select on tco_cloud.%I for select to tco_sync_executor using(user_id=(select tco_sync.request_user_id()))',relation);
    execute format('create policy owner_insert on tco_cloud.%I for insert to tco_sync_executor with check(user_id=(select tco_sync.request_user_id()))',relation);
  end loop;
end $$;
create policy owner_update on tco_cloud.accounts for update to tco_sync_executor
using(user_id=(select tco_sync.request_user_id())) with check(user_id=(select tco_sync.request_user_id()));
create policy owner_update on tco_cloud.records for update to tco_sync_executor
using(user_id=(select tco_sync.request_user_id())) with check(user_id=(select tco_sync.request_user_id()));

create policy owner_archive_history on tco_cloud.history for delete to tco_sync_executor using(user_id=(select tco_sync.request_user_id()));
create policy owner_archive_operations on tco_cloud.operations for delete to tco_sync_executor using(user_id=(select tco_sync.request_user_id()));

-- Called only under the account row lock. No secrets/keys and no changes to current records.
create function tco_cloud.archive_snapshot() returns text
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
    'receipts',(select coalesce(jsonb_agg(jsonb_build_object('operationId',operation_id,'requestHash',encode(request_hash,'hex'),'revision',revision,'purpose',purpose,'createdAt',created_at) order by revision,operation_id),'[]'::jsonb) from tco_cloud.operations where user_id=uid))::text into result;
  if octet_length(result)>67108864 then raise exception 'account_capacity'; end if;
  return result;
end $$;

create function tco_cloud.safe_json(v jsonb, depth integer default 0) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare entry record; child jsonb;
begin
  if depth>32 then return false; end if;
  if jsonb_typeof(v)='object' then
    for entry in select * from jsonb_each(v) loop
      if entry.key in ('__proto__','constructor','prototype') or not tco_cloud.safe_json(entry.value,depth+1) then return false; end if;
    end loop;
  elsif jsonb_typeof(v)='array' then
    for child in select value from jsonb_array_elements(v) loop
      if not tco_cloud.safe_json(child,depth+1) then return false; end if;
    end loop;
  end if;
  return true;
end $$;
create function tco_cloud.valid_record(c text, id text, v jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text; leg jsonb; event jsonb; required text[]; allowed text[];
begin
  if c is null or c not in ('aircraft','duties','journals','privacy') or id is null or btrim(id)='' or length(id)>512 then return false; end if;
  if v is null or v='null'::jsonb then return c<>'privacy'; end if;
  if jsonb_typeof(v)<>'object' or octet_length(v::text)>262144 or not tco_cloud.safe_json(v) then return false; end if;
  if c='privacy' then
    if id<>'settings' or (select count(*) from jsonb_object_keys(v))<>6 then return false; end if;
    foreach k in array array['registration','flights','bay','gateTimes','statuses','disruptionNotes'] loop
      if jsonb_typeof(v->k) is distinct from 'boolean' then return false; end if;
    end loop;
    return true;
  end if;
  if v->>'id' is distinct from id or v->>'status' is null or v->>'status' not in ('Draft','Confirmed','Trashed') then return false; end if;
  required:=case c
    when 'duties' then array['id','date','start','end','status','notes']
    when 'journals' then array['id','date','title','status','situation','challenge','responsibility','actions','result','learning','dutyId','outcome','unit','contribution','evidence','verification']
    else array['id','date','dutyId','airline','variant','family','icao','handling','role','registration','bay','disruption','notes','status','createdAt','updatedAt'] end;
  allowed:=required || case c
    when 'duties' then array['workState','shiftType','leave','trashedAt','previousStatus']
    when 'journals' then array['tags','aircraftIds','originalDutyId']
    else array['arrival','departure','events','actualHandling','revisions','aircraftType','originalDutyId','previousStatus','trashedAt'] end;
  if exists(select 1 from jsonb_object_keys(v) key where not (key=any(allowed))) then return false; end if;
  foreach k in array array['aircraftType','originalDutyId','trashedAt','previousStatus','workState','shiftType','leave'] loop
    if v ? k and jsonb_typeof(v->k) is distinct from 'string' then return false; end if;
  end loop;
  if v ? 'previousStatus' and v->>'previousStatus' not in ('Draft','Confirmed','Trashed') then return false; end if;
  foreach k in array required loop
    if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>200000 then return false; end if;
  end loop;
  if v->>'date'<>'' then
    begin
      if to_char((v->>'date')::date,'YYYY-MM-DD')<>v->>'date' then return false; end if;
    exception when others then return false;
    end;
  end if;
  if c='duties' then
    if v ? 'leave' and v->>'leave' not in ('AL','SL') then return false; end if;
    if v ? 'workState' and v->>'workState' not in ('Planned','Worked') then return false; end if;
    foreach k in array array['start','end'] loop
      if v->>k<>'' and v->>k !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
    end loop;
    if v ? 'shiftType' and v->>'shiftType' not in ('Day','Evening','Night','Custom') then return false; end if;
    if v->>'leave'='AL' and (v->>'date'='' or v->>'start'<>'' or v->>'end'<>'') then return false; end if;
    if v->>'leave'='SL' and (v->>'date'='' or v->>'workState' is distinct from 'Planned' or v->>'start'='' or v->>'end'='' or v->>'start'=v->>'end') then return false; end if;
  elsif c='journals' then
    if v->>'status'='Trashed' or jsonb_typeof(v->'aircraftIds') is distinct from 'array' or jsonb_typeof(v->'tags') is distinct from 'array' then return false; end if;
    if exists(select 1 from jsonb_array_elements(v->'aircraftIds') x where jsonb_typeof(x)<>'string')
      or exists(select 1 from jsonb_array_elements(v->'tags') x where jsonb_typeof(x)<>'string') then return false; end if;
  else
    if v->>'handling' not in ('','Full Turnaround','Arrival Only','Departure Only')
      or v->>'role' not in ('','Primary Coordinator','Supporting Coordinator','Training / Observation')
      or v->>'disruption' not in ('Unknown','Normal','Disrupted')
      or jsonb_typeof(v->'actualHandling') is distinct from 'boolean'
      or jsonb_typeof(v->'events') is distinct from 'array' or jsonb_typeof(v->'revisions') is distinct from 'array' then return false; end if;
    foreach k in array array['arrival','departure'] loop
      leg:=v->k;
      if jsonb_typeof(leg) is distinct from 'object' then return false; end if;
      if exists(select 1 from unnest(array['flight','status','origin','scheduled','actual']) field where jsonb_typeof(leg->field) is distinct from 'string') then return false; end if;
      if leg->>'status' not in ('Not Recorded','Early','On Time','Delayed','Cancelled','Other') then return false; end if;
    end loop;
    for event in select value from jsonb_array_elements(v->'revisions') loop
      if jsonb_typeof(event) is distinct from 'object' or (select count(*) from jsonb_object_keys(event))<>2
        or jsonb_typeof(event->'at') is distinct from 'string' or jsonb_typeof(event->'summary') is distinct from 'string' then return false; end if;
    end loop;
    for event in select value from jsonb_array_elements(v->'events') loop
      if jsonb_typeof(event) is distinct from 'object' or exists(select 1 from unnest(array['id','category','involvement','resolution','notes']) field where jsonb_typeof(event->field) is distinct from 'string') then return false; end if;
    end loop;
  end if;
  return true;
end $$;

-- Entire post-transaction graph, not just the changed rows.
create function tco_cloud.validate_graph() returns void
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); n bigint; bytes bigint;
begin
  if uid is null then raise exception 'account_auth'; end if;
  select count(*),coalesce(sum(octet_length(value::text)),0) into n,bytes from tco_cloud.records where user_id=uid;
  if n>5000 or bytes>8388608 then raise exception 'account_capacity'; end if;
  if not exists(select 1 from tco_cloud.records where user_id=uid and collection='privacy' and record_id='settings' and value is not null) then raise exception 'account_invalid'; end if;
  if exists(
    select 1 from tco_cloud.records r where r.user_id=uid and r.collection in ('aircraft','journals') and r.value is not null
      and coalesce(r.value->>'dutyId','')<>'' and not exists(
        select 1 from tco_cloud.records d where d.user_id=uid and d.collection='duties' and d.record_id=r.value->>'dutyId' and d.value is not null)
  ) or exists(
    select 1 from tco_cloud.records r where r.user_id=uid and r.collection in ('aircraft','journals') and r.value is not null
      and coalesce(r.value->>'originalDutyId','')<>'' and not exists(
        select 1 from tco_cloud.records d where d.user_id=uid and d.collection='duties' and d.record_id=r.value->>'originalDutyId' and d.value is not null)
  ) or exists(
    select 1 from tco_cloud.records r cross join lateral jsonb_array_elements_text(r.value->'aircraftIds') a
    where r.user_id=uid and r.collection='journals' and r.value is not null and not exists(
      select 1 from tco_cloud.records x where x.user_id=uid and x.collection='aircraft' and x.record_id=a and x.value is not null)
  ) or exists(
    select 1 from tco_cloud.records r cross join lateral jsonb_array_elements(r.value->'events') e
    where r.user_id=uid and r.collection='aircraft' and r.value is not null and coalesce(e->>'journalId','')<>'' and not exists(
      select 1 from tco_cloud.records j where j.user_id=uid and j.collection='journals' and j.record_id=e->>'journalId' and j.value is not null)
  ) then raise exception 'account_invalid'; end if;
end $$;

-- Runs within old RPCs as their restricted executor. Old clients can still pull recovery ciphertext.
create function tco_cloud.guard_legacy_write() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user='tco_sync_executor' then
    if new.user_id is distinct from tco_sync.request_user_id() then raise exception 'account_auth'; end if;
    perform pg_advisory_xact_lock(hashtextextended('tco-cloud-account:'||new.user_id::text,0));
    if exists(select 1 from tco_cloud.accounts where user_id=new.user_id) then
      raise exception 'account_legacy_readonly';
    end if;
  end if;
  return new;
end $$;
create trigger cloud_fences_legacy_accounts before insert or update on tco_sync.accounts
for each row execute function tco_cloud.guard_legacy_write();
create trigger cloud_fences_legacy_records before insert or update on tco_sync.records
for each row execute function tco_cloud.guard_legacy_write();

revoke all on all functions in schema tco_cloud from public,anon,authenticated,service_role;
grant execute on all functions in schema tco_cloud to tco_sync_executor;
grant create on schema public to tco_sync_executor;
grant tco_sync_executor to postgres with admin false,inherit false,set true granted by postgres;
set local role tco_sync_executor;

create function public.tco_account_pull(p_cursor bigint default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; rows jsonb; legacy bigint;
begin
  if uid is null then raise exception 'account_auth'; end if;
  if p_cursor is null or p_cursor<0 then raise exception 'account_invalid'; end if;
  select revision into legacy from tco_sync.accounts where user_id=uid;
  select * into a from tco_cloud.accounts where user_id=uid for share;
  if not found then
    if p_cursor<>0 then raise exception 'account_invalid'; end if;
    return jsonb_build_object('version',2,'userId',uid,'workspaceId',null,'revision',0,'established',legacy is not null,'legacyRevision',legacy,'records','[]'::jsonb,'count',0,'total',0,'features',jsonb_build_array('legacy-manifest-v1','capacity-v1','manual-archive-v1'));
  end if;
  if p_cursor>a.revision then raise exception 'account_invalid'; end if;
  if p_cursor>0 and p_cursor<a.replay_floor then raise exception 'account_archived_review'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('collection',collection,'id',record_id,'value',value,'revision',revision) order by revision,collection,record_id),'[]'::jsonb) into rows
  from tco_cloud.records where user_id=uid and revision>p_cursor;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',a.revision,'established',true,'legacyRevision',a.legacy_revision,'records',rows,'count',jsonb_array_length(rows),'total',(select count(*) from tco_cloud.records where user_id=uid),'conversionState',a.conversion_state,'replayFloor',a.replay_floor,'features',jsonb_build_array('legacy-manifest-v1','capacity-v1','manual-archive-v1'),'snapshotDigest',case when p_cursor=0 then encode(sha256(convert_to(rows::text,'UTF8')),'hex') else null end,'capacity',jsonb_build_object('historyRows',(select count(*) from tco_cloud.history where user_id=uid),'historyBytes',(select coalesce(sum(octet_length(value::text)),0) from tco_cloud.history where user_id=uid),'receipts',(select count(*) from tco_cloud.operations where user_id=uid)));
end $$;

-- Separate initialization establishes authoritative onboarding state even for zero aircraft.
-- Existing legacy accounts require explicit model-change consent and a checked legacy revision.
create function public.tco_account_initialize(p_operation uuid,p_consent boolean,p_records jsonb,p_legacy_revision bigint default null,p_manifest jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; legacy bigint; h bytea; prior tco_cloud.operations; row jsonb; entry jsonb; source_count bigint;
begin
  if uid is null then raise exception 'account_auth'; end if;
  if p_consent is distinct from true or p_operation is null or p_records is null or jsonb_typeof(p_records)<>'array' then raise exception 'account_invalid'; end if;
  if jsonb_array_length(p_records) not between 1 and 5000 or octet_length(p_records::text)>8388608 then raise exception 'account_capacity'; end if;
  -- Same order as old push: legacy row first, then per-account initialization lock.
  select revision into legacy from tco_sync.accounts where user_id=uid for update;
  perform pg_advisory_xact_lock(hashtextextended('tco-cloud-account:'||uid::text,0));
  h:=sha256(convert_to(jsonb_build_object('records',p_records,'legacyRevision',p_legacy_revision,'consent',p_consent,'manifest',p_manifest)::text,'UTF8'));
  select * into a from tco_cloud.accounts where user_id=uid for update;
  if found then
    select * into prior from tco_cloud.operations where user_id=uid and operation_id=p_operation;
    if not found or prior.request_hash<>h or a.initialized_operation<>p_operation then raise exception 'account_conflict'; end if;
    return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',prior.revision,'operationId',p_operation);
  end if;
  -- Re-read after the advisory lock: another old client may have initialized while no row existed.
  select revision into legacy from tco_sync.accounts where user_id=uid for update;
  if legacy is distinct from p_legacy_revision then raise exception 'account_legacy_review'; end if;
  -- Manifest proves coverage/identity of encrypted rows, NOT plaintext equivalence.
  -- AEAD decryption, independent backup and human approval are client responsibilities.
  if legacy is not null or p_manifest is not null then
    select count(*) into source_count from tco_sync.records where user_id=uid;
    if p_manifest is null or jsonb_typeof(p_manifest)<>'object' or octet_length(p_manifest::text)>1048576
      or p_manifest->>'version' is distinct from '1' or p_manifest->>'operationId' is distinct from p_operation::text
      or p_manifest->>'revision' is distinct from legacy::text
      or p_manifest->>'recordCount' is distinct from source_count::text
      or coalesce(p_manifest->>'backupDigest','') !~ '^[0-9a-f]{64}$'
      or (p_manifest->>'localVaultDigest' is not null and p_manifest->>'localVaultDigest' !~ '^[0-9a-f]{64}$')
      or p_manifest->>'keyId' is distinct from (select key_envelope->>'keyId' from tco_sync.accounts where user_id=uid)
      or jsonb_typeof(p_manifest->'entries') is distinct from 'array'
      or jsonb_array_length(p_manifest->'entries')<>source_count then raise exception 'account_legacy_review'; end if;
    if (select count(distinct value->>'opaqueId') from jsonb_array_elements(p_manifest->'entries'))<>source_count
      or (select count(distinct jsonb_build_array(value->>'collection',value->>'id')) from jsonb_array_elements(p_manifest->'entries'))<>source_count then raise exception 'account_legacy_review'; end if;
    for entry in select value from jsonb_array_elements(p_manifest->'entries') loop
      if not exists(select 1 from tco_sync.records where user_id=uid and record_id=entry->>'opaqueId' and revision::text=entry->>'revision')
        or not exists(select 1 from jsonb_array_elements(p_records) r where r->>'collection'=entry->>'collection' and r->>'id'=entry->>'id') then raise exception 'account_legacy_review'; end if;
    end loop;
  end if;
  insert into tco_cloud.accounts(user_id,consent_version,legacy_revision,initialized_operation,conversion_state,migration_manifest,verified_at)
  values(uid,1,legacy,p_operation,case when legacy is not null or p_manifest is not null then 'verifying' else 'active' end,p_manifest,case when legacy is null and p_manifest is null then clock_timestamp() else null end) returning * into a;
  if (select count(distinct jsonb_build_array(value->>'collection',value->>'id')) from jsonb_array_elements(p_records))<>jsonb_array_length(p_records) then raise exception 'account_invalid'; end if;
  for row in select value from jsonb_array_elements(p_records) loop
    if jsonb_typeof(row)<>'object' or (select count(*) from jsonb_object_keys(row))<>3
      or not tco_cloud.valid_record(row->>'collection',row->>'id',row->'value') then raise exception 'account_invalid'; end if;
    insert into tco_cloud.records(user_id,collection,record_id,revision,value)
    values(uid,row->>'collection',row->>'id',1,nullif(row->'value','null'::jsonb));
  end loop;
  perform tco_cloud.validate_graph();
  update tco_cloud.accounts set revision=1,modified_at=clock_timestamp() where user_id=uid;
  insert into tco_cloud.operations(user_id,operation_id,request_hash,revision,purpose)
  values(uid,p_operation,h,1,case when legacy is null and p_manifest is null then 'initialize' else 'legacy-migration' end);
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',1,'operationId',p_operation);
end $$;

create function public.tco_account_push(p_expected bigint,p_operation uuid,p_records jsonb,p_purpose text default 'edit') returns jsonb
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


-- Confirms that the client independently read the exact current destination.
-- This is an authenticated client attestation, not a server proof of legacy decryption.
create function public.tco_account_verify_conversion(p_operation uuid,p_expected bigint,p_digest text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; rows jsonb;
begin
  if uid is null then raise exception 'account_auth'; end if;
  select * into a from tco_cloud.accounts where user_id=uid for update;
  if not found or a.initialized_operation is distinct from p_operation or a.revision is distinct from p_expected or a.migration_manifest is null then raise exception 'account_legacy_review'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('collection',collection,'id',record_id,'value',value,'revision',revision) order by revision,collection,record_id),'[]'::jsonb) into rows from tco_cloud.records where user_id=uid;
  if p_digest is distinct from encode(sha256(convert_to(rows::text,'UTF8')),'hex') then raise exception 'account_legacy_review'; end if;
  update tco_cloud.accounts set conversion_state='active',verified_at=clock_timestamp() where user_id=uid;
end $$;
revoke all on function public.tco_account_verify_conversion(uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.tco_account_verify_conversion(uuid,bigint,text) to authenticated;

-- Export alone changes nothing. The application must download and reread exact bytes,
-- then request explicit archival. The database cannot attest that a user saved a file.
create function public.tco_account_prepare_archive() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; body text;
begin
  if uid is null then raise exception 'account_auth'; end if;
  select * into a from tco_cloud.accounts where user_id=uid for share;
  if not found then raise exception 'account_setup'; end if;
  body:=tco_cloud.archive_snapshot();
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',a.revision,
    'digest',encode(sha256(convert_to(body,'UTF8')),'hex'),'text',body);
end $$;
create function public.tco_account_archive(p_expected bigint,p_digest text,p_confirmation boolean) returns jsonb
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
  delete from tco_cloud.operations where user_id=uid and operation_id<>a.initialized_operation;
  update tco_cloud.accounts set replay_floor=p_expected,last_archive_digest=p_digest,archived_at=clock_timestamp() where user_id=uid;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',a.revision,'replayFloor',p_expected);
end $$;
revoke all on function public.tco_account_prepare_archive(),public.tco_account_archive(bigint,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.tco_account_prepare_archive(),public.tco_account_archive(bigint,text,boolean) to authenticated;

-- History access stays account-scoped and bounded. Restoring a version is a NEW reviewed CAS write.
create function public.tco_account_history(p_collection text,p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tco_sync.request_user_id(); a tco_cloud.accounts; result jsonb;
begin
  if uid is null then raise exception 'account_auth'; end if;
  if p_collection is null or p_collection not in ('aircraft','duties','journals','privacy') or p_id is null or length(p_id)>512 then raise exception 'account_invalid'; end if;
  select * into a from tco_cloud.accounts where user_id=uid for share;
  if not found or a.conversion_state<>'active' then raise exception 'account_setup'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('operationId',operation_id,'collection',collection,'id',record_id,
    'previousRevision',previous_revision,'replacementRevision',replacement_revision,'value',value,'createdAt',created_at)
    order by replacement_revision desc),'[]'::jsonb) into result
  from (select operation_id,collection,record_id,previous_revision,replacement_revision,value,created_at
    from tco_cloud.history where user_id=uid and collection=p_collection and record_id=p_id order by replacement_revision desc limit 100) h;
  return jsonb_build_object('version',2,'userId',uid,'workspaceId',a.workspace_id,'revision',a.revision,
    'replayFloor',a.replay_floor,'archivedAt',a.archived_at,'records',result);
end $$;
revoke all on function public.tco_account_pull(bigint),public.tco_account_initialize(uuid,boolean,jsonb,bigint,jsonb),public.tco_account_push(bigint,uuid,jsonb,text),public.tco_account_history(text,text) from public,anon,authenticated,service_role;
grant execute on function public.tco_account_pull(bigint),public.tco_account_initialize(uuid,boolean,jsonb,bigint,jsonb),public.tco_account_push(bigint,uuid,jsonb,text),public.tco_account_history(text,text) to authenticated;
set local role postgres;
revoke tco_sync_executor from postgres granted by postgres;
revoke create on schema public from tco_sync_executor;
do $$
begin
  if exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and member='postgres'::regrole and (set_option or inherit_option))
    or has_schema_privilege('tco_sync_executor','public','CREATE') or has_schema_privilege('tco_sync_executor','tco_cloud','CREATE') then
    raise exception 'account_setup: temporary privileges not removed';
  end if;
end $$;
commit;
