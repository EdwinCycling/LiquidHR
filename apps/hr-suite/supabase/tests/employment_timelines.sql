begin;

do $$
declare
  employment public.employments%rowtype;
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  employee uuid;
begin
  select id into administration from public.administrations
  where tenant_id = tenant order by code limit 1;
  select id into employee from public.employees
  where tenant_id = tenant order by employee_number limit 1;

  insert into public.employments (
    id, tenant_id, administration_id, employee_id, employment_number,
    contract_type, record_status, starts_on, seniority_date, original_hire_date
  ) values (
    md5('employment:timeline-test')::uuid, tenant, administration, employee,
    'TEST-TIMELINE', 'INDEFINITE', 'CONFIRMED', '2026-01-01', '2026-01-01', '2026-01-01'
  ) returning * into employment;

  insert into public.employment_labor_conditions (
    tenant_id, administration_id, employee_id, employment_id,
    condition_group, valid_from, valid_until
  ) values
    (employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
     'CAO Test', '2026-01-01', '2026-07-01'),
    (employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
     'CAO Test 2', '2026-07-01', null);

  begin
    insert into public.employment_labor_conditions (
      tenant_id, administration_id, employee_id, employment_id,
      condition_group, valid_from, valid_until
    ) values (
      employment.tenant_id, employment.administration_id, employment.employee_id, employment.id,
      'Overlap', '2026-06-01', '2026-08-01'
    );
    raise exception 'Overlappende arbeidsvoorwaarde is toegestaan.';
  exception when exclusion_violation then null;
  end;
end
$$;

rollback;
