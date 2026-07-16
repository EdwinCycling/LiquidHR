begin;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  employee uuid;
  employment_one uuid := md5('employment:test-one')::uuid;
  employment_two uuid := md5('employment:test-two')::uuid;
  income_one uuid := md5('income:test-one')::uuid;
begin
  select id into administration from public.administrations
  where tenant_id = tenant order by code limit 1;
  select id into employee from public.employees
  where tenant_id = tenant order by employee_number limit 1;

  insert into public.employments (
    id, tenant_id, administration_id, employee_id, employment_number,
    contract_type, record_status, starts_on, seniority_date, original_hire_date
  ) values
    (employment_one, tenant, administration, employee, 'TEST-PAR-1', 'INDEFINITE', 'CONFIRMED', '2026-01-01', '2026-01-01', '2026-01-01'),
    (employment_two, tenant, administration, employee, 'TEST-PAR-2', 'DEFINITE', 'CONFIRMED', '2026-02-01', '2026-02-01', '2026-02-01');

  if (select count(*) from public.employments where id in (employment_one, employment_two)) <> 2 then
    raise exception 'Parallelle dienstverbanden binnen één administratie zijn niet opgeslagen.';
  end if;

  insert into public.income_relationships (
    id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
    ikv_number, starts_on
  ) values (income_one, tenant, administration, employee, 'L01', 9001, '2026-01-01');

  insert into public.employment_income_relationships (
    tenant_id, administration_id, employee_id, employment_id,
    income_relationship_id, valid_from, valid_until
  ) values (tenant, administration, employee, employment_one, income_one, '2026-01-01', '2026-07-01');

  begin
    insert into public.employment_income_relationships (
      tenant_id, administration_id, employee_id, employment_id,
      income_relationship_id, valid_from
    ) values (tenant, administration, employee, employment_one, income_one, '2026-06-01');
    raise exception 'Overlappende IKV-koppeling is toegestaan.';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.employments (
      tenant_id, administration_id, employee_id, employment_number,
      contract_type, starts_on, seniority_date, original_hire_date
    ) values (
      md5('tenant:noorderlicht-zorggroep')::uuid,
      administration,
      employee,
      'TEST-CROSS',
      'INDEFINITE',
      '2026-01-01',
      '2026-01-01',
      '2026-01-01'
    );
    raise exception 'Cross-tenant dienstverband is toegestaan.';
  exception when foreign_key_violation then null;
  end;
end
$$;

rollback;
