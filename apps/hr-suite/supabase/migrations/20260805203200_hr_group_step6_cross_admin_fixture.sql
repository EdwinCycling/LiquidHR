-- Gecontroleerde Stap-6-fixture: dezelfde groepsmanager heeft twee
-- dienstverbanden in twee administraties en blijft één groepspersoon.

do $$
declare
  target_tenant_id uuid;
  target_group_id uuid;
  manager_id uuid;
  services_admin_id uuid;
  department_id uuid;
  services_employment_id uuid;
begin
  select tenant.id into target_tenant_id
  from public.tenants tenant
  where tenant.slug = 'liquid-hr-demo-holding'
  limit 1;

  select group_row.id into target_group_id
  from public.hr_groups group_row
  where group_row.tenant_id = target_tenant_id
    and group_row.code = 'DEFAULT'
  limit 1;

  select employee.id into manager_id
  from public.employees employee
  where employee.tenant_id = target_tenant_id
    and employee.hr_group_id = target_group_id
    and employee.employee_number = 'DEMO-028';

  select administration.id into services_admin_id
  from public.administrations administration
  where administration.tenant_id = target_tenant_id
    and administration.hr_group_id = target_group_id
    and administration.code = 'SERVICES';

  select department.id into department_id
  from public.departments department
  where department.tenant_id = target_tenant_id
    and department.hr_group_id = target_group_id
    and department.code = 'RICH-02';

  if manager_id is null or services_admin_id is null or department_id is null then
    raise exception 'STAP6_CROSS_ADMIN_FIXTURE_SOURCE_MISSING';
  end if;

  select employment.id into services_employment_id
  from public.employments employment
  where employment.tenant_id = target_tenant_id
    and employment.hr_group_id = target_group_id
    and employment.employee_id = manager_id
    and employment.administration_id = services_admin_id
    and employment.employment_number = 'EMP-DEMO-028-SERVICES';

  if services_employment_id is null then
    insert into public.employments (
      tenant_id, hr_group_id, administration_id, employee_id, employment_number,
      employment_type, contract_type, record_status, starts_on, seniority_date,
      original_hire_date, is_primary, country_code
    ) values (
      target_tenant_id, target_group_id, services_admin_id, manager_id,
      'EMP-DEMO-028-SERVICES', 'EMPLOYEE', 'INDEFINITE', 'CONFIRMED',
      date '2024-01-01', date '2024-01-01', date '2024-01-01', false, 'NL'
    ) returning id into services_employment_id;
  end if;

  insert into public.employee_administration_assignments (
    tenant_id, hr_group_id, administration_id, employee_id, effective_from
  ) values (
    target_tenant_id, target_group_id, services_admin_id, manager_id, date '2024-01-01'
  ) on conflict do nothing;

  insert into public.employee_organizations (
    tenant_id, hr_group_id, administration_id, employee_id, employment_id,
    department_id, job_title, effective_from
  ) values (
    target_tenant_id, target_group_id, services_admin_id, manager_id, services_employment_id,
    department_id, 'Operations manager Services', date '2024-01-01'
  ) on conflict do nothing;
end;
$$;
