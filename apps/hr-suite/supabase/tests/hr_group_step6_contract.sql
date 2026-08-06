begin;

-- Runner-onafhankelijke contracttest voor de HR-groepfundering en Step 6.
-- De oudere pgTAP-bestanden blijven als lokale ontwikkeltests bestaan; deze
-- variant kan ook rechtstreeks via Supabase SQL worden uitgevoerd.
do $$
declare
  tenant uuid;
  default_group uuid;
  boundary_group uuid;
  multigroup_group uuid;
  manager_auth uuid;
  invalid_count integer;
  relation_name text;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'hr_groups') then
    raise exception 'STEP6_HR_GROUP_TABLE_MISSING';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_hr_group_access') then
    raise exception 'STEP6_HR_GROUP_ACCESS_TABLE_MISSING';
  end if;
  foreach relation_name in array array['administrations', 'employees', 'employments', 'labor_condition_sets', 'employment_contracts', 'absence_cases'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and information_schema.columns.table_name = relation_name and column_name = 'hr_group_id'
    ) then
      raise exception 'STEP6_GROUP_COLUMN_MISSING_%', relation_name;
    end if;
  end loop;

  foreach relation_name in array array['hr_groups', 'user_hr_group_access', 'administrations', 'employees', 'employments', 'labor_condition_sets', 'employment_contracts', 'absence_cases', 'departments', 'department_management', 'employee_organizations', 'jobs', 'job_groups', 'job_revisions', 'job_group_jobs'] loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = relation_name
        and relation.relrowsecurity
    ) then
      raise exception 'STEP6_RLS_MISSING_%', relation_name;
    end if;
  end loop;

  if exists (select 1 from public.administrations where hr_group_id is null)
     or exists (select 1 from public.employees where hr_group_id is null)
     or exists (select 1 from public.employments where hr_group_id is null)
     or exists (select 1 from public.employee_organizations where hr_group_id is null)
     or exists (select 1 from public.department_management where hr_group_id is null) then
    raise exception 'STEP6_REQUIRED_GROUP_KEY_NULL';
  end if;

  if exists (
    select 1
    from public.employments employment
    join public.administrations administration
      on administration.tenant_id = employment.tenant_id
     and administration.id = employment.administration_id
    where employment.hr_group_id <> administration.hr_group_id
  ) then
    raise exception 'STEP6_EMPLOYMENT_ADMIN_GROUP_MISMATCH';
  end if;
  if exists (
    select 1
    from public.employee_organizations placement
    join public.employments employment
      on employment.tenant_id = placement.tenant_id
     and employment.hr_group_id = placement.hr_group_id
     and employment.id = placement.employment_id
    where placement.hr_group_id <> employment.hr_group_id
  ) then
    raise exception 'STEP6_PLACEMENT_GROUP_MISMATCH';
  end if;
  if exists (
    select 1
    from public.absence_cases absence_case
    join public.employments employment
      on employment.tenant_id = absence_case.tenant_id
     and employment.id = absence_case.employment_id
    where absence_case.hr_group_id <> employment.hr_group_id
  ) then
    raise exception 'STEP6_ABSENCE_GROUP_MISMATCH';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'departments'
      and column_name in ('administration_id', 'scope_type')
  ) then
    raise exception 'STEP6_DEPARTMENT_LEGACY_SCOPE_REMAINS';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'department_management'
      and column_name = 'administration_id'
  ) then
    raise exception 'STEP6_MANAGEMENT_LEGACY_SCOPE_REMAINS';
  end if;

  if not exists (select 1 from pg_constraint where conname = 'employments_administration_hr_group_fkey')
     or not exists (select 1 from pg_constraint where conname = 'departments_parent_hr_group_fkey')
     or not exists (select 1 from pg_constraint where conname = 'employee_organizations_department_hr_group_fkey')
     or not exists (select 1 from pg_constraint where conname = 'department_management_department_hr_group_fkey') then
    raise exception 'STEP6_GROUP_COMPOSITE_FK_MISSING';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'employees_tenant_hr_group_auth_user_idx') then
    raise exception 'STEP6_GROUP_PERSON_UNIQUE_INDEX_MISSING';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employees' and policyname = 'employees_select_group')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employments' and policyname = 'employments_select_group')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'department_management' and policyname = 'department_management_select_group')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employee_organizations' and policyname = 'employee_organizations_select_group') then
    raise exception 'STEP6_GROUP_RLS_POLICY_MISSING';
  end if;
  if has_table_privilege('anon', 'public.employees', 'SELECT')
     or has_table_privilege('anon', 'public.employments', 'SELECT')
     or has_table_privilege('anon', 'public.administration_company_data', 'SELECT')
     or has_table_privilege('anon', 'public.administration_locations', 'SELECT') then
    raise exception 'STEP6_ANON_DIRECT_READ_REMAINS';
  end if;

  if to_regprocedure('public.list_employee_overviews(uuid,uuid,date,text)') is null
     or to_regprocedure('public.publish_complete_employment(uuid,uuid,jsonb)') is null
     or to_regprocedure('public.manage_employment_organization_timeline(uuid,uuid,date,uuid,uuid)') is null then
    raise exception 'STEP6_REQUIRED_RPC_MISSING';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.employments'::regclass and tgname = 'audit_employments') then
    raise exception 'STEP6_EMPLOYMENT_AUDIT_TRIGGER_MISSING';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'administration_company_data')
     or not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'administration_locations')
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name in ('administration_company_data', 'administration_locations')
         and column_name = 'administration_id'
     ) then
    raise exception 'STEP6_COMPANY_LOCATION_SCOPE_INVALID';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'administration_company_data_scope_key')
     or not exists (select 1 from pg_constraint where conname = 'administration_locations_tenant_hr_group_id_key')
     or not exists (select 1 from pg_constraint where conname = 'employee_organizations_location_hr_group_scope_fkey') then
    raise exception 'STEP6_COMPANY_LOCATION_CONSTRAINT_MISSING';
  end if;
  select count(*) into invalid_count
  from (
    select group_row.tenant_id, group_row.id
    from public.hr_groups group_row
    left join public.administration_company_data company
      on company.tenant_id = group_row.tenant_id
     and company.hr_group_id = group_row.id
    group by group_row.tenant_id, group_row.id
    having count(company.id) <> 1
  ) invalid_groups;
  if invalid_count <> 0 then
    raise exception 'STEP6_GROUP_COMPANY_ROW_COUNT_INVALID';
  end if;

  select id into tenant from public.tenants where slug = 'liquid-hr-demo-holding' limit 1;
  select id into default_group from public.hr_groups where tenant_id = tenant and code = 'DEFAULT' limit 1;
  select id into boundary_group from public.hr_groups where tenant_id = tenant and code = 'TEST-BOUNDARY' limit 1;
  select id into multigroup_group from public.hr_groups where tenant_id = tenant and code = 'TEST-MULTIGROUP' limit 1;
  select auth_user_id into manager_auth from public.employees where tenant_id = tenant and hr_group_id = default_group and employee_number = 'DEMO-028' limit 1;
  if tenant is null or default_group is null or boundary_group is null or multigroup_group is null or manager_auth is null then
    raise exception 'STEP6_CONTROLLED_FIXTURE_CONTEXT_MISSING';
  end if;
  if (select count(*) from public.employees where tenant_id = tenant and hr_group_id = boundary_group and deleted_at is null) <> 0 then
    raise exception 'STEP6_BOUNDARY_FIXTURE_NOT_EMPTY';
  end if;
  if (select count(*) from public.employees where tenant_id = tenant and hr_group_id = multigroup_group and deleted_at is null) <> 1 then
    raise exception 'STEP6_MULTIGROUP_FIXTURE_INVALID';
  end if;
  if (select count(distinct hr_group_id) from public.employees where tenant_id = tenant and auth_user_id = manager_auth and deleted_at is null) <> 2 then
    raise exception 'STEP6_SAME_LOGIN_TWO_GROUPS_INVALID';
  end if;
  if (select count(*) from public.user_hr_group_access where tenant_id = tenant and user_id = manager_auth and is_active and hr_group_id in (default_group, multigroup_group)) <> 2 then
    raise exception 'STEP6_GROUP_ACCESS_FIXTURE_INVALID';
  end if;
  if (select count(distinct manager.employee_id) from public.department_management manager join public.departments department on department.tenant_id = manager.tenant_id and department.hr_group_id = manager.hr_group_id and department.id = manager.department_id where manager.tenant_id = tenant and manager.hr_group_id = default_group and department.code = 'RICH-02') < 2 then
    raise exception 'STEP6_TWO_MANAGER_FIXTURE_INVALID';
  end if;
  if (select count(distinct employment.administration_id) from public.department_management manager join public.departments department on department.tenant_id = manager.tenant_id and department.hr_group_id = manager.hr_group_id and department.id = manager.department_id join public.employments employment on employment.tenant_id = manager.tenant_id and employment.hr_group_id = manager.hr_group_id and employment.employee_id = manager.employee_id and employment.record_status = 'CONFIRMED' and employment.deleted_at is null where manager.tenant_id = tenant and manager.hr_group_id = default_group and department.code = 'RICH-02') < 2 then
    raise exception 'STEP6_CROSS_ADMIN_MANAGER_FIXTURE_INVALID';
  end if;
  if (select count(*) from public.employments employment join public.employees employee on employee.tenant_id = employment.tenant_id and employee.hr_group_id = employment.hr_group_id and employee.id = employment.employee_id where employee.tenant_id = tenant and employee.employee_number = 'OPS-TEST-002' and employment.record_status = 'CONFIRMED' and employment.deleted_at is null) < 2 then
    raise exception 'STEP6_MULTI_EMPLOYMENT_FIXTURE_INVALID';
  end if;
end
$$;

rollback;
