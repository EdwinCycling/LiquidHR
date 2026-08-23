begin;

set local search_path = public, extensions;
select plan(18);

select ok(
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'internal_security'
      and pg_proc.proname = 'validate_talent_development_goal'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']::text[]
  ),
  'goal validator is SECURITY DEFINER with an empty search_path'
);

select ok(
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'internal_security'
      and pg_proc.proname = 'validate_talent_goal_check_in'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']::text[]
  ),
  'check-in validator is SECURITY DEFINER with an empty search_path'
);

select ok(
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'internal_security'
      and pg_proc.proname = 'audit_talent_development_goal'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']::text[]
  ),
  'goal audit trigger is hardened'
);

select ok(
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'internal_security'
      and pg_proc.proname = 'audit_talent_goal_check_in'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']::text[]
  ),
  'check-in audit trigger is hardened'
);

select ok(
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'internal_security'
      and pg_proc.proname = 'audit_talent_notification'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']::text[]
  ),
  'notification audit trigger is hardened'
);

select ok(
  position('OPEN' in coalesce((
    select pg_get_expr(polqual, polrelid)
    from pg_policy
    where polrelid = 'public.talent_goal_check_ins'::regclass
      and polname = 'talent_goal_check_ins_update'
  ), '')) > 0
  and position('ACTIVE' in coalesce((
    select pg_get_expr(polqual, polrelid)
    from pg_policy
    where polrelid = 'public.talent_goal_check_ins'::regclass
      and polname = 'talent_goal_check_ins_update'
  ), '')) > 0,
  'check-in UPDATE USING is limited to open entries on active goals'
);

do $fixture$
declare
  tenant_id_value uuid;
  employee_id_value uuid;
  manager_employee_id_value uuid;
  employee_user_id uuid;
  manager_user_id uuid;
  hr_user_id uuid;
  goal_id_value uuid := gen_random_uuid();
  cancel_goal_id_value uuid := gen_random_uuid();
  manager_check_in_id_value uuid := gen_random_uuid();
  follow_up_check_in_id_value uuid := gen_random_uuid();
  employee_check_in_id_value uuid := gen_random_uuid();
  cancel_check_in_id_value uuid := gen_random_uuid();
begin
  select id into employee_user_id from auth.users where lower(email) = 'employee.fixture@liquidhr.test' limit 1;
  select id into manager_user_id from auth.users where lower(email) = 'manager.fixture@liquidhr.test' limit 1;
  select id into hr_user_id from auth.users where lower(email) = 'hradmin.fixture@liquidhr.test' limit 1;
  select tenant_id into tenant_id_value from public.user_access where user_id = hr_user_id and is_active limit 1;
  select id into employee_id_value from public.employees where auth_user_id = employee_user_id and deleted_at is null limit 1;
  select id into manager_employee_id_value from public.employees where auth_user_id = manager_user_id and deleted_at is null limit 1;

  if tenant_id_value is null or employee_id_value is null or manager_user_id is null or hr_user_id is null then
    raise exception 'Talent fixture accounts are incomplete';
  end if;

  insert into public.talent_development_goals (
    id, tenant_id, employee_id, title, description, period_start, period_end,
    progress_percent, status, source_type, created_by_user_id, updated_by_user_id
  ) values (
    goal_id_value, tenant_id_value, employee_id_value, 'SECURITY-HARDENING goal', 'Rollbackable pgTAP fixture',
    date '2026-01-01', date '2026-12-31', 10, 'ACTIVE', 'MANAGER_ENTERED', manager_user_id, manager_user_id
  );

  insert into public.talent_development_goals (
    id, tenant_id, employee_id, title, description, period_start, period_end,
    progress_percent, status, source_type, created_by_user_id, updated_by_user_id
  ) values (
    cancel_goal_id_value, tenant_id_value, employee_id_value, 'SECURITY-HARDENING cancelled goal', 'Rollbackable pgTAP fixture',
    date '2026-01-01', date '2026-12-31', 10, 'ACTIVE', 'MANAGER_ENTERED', manager_user_id, manager_user_id
  );

  perform set_config('request.jwt.claims', jsonb_build_object('sub', manager_user_id, 'role', 'authenticated')::text, true);
  insert into public.talent_goal_check_ins (
    id, tenant_id, goal_id, employee_id, entry_type, author_user_id, author_employee_id, body, follow_up_title
  ) values
    (manager_check_in_id_value, tenant_id_value, goal_id_value, employee_id_value, 'MANAGER_OBSERVATION', manager_user_id, manager_employee_id_value, 'manager original', null),
    (follow_up_check_in_id_value, tenant_id_value, goal_id_value, employee_id_value, 'FOLLOW_UP', manager_user_id, manager_employee_id_value, 'follow-up original', 'Follow up'),
    (cancel_check_in_id_value, tenant_id_value, cancel_goal_id_value, employee_id_value, 'FOLLOW_UP', manager_user_id, manager_employee_id_value, 'cancel original', 'Cancel follow up');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', employee_user_id, 'role', 'authenticated')::text, true);
  insert into public.talent_goal_check_ins (
    id, tenant_id, goal_id, employee_id, entry_type, author_user_id, author_employee_id, body, follow_up_title
  ) values (
    employee_check_in_id_value, tenant_id_value, goal_id_value, employee_id_value, 'EMPLOYEE_REFLECTION', employee_user_id, employee_id_value, 'employee original', null
  );

  perform set_config('app.goals_security_tenant_id', tenant_id_value::text, true);
  perform set_config('app.goals_security_goal_id', goal_id_value::text, true);
  perform set_config('app.goals_security_cancel_goal_id', cancel_goal_id_value::text, true);
  perform set_config('app.goals_security_manager_check_in_id', manager_check_in_id_value::text, true);
  perform set_config('app.goals_security_follow_up_check_in_id', follow_up_check_in_id_value::text, true);
  perform set_config('app.goals_security_employee_check_in_id', employee_check_in_id_value::text, true);
  perform set_config('app.goals_security_cancel_check_in_id', cancel_check_in_id_value::text, true);
  perform set_config('app.goals_security_employee_user_id', employee_user_id::text, true);
  perform set_config('app.goals_security_manager_user_id', manager_user_id::text, true);
  perform set_config('app.goals_security_hr_user_id', hr_user_id::text, true);
end;
$fixture$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('app.goals_security_manager_user_id'), 'role', 'authenticated')::text, true);

update public.talent_goal_check_ins
set body = 'manager update', version = version + 1
where id = current_setting('app.goals_security_manager_check_in_id')::uuid
  and version = 1;
select is(
  (select body from public.talent_goal_check_ins where id = current_setting('app.goals_security_manager_check_in_id')::uuid),
  'manager update',
  'manager can update an open in-scope check-in'
);

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('app.goals_security_hr_user_id'), 'role', 'authenticated')::text, true);
update public.talent_goal_check_ins
set body = 'hr update', version = version + 1
where id = current_setting('app.goals_security_manager_check_in_id')::uuid
  and version = 2;
select is(
  (select body from public.talent_goal_check_ins where id = current_setting('app.goals_security_manager_check_in_id')::uuid),
  'hr update',
  'HR can update an in-scope check-in without changing its original author'
);

update public.talent_goal_check_ins
set status = 'COMPLETED', completed_at = timestamptz '1900-01-01 00:00:00+00', version = version + 1
where id = current_setting('app.goals_security_manager_check_in_id')::uuid
  and version = 3;
select ok(
  (select completed_at > pg_catalog.now() - interval '10 seconds' and completed_at <= pg_catalog.now()
   from public.talent_goal_check_ins
   where id = current_setting('app.goals_security_manager_check_in_id')::uuid),
  'check-in completion timestamp is server-generated'
);

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('app.goals_security_employee_user_id'), 'role', 'authenticated')::text, true);
update public.talent_goal_check_ins
set body = 'employee update', version = version + 1
where id = current_setting('app.goals_security_employee_check_in_id')::uuid
  and version = 1;
select is(
  (select body from public.talent_goal_check_ins where id = current_setting('app.goals_security_employee_check_in_id')::uuid),
  'employee update',
  'employee can update the own reflection according to the existing contract'
);

update public.talent_goal_check_ins
set body = 'out of scope update', version = version + 1
where id = current_setting('app.goals_security_manager_check_in_id')::uuid
  and version = 4;
reset role;
select is(
  (select body from public.talent_goal_check_ins where id = current_setting('app.goals_security_manager_check_in_id')::uuid),
  'hr update',
  'employee cannot update a manager observation outside the existing scope'
);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('app.goals_security_hr_user_id'), 'role', 'authenticated')::text, true);
update public.talent_development_goals
set status = 'COMPLETED', completed_at = timestamptz '1900-01-01 00:00:00+00', version = version + 1
where id = current_setting('app.goals_security_goal_id')::uuid
  and version = 1;
select ok(
  (select completed_at > pg_catalog.now() - interval '10 seconds' and completed_at <= pg_catalog.now()
   from public.talent_development_goals
   where id = current_setting('app.goals_security_goal_id')::uuid),
  'goal completion timestamp is server-generated'
);

select set_config('app.goals_security_completed_at', (select completed_at::text from public.talent_development_goals where id = current_setting('app.goals_security_goal_id')::uuid), true);
update public.talent_development_goals
set status = 'ARCHIVED', archived_at = timestamptz '1900-01-01 00:00:00+00', version = version + 1
where id = current_setting('app.goals_security_goal_id')::uuid
  and version = 2;
select ok(
  (select archived_at > pg_catalog.now() - interval '10 seconds' and archived_at <= pg_catalog.now()
   from public.talent_development_goals
   where id = current_setting('app.goals_security_goal_id')::uuid),
  'goal archive timestamp is server-generated'
);
select is(
  (select completed_at::text from public.talent_development_goals where id = current_setting('app.goals_security_goal_id')::uuid),
  current_setting('app.goals_security_completed_at'),
  'historical goal completion timestamp is preserved when archived'
);

select ok(
  (select count(*) > 0
   from public.talent_goal_check_ins
   where goal_id = current_setting('app.goals_security_goal_id')::uuid),
  'terminal goal history remains readable'
);

reset role;
select throws_ok(
  format($sql$update public.talent_goal_check_ins set body = 'terminal trigger reject', version = version + 1 where id = %L$sql$, current_setting('app.goals_security_follow_up_check_in_id')::uuid),
  'P0001',
  'TALENT_CHECKIN_GOAL_TERMINAL_LOCKED',
  'trigger rejects an open check-in update after goal archive'
);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('app.goals_security_manager_user_id'), 'role', 'authenticated')::text, true);
update public.talent_goal_check_ins
set body = 'terminal RLS reject', version = version + 1
where id = current_setting('app.goals_security_follow_up_check_in_id')::uuid
  and version = 1;
select is(
  (select body from public.talent_goal_check_ins where id = current_setting('app.goals_security_follow_up_check_in_id')::uuid),
  'follow-up original',
  'RLS rejects manager mutation of an open check-in on a terminal goal'
);

reset role;
update public.talent_development_goals
set status = 'CANCELLED', version = version + 1
where id = current_setting('app.goals_security_cancel_goal_id')::uuid
  and version = 1;
select throws_ok(
  format($sql$update public.talent_goal_check_ins set body = 'cancel trigger reject', version = version + 1 where id = %L$sql$, current_setting('app.goals_security_cancel_check_in_id')::uuid),
  'P0001',
  'TALENT_CHECKIN_GOAL_TERMINAL_LOCKED',
  'trigger rejects an open check-in update after goal cancellation'
);

select * from finish();
rollback;
