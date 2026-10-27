-- Read-only catalog verification after all three corrected migrations.
-- Run as the project owner. No operational data or Auth records are read or changed.
begin;
do $$
declare r text; t text; found integer;
begin
  if (select rolsuper from pg_roles where rolname='postgres') then
    raise exception 'Use a non-superuser postgres test identity; superuser would hide SET ROLE failures';
  end if;
  if pg_has_role('postgres','tco_sync_executor','SET') or pg_has_role('postgres','tco_sync_executor','USAGE') then
    raise exception 'postgres retains executor SET or inherited privileges';
  end if;
  if exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and member='postgres'::regrole and grantor='postgres'::regrole) then
    raise exception 'Temporary postgres-issued membership was not removed';
  end if;
  if has_schema_privilege('tco_sync_executor','public','CREATE') or has_schema_privilege('tco_sync_executor','tco_sync','CREATE') then
    raise exception 'Executor retains schema CREATE';
  end if;
  if exists(select 1 from pg_roles where rolname='tco_sync_executor' and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)) then
    raise exception 'Executor role is not restricted';
  end if;
  select count(*) into found from pg_class where oid in ('tco_sync.accounts'::regclass,'tco_sync.records'::regclass)
    and relrowsecurity and relforcerowsecurity and relowner<>'tco_sync_executor'::regrole;
  if found<>2 then raise exception 'Forced RLS or independent table ownership missing'; end if;
  select count(*) into found from pg_proc where oid in ('public.tco_sync_pull(bigint)'::regprocedure,'public.tco_sync_initialize(jsonb)'::regprocedure,'public.tco_sync_push(bigint,uuid,jsonb)'::regprocedure)
    and proowner='tco_sync_executor'::regrole and prosecdef and proconfig @> array['search_path=""'];
  if found<>3 then raise exception 'RPC ownership, definer mode or search_path changed'; end if;
  if (select prosecdef or proowner<>'postgres'::regrole from pg_proc where oid='tco_sync.request_user_id()'::regprocedure) then
    raise exception 'Identity helper owner or invoker mode changed';
  end if;
  foreach r in array array['anon','authenticated','authenticator','service_role'] loop
    if pg_has_role(r,'tco_sync_executor','SET') or pg_has_role(r,'tco_sync_executor','USAGE') then raise exception 'Gateway has executor privileges: %',r; end if;
    if has_function_privilege(r,'tco_sync.request_user_id()','EXECUTE') then raise exception 'Private helper exposed: %',r; end if;
    foreach t in array array['tco_sync.accounts','tco_sync.records'] loop
      if has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Direct table access exposed: %',r; end if;
    end loop;
    foreach t in array array['public.tco_sync_pull(bigint)','public.tco_sync_initialize(jsonb)','public.tco_sync_push(bigint,uuid,jsonb)'] loop
      if has_function_privilege(r,t,'EXECUTE') is distinct from (r='authenticated') then raise exception 'RPC execute grant changed: %',r; end if;
    end loop;
  end loop;
end $$;
rollback;
