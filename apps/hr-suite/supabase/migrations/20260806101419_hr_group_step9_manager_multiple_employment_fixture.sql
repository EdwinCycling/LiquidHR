-- Gecontroleerde Step-9-fixture voor de manager-multiple-matchflow.
-- Omar is een bestaand synthetisch teamlid van Yara. Zijn voormalige
-- dienstverband blijft als parallel actief dienstverband beschikbaar voor
-- de eindcontrole; beide employments krijgen een eigen organisatieplaatsing.
do $$
declare
  target_tenant_id uuid;
  target_group_id uuid;
  target_admin_id uuid;
  target_department_id uuid;
  manager_id uuid;
  target_employee_id uuid;
  first_employment_id uuid;
  second_employment_id uuid;
  first_starts_on date;
  second_starts_on date;
  first_placement_id uuid;
begin
  select tenant.id
    into target_tenant_id
  from public.tenants tenant
  where tenant.slug = 'liquid-hr-demo-holding'
  limit 1;

  select group_row.id
    into target_group_id
  from public.hr_groups group_row
  where group_row.tenant_id = target_tenant_id
    and group_row.code = 'DEFAULT'
  limit 1;

  select administration.id
    into target_admin_id
  from public.administrations administration
  where administration.tenant_id = target_tenant_id
    and administration.hr_group_id = target_group_id
    and administration.code = 'OPERATIONS'
  limit 1;

  select department.id
    into target_department_id
  from public.departments department
  where department.tenant_id = target_tenant_id
    and department.hr_group_id = target_group_id
    and department.code = 'RICH-02'
  limit 1;

  select employee.id
    into manager_id
  from public.employees employee
  where employee.tenant_id = target_tenant_id
    and employee.hr_group_id = target_group_id
    and employee.employee_number = 'DEMO-028'
    and employee.deleted_at is null;

  select employee.id
    into target_employee_id
  from public.employees employee
  where employee.tenant_id = target_tenant_id
    and employee.hr_group_id = target_group_id
    and employee.employee_number = 'DEMO-037'
    and employee.deleted_at is null;

  select employment.id, employment.starts_on
    into first_employment_id, first_starts_on
  from public.employments employment
  where employment.tenant_id = target_tenant_id
    and employment.hr_group_id = target_group_id
    and employment.employee_id = target_employee_id
    and employment.administration_id = target_admin_id
    and employment.employment_number = 'EMP-DEMO-037-A'
    and employment.deleted_at is null;

  select employment.id, employment.starts_on
    into second_employment_id, second_starts_on
  from public.employments employment
  where employment.tenant_id = target_tenant_id
    and employment.hr_group_id = target_group_id
    and employment.employee_id = target_employee_id
    and employment.administration_id = target_admin_id
    and employment.employment_number = 'RICH-TEST-0037'
    and employment.deleted_at is null;

  if target_tenant_id is null
     or target_group_id is null
     or target_admin_id is null
     or target_department_id is null
     or manager_id is null
     or target_employee_id is null
     or first_employment_id is null
     or second_employment_id is null then
    raise exception 'STEP9_MANAGER_MULTIPLE_EMPLOYMENT_SOURCE_MISSING';
  end if;

  -- Het eerste employment wordt parallel actief maar niet primair; het
  -- tweede blijft het primaire employment. Zo blijft de bestaande
  -- primaire-employmentregel geldig.
  update public.employments
  set ends_on = null,
      is_primary = false
  where id = first_employment_id;

  update public.employments
  set ends_on = null,
      is_primary = true
  where id = second_employment_id;

  select placement.id
    into first_placement_id
  from public.employee_organizations placement
  where placement.tenant_id = target_tenant_id
    and placement.hr_group_id = target_group_id
    and placement.employee_id = target_employee_id
    and (placement.employment_id = first_employment_id or placement.employment_id is null)
  order by (placement.employment_id = first_employment_id) desc, placement.effective_from
  limit 1;

  if first_placement_id is null then
    insert into public.employee_organizations (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      department_id, job_title, direct_manager_id, effective_from
    ) values (
      target_tenant_id, target_group_id, target_admin_id, target_employee_id,
      first_employment_id, target_department_id, 'Operations specialist A',
      manager_id, first_starts_on
    )
    returning id into first_placement_id;
  else
    update public.employee_organizations
    set administration_id = target_admin_id,
        employment_id = first_employment_id,
        department_id = target_department_id,
        job_title = 'Operations specialist A',
        direct_manager_id = manager_id,
        direct_manager_deputy_id = null,
        effective_from = first_starts_on,
        effective_to = null
    where id = first_placement_id;
  end if;

  if not exists (
    select 1
    from public.employee_organizations placement
    where placement.tenant_id = target_tenant_id
      and placement.hr_group_id = target_group_id
      and placement.employee_id = target_employee_id
      and placement.employment_id = second_employment_id
  ) then
    insert into public.employee_organizations (
      tenant_id, hr_group_id, administration_id, employee_id, employment_id,
      department_id, job_title, direct_manager_id, effective_from
    ) values (
      target_tenant_id, target_group_id, target_admin_id, target_employee_id,
      second_employment_id, target_department_id, 'Operations specialist B',
      manager_id, second_starts_on
    );
  else
    update public.employee_organizations
    set administration_id = target_admin_id,
        department_id = target_department_id,
        job_title = 'Operations specialist B',
        direct_manager_id = manager_id,
        direct_manager_deputy_id = null,
        effective_from = second_starts_on,
        effective_to = null
    where tenant_id = target_tenant_id
      and hr_group_id = target_group_id
      and employee_id = target_employee_id
      and employment_id = second_employment_id;
  end if;

  if (
    select count(*)
    from public.employments employment
    where employment.tenant_id = target_tenant_id
      and employment.hr_group_id = target_group_id
      and employment.employee_id = target_employee_id
      and employment.record_status = 'CONFIRMED'
      and employment.deleted_at is null
      and employment.starts_on <= current_date
      and (employment.ends_on is null or employment.ends_on >= current_date)
  ) <> 2 then
    raise exception 'STEP9_MANAGER_ACTIVE_EMPLOYMENT_COUNT_MISMATCH';
  end if;

  if (
    select count(*)
    from public.employee_organizations placement
    where placement.tenant_id = target_tenant_id
      and placement.hr_group_id = target_group_id
      and placement.employee_id = target_employee_id
      and placement.employment_id in (first_employment_id, second_employment_id)
      and placement.direct_manager_id = manager_id
      and placement.effective_from <= current_date
      and (placement.effective_to is null or placement.effective_to >= current_date)
  ) <> 2 then
    raise exception 'STEP9_MANAGER_PLACEMENT_COUNT_MISMATCH';
  end if;
end;
$$;
