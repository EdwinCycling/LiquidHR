begin;

do $$
declare
  demo_tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  second_tenant uuid := md5('tenant:noorderlicht-zorggroep')::uuid;
  demo_employee uuid;
  second_employee uuid;
  first_number text;
  second_number text;
begin
  select id into demo_employee
  from public.employees
  where tenant_id = demo_tenant
  order by employee_number
  limit 1;

  select id into second_employee
  from public.employees
  where tenant_id = second_tenant
  order by employee_number
  limit 1;

  first_number := public.reserve_employee_number(demo_tenant);
  second_number := public.reserve_employee_number(demo_tenant);

  if first_number::bigint + 1 <> second_number::bigint then
    raise exception 'Personeelsnummerreeks is niet oplopend per tenant.';
  end if;

  insert into public.employee_addresses (
    tenant_id, employee_id, street, house_number, postal_code, city,
    country_code, valid_from
  ) values (
    demo_tenant, demo_employee, 'Teststraat', '1', '1234AB', 'Amsterdam',
    'NL', '2026-01-01'
  );

  begin
    insert into public.employee_addresses (
      tenant_id, employee_id, street, house_number, postal_code, city,
      country_code, valid_from
    ) values (
      demo_tenant, demo_employee, 'Andere straat', '2', '1234AB', 'Amsterdam',
      'NL', '2026-06-01'
    );
    raise exception 'Overlappende adresperioden zijn toegestaan.';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.employee_addresses (
      tenant_id, employee_id, street, house_number, postal_code, city,
      country_code, valid_from
    ) values (
      demo_tenant, second_employee, 'Lekstraat', '9', '9999ZZ', 'Utrecht',
      'NL', '2026-01-01'
    );
    raise exception 'Cross-tenant employee-adres is toegestaan.';
  exception when foreign_key_violation then null;
  end;

  insert into public.employee_bank_accounts (
    tenant_id, employee_id, iban_ciphertext, iban_last_four,
    account_holder, is_primary
  ) values (
    demo_tenant, demo_employee, 'ciphertext-one', '0123', 'Test Persoon', true
  );

  begin
    insert into public.employee_bank_accounts (
      tenant_id, employee_id, iban_ciphertext, iban_last_four,
      account_holder, is_primary
    ) values (
      demo_tenant, demo_employee, 'ciphertext-two', '4567', 'Test Persoon', true
    );
    raise exception 'Twee actieve primaire bankrekeningen zijn toegestaan.';
  exception when unique_violation then null;
  end;

  insert into public.employee_relations (
    tenant_id, employee_id, relation_type, first_name, last_name,
    is_emergency_contact
  ) values (
    demo_tenant, demo_employee, 'OTHER', 'Test', 'Contact', true
  );

  if not exists (
    select 1 from public.audit_logs
    where tenant_id = demo_tenant
      and entity_name in ('employee_address', 'employee_bank_account', 'employee_relation')
  ) then
    raise exception 'Audittrail voor medewerker-subresources ontbreekt.';
  end if;

  if exists (
    select 1 from public.audit_logs
    where changes::text like '%ciphertext-one%'
  ) then
    raise exception 'Gevoelige bankgegevens zijn in audit opgeslagen.';
  end if;
end
$$;

rollback;
