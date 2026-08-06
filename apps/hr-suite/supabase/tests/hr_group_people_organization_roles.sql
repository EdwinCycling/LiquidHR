begin;

do $$
declare
  target_tenant uuid;
  default_group uuid;
  boundary_group uuid;
  multigroup_group uuid;
  manager_auth uuid;
  manager_count integer;
  admin_count integer;
  rel_name text;
begin
  select id into target_tenant from public.tenants where slug='liquid-hr-demo-holding' limit 1;
  select id into default_group from public.hr_groups where tenant_id=target_tenant and code='DEFAULT' limit 1;
  select id into boundary_group from public.hr_groups where tenant_id=target_tenant and code='TEST-BOUNDARY' limit 1;
  select id into multigroup_group from public.hr_groups where tenant_id=target_tenant and code='TEST-MULTIGROUP' limit 1;
  select auth_user_id into manager_auth from public.employees where tenant_id=target_tenant and hr_group_id=default_group and employee_number='DEMO-028';

  if target_tenant is null or default_group is null or boundary_group is null or multigroup_group is null or manager_auth is null then
    raise exception 'STAP6_FIXTURE_CONTEXT_MISSING';
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='departments' and column_name in ('administration_id','scope_type')) then
    raise exception 'STAP6_DEPARTMENTS_LEGACY_SCOPE_REMAINS';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='department_management' and column_name='administration_id') then
    raise exception 'STAP6_MANAGEMENT_LEGACY_SCOPE_REMAINS';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name in ('employees','employments','employee_organizations','department_management') and column_name='hr_group_id' and is_nullable='YES') then
    raise exception 'STAP6_GROUP_KEY_MUST_BE_REQUIRED';
  end if;

  if not exists (select 1 from pg_constraint where conname='departments_parent_hr_group_fkey') then raise exception 'STAP6_PARENT_FK_MISSING'; end if;
  if not exists (select 1 from pg_constraint where conname='department_management_department_hr_group_fkey') then raise exception 'STAP6_MANAGEMENT_DEPARTMENT_FK_MISSING'; end if;
  if not exists (select 1 from pg_constraint where conname='employee_organizations_department_hr_group_fkey') then raise exception 'STAP6_PLACEMENT_DEPARTMENT_FK_MISSING'; end if;
  if not exists (select 1 from pg_constraint where conname='employments_employee_hr_group_fkey') then raise exception 'STAP6_EMPLOYMENT_PERSON_FK_MISSING'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='employees_tenant_hr_group_auth_user_idx') then raise exception 'STAP6_PERSON_ONCE_PER_GROUP_INDEX_MISSING'; end if;

  for rel_name in select unnest(array['employees','employments','departments','department_management']) loop
    if not (select relrowsecurity from pg_class where oid=('public.'||rel_name)::regclass) then
      raise exception 'STAP6_RLS_MISSING_ON_%', rel_name;
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees_select_group') then raise exception 'STAP6_EMPLOYEE_GROUP_POLICY_MISSING'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employments' and policyname='employments_select_group') then raise exception 'STAP6_EMPLOYMENT_GROUP_POLICY_MISSING'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='department_management' and policyname='department_management_select_group') then raise exception 'STAP6_MANAGEMENT_GROUP_POLICY_MISSING'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employee_organizations' and policyname='employee_organizations_select_group') then raise exception 'STAP6_PLACEMENT_GROUP_POLICY_MISSING'; end if;
  if has_table_privilege('anon','public.employees','SELECT') or has_table_privilege('anon','public.employments','SELECT') then raise exception 'STAP6_ANON_DIRECT_READ_REMAINS'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.employments'::regclass and tgname='audit_employments') then raise exception 'STAP6_EMPLOYMENT_AUDIT_TRIGGER_MISSING'; end if;

  if (select count(*) from public.employees where tenant_id=target_tenant and hr_group_id=boundary_group and deleted_at is null) <> 0 then raise exception 'STAP6_BOUNDARY_GROUP_NOT_EMPTY'; end if;
  if (select count(*) from public.employees where tenant_id=target_tenant and hr_group_id=multigroup_group and deleted_at is null) <> 1 then raise exception 'STAP6_MULTIGROUP_PERSON_FIXTURE_MISSING'; end if;
  if (select count(distinct hr_group_id) from public.employees where tenant_id=target_tenant and auth_user_id=manager_auth and deleted_at is null) <> 2 then raise exception 'STAP6_SAME_LOGIN_TWO_GROUPS_MISSING'; end if;
  if (select count(*) from public.user_hr_group_access where user_id=manager_auth and tenant_id=target_tenant and hr_group_id in (default_group,multigroup_group) and is_active) <> 2 then raise exception 'STAP6_SEPARATE_GROUP_AUTH_MISSING'; end if;

  select count(distinct assignment.employee_id), count(distinct employment.administration_id)
    into manager_count, admin_count
  from public.department_management assignment
  join public.departments department on department.tenant_id=assignment.tenant_id and department.hr_group_id=assignment.hr_group_id and department.id=assignment.department_id
  join public.employments employment on employment.tenant_id=assignment.tenant_id and employment.hr_group_id=assignment.hr_group_id and employment.employee_id=assignment.employee_id and employment.record_status='CONFIRMED' and employment.deleted_at is null
  where assignment.tenant_id=target_tenant and assignment.hr_group_id=default_group and department.code='RICH-02';
  if manager_count < 2 then raise exception 'STAP6_TWO_MANAGERS_FIXTURE_MISSING'; end if;
  if admin_count < 2 then raise exception 'STAP6_CROSS_ADMIN_MANAGER_FIXTURE_MISSING'; end if;
  if (select count(*) from public.employments employment join public.employees employee on employee.id=employment.employee_id and employee.tenant_id=employment.tenant_id and employee.hr_group_id=employment.hr_group_id where employee.tenant_id=target_tenant and employee.employee_number='OPS-TEST-002' and employment.record_status='CONFIRMED' and employment.deleted_at is null) < 2 then raise exception 'STAP6_MULTI_EMPLOYMENT_FIXTURE_MISSING'; end if;
end;
$$;

-- Negatieve RLS-proef: de manager houdt alleen DEFAULT-toegang. De
-- transactionele wijzigingen worden door rollback niet blijvend opgeslagen.
delete from public.user_hr_group_access
where user_id=(select auth_user_id from public.employees where employee_number='DEMO-028' limit 1)
  and hr_group_id in (select id from public.hr_groups where code in ('TEST-BOUNDARY','TEST-MULTIGROUP'));
select set_config('request.jwt.claims', json_build_object('sub',(select auth_user_id from public.employees where employee_number='DEMO-028' limit 1),'role','authenticated')::text, true);
set local role authenticated;

do $$
declare
  target_tenant uuid;
  default_group uuid;
  multigroup_group uuid;
  default_count integer;
  overview_count integer;
begin
  select id into target_tenant from public.tenants where slug='liquid-hr-demo-holding' limit 1;
  select id into default_group from public.hr_groups where tenant_id=target_tenant and code='DEFAULT' limit 1;
  select id into multigroup_group from public.hr_groups where tenant_id=target_tenant and code='TEST-MULTIGROUP' limit 1;
  select count(*) into default_count from public.employees where tenant_id=target_tenant and hr_group_id=default_group;
  if default_count = 0 then raise exception 'STAP6_DEFAULT_RLS_FIXTURE_EMPTY'; end if;
  if (select count(*) from public.employees where tenant_id=target_tenant and hr_group_id=multigroup_group) <> 0 then raise exception 'STAP6_EMPLOYEE_CROSS_GROUP_LEAK'; end if;
  if (select count(*) from public.departments where tenant_id=target_tenant and hr_group_id=multigroup_group) <> 0 then raise exception 'STAP6_DEPARTMENT_CROSS_GROUP_LEAK'; end if;
  if (select count(*) from public.department_management where tenant_id=target_tenant and hr_group_id=multigroup_group) <> 0 then raise exception 'STAP6_ASSIGNMENT_CROSS_GROUP_LEAK'; end if;
  if (select count(*) from public.jobs where tenant_id=target_tenant and hr_group_id=multigroup_group) <> 0 then raise exception 'STAP6_JOB_CROSS_GROUP_LEAK'; end if;
  select count(*) into overview_count from public.list_employee_overviews(target_tenant, default_group, current_date, 'active');
  if overview_count = 0 then raise exception 'STAP6_GROUP_DIRECTORY_EMPTY'; end if;
  begin
    select count(*) into overview_count from public.list_employee_overviews(target_tenant, multigroup_group, current_date, 'active');
    raise exception 'STAP6_DIRECTORY_GROUP_BYPASS';
  exception when others then
    if sqlerrm not like '%insufficient employee directory permission%' then raise; end if;
  end;
end;
$$;

rollback;
