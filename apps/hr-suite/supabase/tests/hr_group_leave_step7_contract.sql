begin;

-- Runner-onafhankelijke Step 7-contracttest. De test maakt tijdelijke
-- precedence-records binnen deze transactie en laat geen remote data achter.
do $$
declare
  relation_name text;
  tenant uuid;
  default_group uuid;
  boundary_group uuid;
  multigroup_group uuid;
  target_employee uuid;
  target_employment uuid;
  target_leave_type uuid;
  default_profile uuid;
  set_profile uuid;
  resolved_profile uuid;
  resolved_source text;
  resolved_rule uuid;
  resolved_no_accrual boolean;
  target_amount numeric;
  default_amount numeric;
  employment_profile_id uuid;
begin
  foreach relation_name in array array[
    'leave_settings', 'leave_year_controls', 'leave_types', 'work_hour_types',
    'leave_profiles', 'leave_accrual_rules', 'leave_accrual_rule_work_hour_types',
    'leave_accrual_rule_pause_types', 'leave_accrual_exceptions', 'leave_bonus_rules',
    'leave_bonus_tiers', 'leave_priority_rules', 'leave_priority_rule_items',
    'leave_year_rollovers', 'leave_year_rollover_items', 'employee_sets',
    'employee_set_members', 'overtime_type_settings', 'overtime_type_exceptions',
    'employment_leave_profiles', 'leave_balance_buckets', 'leave_accrual_transactions',
    'leave_requests', 'leave_request_allocations'
  ] loop
    if to_regclass('public.' || relation_name) is null then raise exception 'STEP7_TABLE_MISSING_%', relation_name; end if;
    if not exists (
      select 1 from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname = relation_name and relation.relrowsecurity
    ) then raise exception 'STEP7_RLS_MISSING_%', relation_name; end if;
    if not exists (select 1 from pg_policies policy where policy.schemaname = 'public' and policy.tablename = relation_name) then
      raise exception 'STEP7_POLICY_MISSING_%', relation_name;
    end if;
  end loop;

  foreach relation_name in array array[
    'leave_settings', 'leave_year_controls', 'leave_types', 'work_hour_types',
    'leave_profiles', 'leave_accrual_rules', 'leave_accrual_rule_work_hour_types',
    'leave_accrual_rule_pause_types', 'leave_bonus_rules', 'leave_bonus_tiers',
    'leave_priority_rules', 'leave_priority_rule_items', 'leave_year_rollovers',
    'leave_year_rollover_items', 'employee_sets', 'employee_set_members',
    'overtime_type_settings', 'overtime_type_exceptions'
  ] loop
    if exists (
      select 1 from information_schema.columns column_info
      where column_info.table_schema = 'public' and column_info.table_name = relation_name
        and column_info.column_name = 'hr_group_id' and column_info.is_nullable = 'YES'
    ) then raise exception 'STEP7_GROUP_KEY_NULLABLE_%', relation_name; end if;
  end loop;

  foreach relation_name in array array['leave_settings', 'leave_year_controls', 'leave_types', 'work_hour_types', 'leave_profiles', 'leave_accrual_rules', 'leave_bonus_rules', 'leave_priority_rules', 'leave_year_rollovers'] loop
    if exists (
      select 1 from information_schema.columns column_info
      where column_info.table_schema = 'public' and column_info.table_name = relation_name
        and column_info.column_name = 'administration_id' and column_info.is_nullable = 'NO'
    ) then raise exception 'STEP7_CATALOG_ADMINISTRATION_SCOPE_REMAINS_%', relation_name; end if;
  end loop;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'leave_types_tenant_hr_group_name_key')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'leave_year_controls_tenant_hr_group_year_key')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'employee_sets_group_active_idx')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'overtime_type_exceptions_group_type_employee_key') then
    raise exception 'STEP7_GROUP_INDEX_MISSING';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employee_sets_profile_fkey')
     or not exists (select 1 from pg_constraint where conname = 'employee_set_members_employee_fkey')
     or not exists (select 1 from pg_constraint where conname = 'leave_balance_buckets_type_group_fkey')
     or not exists (select 1 from pg_constraint where conname = 'leave_requests_priority_rule_group_fkey') then
    raise exception 'STEP7_GROUP_FK_MISSING';
  end if;

  select id into tenant from public.tenants where slug = 'liquid-hr-demo-holding' limit 1;
  select id into default_group from public.hr_groups where tenant_id = tenant and code = 'DEFAULT' limit 1;
  select id into boundary_group from public.hr_groups where tenant_id = tenant and code = 'TEST-BOUNDARY' limit 1;
  select id into multigroup_group from public.hr_groups where tenant_id = tenant and code = 'TEST-MULTIGROUP' limit 1;
  select employee.id, employment.id into target_employee, target_employment
  from public.employees employee
  join public.employments employment on employment.tenant_id = employee.tenant_id and employment.hr_group_id = employee.hr_group_id and employment.employee_id = employee.id
  where employee.tenant_id = tenant and employee.hr_group_id = multigroup_group and employee.employee_number = 'TEST-MULTIGROUP-MANAGER'
    and employment.record_status = 'CONFIRMED' and employment.deleted_at is null limit 1;
  select id into target_leave_type from public.leave_types where tenant_id = tenant and hr_group_id = multigroup_group and name = 'Stap 7 testverlof' limit 1;
  select id into default_profile from public.leave_profiles where tenant_id = tenant and hr_group_id = multigroup_group and name = 'Stap 7 groepsstandaard' limit 1;
  select id into set_profile from public.leave_profiles where tenant_id = tenant and hr_group_id = multigroup_group and name = 'Stap 7 medewerker-set' limit 1;
  if tenant is null or default_group is null or boundary_group is null or multigroup_group is null or target_employee is null or target_employment is null or target_leave_type is null or default_profile is null or set_profile is null then
    raise exception 'STEP7_CONTROLLED_FIXTURE_CONTEXT_MISSING';
  end if;
  if (select count(*) from public.leave_profiles where tenant_id = tenant and hr_group_id = multigroup_group and is_group_default) <> 1 then raise exception 'STEP7_GROUP_DEFAULT_COUNT_INVALID'; end if;
  if (select count(*) from public.employee_sets where tenant_id = tenant and hr_group_id = multigroup_group and name = 'Stap 7 afwijkende set' and is_active) <> 1 then raise exception 'STEP7_EMPLOYEE_SET_FIXTURE_MISSING'; end if;
  if (select count(*) from public.employee_set_members where tenant_id = tenant and hr_group_id = multigroup_group and employee_id = target_employee) <> 1 then raise exception 'STEP7_EMPLOYEE_SET_MEMBER_FIXTURE_MISSING'; end if;
  if (select count(*) from public.leave_types where tenant_id = tenant and hr_group_id = boundary_group) <> 0 then raise exception 'STEP7_BOUNDARY_CATALOG_NOT_EMPTY'; end if;
  if (select count(*) from public.leave_types where tenant_id = tenant and hr_group_id = default_group and name = 'Stap 7 testverlof') <> 0 then raise exception 'STEP7_GROUP_CATALOG_LEAK'; end if;
  if (select count(*) from public.leave_balance_buckets where tenant_id = tenant and hr_group_id = default_group and employee_id = (select id from public.employees where tenant_id = tenant and employee_number = 'DEMO-028') and accrual_year = 2026) <> 2 then raise exception 'STEP7_TWO_EMPLOYMENT_BALANCES_MISSING'; end if;

  select public.resolve_leave_profile_for_employment(tenant, multigroup_group, target_employment, date '2026-08-05') into resolved_profile;
  if resolved_profile <> set_profile then raise exception 'STEP7_EMPLOYEE_SET_PRECEDENCE_FAILED'; end if;
  select resolution_source, rule_id, no_accrual, accrual_amount into resolved_source, resolved_rule, resolved_no_accrual, target_amount
  from public.resolve_leave_accrual_rule_for_employment(tenant, multigroup_group, target_employment, target_leave_type, date '2026-08-05');
  if resolved_source <> 'EMPLOYEE_SET' or resolved_rule is null or resolved_no_accrual or target_amount <> 2.5 then raise exception 'STEP7_EMPLOYEE_SET_RULE_PRECEDENCE_FAILED'; end if;

  delete from public.employee_set_members where tenant_id = tenant and hr_group_id = multigroup_group and employee_id = target_employee;
  select resolution_source, accrual_amount into resolved_source, default_amount
  from public.resolve_leave_accrual_rule_for_employment(tenant, multigroup_group, target_employment, target_leave_type, date '2026-08-05');
  if resolved_source <> 'HR_GROUP_DEFAULT' or default_amount <> 1.5 then raise exception 'STEP7_GROUP_DEFAULT_PRECEDENCE_FAILED'; end if;

  insert into public.employment_leave_profiles (tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_profile_id, valid_from)
  select tenant, multigroup_group, employment.administration_id, target_employee, target_employment, set_profile, date '2026-08-05'
  from public.employments employment where employment.id = target_employment;
  select resolution_source into resolved_source
  from public.resolve_leave_accrual_rule_for_employment(tenant, multigroup_group, target_employment, target_leave_type, date '2026-08-05');
  if resolved_source <> 'EMPLOYMENT_PROFILE' then raise exception 'STEP7_EMPLOYMENT_PROFILE_PRECEDENCE_FAILED'; end if;

  insert into public.leave_accrual_exceptions (tenant_id, hr_group_id, administration_id, employee_id, employment_id, leave_type_id, valid_from, no_accrual, reason)
  select tenant, multigroup_group, employment.administration_id, target_employee, target_employment, target_leave_type, date '2026-08-05', true, 'Step 7 precedence test'
  from public.employments employment where employment.id = target_employment;
  select resolution_source, no_accrual as result_no_accrual into resolved_source, resolved_no_accrual
  from public.resolve_leave_accrual_rule_for_employment(tenant, multigroup_group, target_employment, target_leave_type, date '2026-08-05');
  if resolved_source <> 'EMPLOYMENT_EXCEPTION' or not resolved_no_accrual then raise exception 'STEP7_EMPLOYMENT_EXCEPTION_PRECEDENCE_FAILED'; end if;

  if not has_function_privilege('authenticated', to_regprocedure('public.create_group_leave_accrual_rule(uuid,uuid,uuid,uuid,uuid,date,date,public.leave_accrual_basis,public.leave_accrual_frequency,public.leave_accrual_timing,numeric,numeric,smallint,uuid[],uuid[])'), 'EXECUTE')
     or has_function_privilege('authenticated', to_regprocedure('public.create_leave_accrual_rule(uuid,uuid,uuid,uuid,uuid,date,date,public.leave_accrual_basis,public.leave_accrual_frequency,public.leave_accrual_timing,numeric,numeric,smallint,uuid[],uuid[])'), 'EXECUTE') then
    raise exception 'STEP7_RPC_PRIVILEGE_MIGRATION_FAILED';
  end if;
end;
$$;

rollback;
