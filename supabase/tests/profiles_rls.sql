-- Run ONLY in a disposable test Supabase database, after the migration.
-- Uses synthetic users and always rolls back. Requires an admin SQL connection.
begin;
insert into auth.users (id, email) values
('70000000-0000-4000-8000-000000000001', 'a@example.test'),
('70000000-0000-4000-8000-000000000002', 'b@example.test'),
('70000000-0000-4000-8000-000000000003', 'c@example.test');
insert into public.profiles (id) values ('70000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
insert into public.profiles (id) values ('70000000-0000-4000-8000-000000000001');
do $$
declare affected integer;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'RLS: A can see foreign rows'; end if;
  update public.profiles set created_at = now() where id = '70000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS: A can update B'; end if;
  delete from public.profiles where id = '70000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS: A can delete B'; end if;
  begin
    insert into public.profiles (id) values ('70000000-0000-4000-8000-000000000003');
    raise exception 'RLS: A can insert C';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set id = '70000000-0000-4000-8000-000000000003';
    raise exception 'RLS: A can reassign ownership';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'RLS: B isolation failed'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform * from public.profiles;
    raise exception 'RLS: anonymous SELECT allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles (id) values ('70000000-0000-4000-8000-000000000003');
    raise exception 'RLS: anonymous INSERT allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
