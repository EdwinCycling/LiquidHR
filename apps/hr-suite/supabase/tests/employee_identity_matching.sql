begin;

do $$
declare
  tenant_one uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  tenant_two uuid := md5('tenant:noorderlicht-zorggroep')::uuid;
  employee_one uuid;
  employee_two uuid;
  duplicate_employee uuid;
begin
  select id into employee_one from public.employees
  where tenant_id = tenant_one order by employee_number limit 1;
  select id into employee_two from public.employees
  where tenant_id = tenant_two order by employee_number limit 1;

  select id into duplicate_employee from public.employees
  where tenant_id = tenant_one and id <> employee_one order by employee_number limit 1;

  delete from public.employee_secure_identifiers
  where employee_id in (employee_one, employee_two, duplicate_employee);
  insert into public.employee_secure_identifiers (
    tenant_id, employee_id, bsn_ciphertext, bsn_fingerprint
  ) values
    (tenant_one, employee_one, 'test-ciphertext-one', repeat('a', 64)),
    (tenant_two, employee_two, 'test-ciphertext-two', repeat('a', 64));

  begin
    insert into public.employee_secure_identifiers (
      tenant_id, employee_id, bsn_ciphertext, bsn_fingerprint
    ) values (
      tenant_one, duplicate_employee, 'test-ciphertext-duplicate', repeat('a', 64)
    );
    raise exception 'BSN-vingerafdruk faalt: duplicaat binnen tenant toegestaan.';
  exception when unique_violation then null;
  end;
end
$$;

rollback;
