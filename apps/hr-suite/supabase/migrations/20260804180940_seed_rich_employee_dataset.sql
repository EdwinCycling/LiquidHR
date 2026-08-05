-- Idempotente, uitsluitend synthetische testfixture voor de bestaande demo-data.
-- Geen auth.users, BSN-ciphertext, echte IBAN's, echte foto's of storage-bytes.
-- Herhalen vernieuwt alleen records die door deze fixture zijn aangemaakt of
-- vult ontbrekende testvelden aan; bestaande auth-koppelingen blijven intact.
create or replace function internal_security.guard_administration_location_mode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'administration_company_data' then
    if new.single_location and exists (
      select 1
      from public.administration_locations location
      where location.tenant_id = new.tenant_id
        and location.administration_id = new.administration_id
    ) then
      raise exception 'COMPANY_HAS_LOCATIONS' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'administration_locations' then
    if exists (
      select 1
      from public.administration_company_data company
      where company.tenant_id = new.tenant_id
        and company.administration_id = new.administration_id
        and company.single_location
    ) then
      raise exception 'SINGLE_LOCATION_MODE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  v_actor uuid;
begin
  select access.user_id
  into v_actor
  from public.user_access access
  where access.is_active
  order by access.created_at
  limit 1;

  create temporary table rich_people on commit drop as
  select
    employee.id as employee_id,
    employee.tenant_id,
    employee.employee_number,
    employee.first_name,
    employee.birth_name,
    employee.original_hire_date,
    employee.is_active,
    row_number() over (
      partition by employee.tenant_id
      order by employee.employee_number, employee.id
    )::integer as sequence_no,
    coalesce(
      (
        select assignment.administration_id
        from public.employee_administration_assignments assignment
        where assignment.employee_id = employee.id
          and assignment.effective_from <= current_date
          and (assignment.effective_to is null or assignment.effective_to >= current_date)
        order by assignment.effective_from desc
        limit 1
      ),
      (
        select employment.administration_id
        from public.employments employment
        where employment.employee_id = employee.id
          and employment.deleted_at is null
        order by employment.is_primary desc, employment.starts_on desc
        limit 1
      ),
      (
        select administration.id
        from public.administrations administration
        where administration.tenant_id = employee.tenant_id
          and administration.is_active
        order by administration.code
        limit 1
      )
    ) as administration_id
  from public.employees employee
  where employee.deleted_at is null;

  create index rich_people_employee_idx on rich_people (employee_id);
  create index rich_people_admin_idx on rich_people (tenant_id, administration_id);

  update public.administration_company_data company
  set single_location = false
  where exists (
    select 1 from rich_people person
    where person.administration_id = company.administration_id
  );

  -- Eén synthetische hoofdlocatie per administratie.
  insert into public.administration_locations (
    id, tenant_id, administration_id, name, address_line_1, street,
    house_number, postal_code, city, region, country_code, source,
    source_reference, is_active
  )
  select
    md5('liquidhr-rich-v1:location:' || administration.id::text)::uuid,
    administration.tenant_id,
    administration.id,
    'Testlocatie ' || administration.code,
    'Kunstmatige testlocatie ' || administration.code,
    case when mod(length(administration.code), 2) = 0 then 'Stationsplein' else 'Innovatielaan' end,
    case when mod(length(administration.code), 2) = 0 then '12' else '48' end,
    case when mod(length(administration.code), 2) = 0 then '3511AB' else '5611AB' end,
    case when mod(length(administration.code), 2) = 0 then 'Utrecht' else 'Eindhoven' end,
    case when mod(length(administration.code), 2) = 0 then 'Utrecht' else 'Noord-Brabant' end,
    'NL', 'manual', 'liquidhr-rich-v1', true
  from public.administrations administration
  where administration.is_active
    and exists (
      select 1 from rich_people person
      where person.administration_id = administration.id
    )
  on conflict (id) do update set
    name = excluded.name,
    address_line_1 = excluded.address_line_1,
    street = excluded.street,
    house_number = excluded.house_number,
    postal_code = excluded.postal_code,
    city = excluded.city,
    region = excluded.region,
    is_active = true;

  -- Vijf afdelingen en functies per tenant geven de lijst en teamscope
  -- realistische spreiding zonder een tweede catalogus te introduceren.
  insert into public.departments (
    id, tenant_id, parent_id, code, name, description, administration_id, scope_type
  )
  select
    md5('liquidhr-rich-v1:department:' || tenant.id::text || ':' || slot.value::text)::uuid,
    tenant.id,
    null,
    'RICH-' || lpad(slot.value::text, 2, '0'),
    case slot.value
      when 1 then 'Test People & Culture'
      when 2 then 'Test Operations'
      when 3 then 'Test Finance'
      when 4 then 'Test Customer Success'
      else 'Test Product & Technology'
    end,
    'Synthetische afdeling voor performance- en roltests.',
    null,
    'TENANT'
  from (select distinct tenant_id as id from rich_people) tenant
  cross join generate_series(1, 5) slot(value)
  on conflict (id) do update set
    code = excluded.code,
    name = excluded.name,
    description = excluded.description,
    is_active = true;

  insert into public.job_groups (id, tenant_id, code, name, description, is_active)
  select
    md5('liquidhr-rich-v1:job-group:' || tenant.id::text || ':' || slot.value::text)::uuid,
    tenant.id,
    'RICH-JG-' || lpad(slot.value::text, 2, '0'),
    case slot.value
      when 1 then 'Test People & Culture'
      when 2 then 'Test Operations'
      when 3 then 'Test Finance'
      when 4 then 'Test Customer Success'
      else 'Test Product & Technology'
    end,
    'Synthetische functiegroep voor performance- en roltests.',
    true
  from (select distinct tenant_id as id from rich_people) tenant
  cross join generate_series(1, 5) slot(value)
  on conflict (id) do update set
    code = excluded.code,
    name = excluded.name,
    description = excluded.description,
    is_active = true;

  insert into public.jobs (id, tenant_id, job_group_id, code, seniority_id)
  select
    md5('liquidhr-rich-v1:job:' || tenant.id::text || ':' || slot.value::text)::uuid,
    tenant.id,
    md5('liquidhr-rich-v1:job-group:' || tenant.id::text || ':' || slot.value::text)::uuid,
    'RICH-FUN-' || lpad(slot.value::text, 2, '0'),
    null
  from (select distinct tenant_id as id from rich_people) tenant
  cross join generate_series(1, 5) slot(value)
  on conflict (id) do update set
    job_group_id = excluded.job_group_id,
    code = excluded.code,
    is_active = true;

  insert into public.cost_centers (id, tenant_id, administration_id, code, name, is_active)
  select
    md5('liquidhr-rich-v1:cost-center:' || person.administration_id::text || ':' || slot.value::text)::uuid,
    administration.tenant_id,
    administration.id,
    'RICH-CC-' || lpad(slot.value::text, 2, '0'),
    'Test kostenplaats ' || slot.value::text,
    true
  from (select distinct administration_id from rich_people where administration_id is not null) person
  join public.administrations administration on administration.id = person.administration_id
  cross join generate_series(1, 3) slot(value)
  on conflict (id) do update set name = excluded.name, is_active = true;

  insert into public.cost_carriers (id, tenant_id, administration_id, code, name, is_active)
  select
    md5('liquidhr-rich-v1:cost-carrier:' || person.administration_id::text || ':' || slot.value::text)::uuid,
    administration.tenant_id,
    administration.id,
    'RICH-DR-' || lpad(slot.value::text, 2, '0'),
    'Test kostendrager ' || slot.value::text,
    true
  from (select distinct administration_id from rich_people where administration_id is not null) person
  join public.administrations administration on administration.id = person.administration_id
  cross join generate_series(1, 3) slot(value)
  on conflict (id) do update set name = excluded.name, is_active = true;

  -- Actieve personen zonder actuele assignment of employment krijgen een
  -- eenvoudige bevestigde testbasis. Historische, uit dienst zijnde records
  -- worden niet opnieuw actief gemaakt.
  insert into public.employee_administration_assignments (
    id, tenant_id, administration_id, employee_id, effective_from, effective_to
  )
  select
    md5('liquidhr-rich-v1:assignment:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.administration_id,
    person.employee_id,
    coalesce(person.original_hire_date, current_date - 365),
    null
  from rich_people person
  where person.is_active
    and person.administration_id is not null
    and not exists (
      select 1
      from public.employee_administration_assignments assignment
      where assignment.employee_id = person.employee_id
        and assignment.administration_id = person.administration_id
        and assignment.effective_from <= current_date
        and (assignment.effective_to is null or assignment.effective_to >= current_date)
    )
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to;

  insert into public.employments (
    id, tenant_id, administration_id, employee_id, employment_number,
    employment_type, contract_type, record_status, starts_on, ends_on,
    seniority_date, original_hire_date, is_primary, country_code, reason_started
  )
  select
    md5('liquidhr-rich-v1:employment:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.administration_id,
    person.employee_id,
    'RICH-TEST-' || lpad(person.sequence_no::text, 4, '0'),
    'EMPLOYEE',
    'INDEFINITE',
    'CONFIRMED',
    greatest(
      current_date - 365,
      coalesce(
        (
          select max(previous_employment.ends_on) + 1
          from public.employments previous_employment
          where previous_employment.employee_id = person.employee_id
            and previous_employment.deleted_at is null
            and previous_employment.is_primary
            and previous_employment.ends_on is not null
        ),
        current_date - 365
      )
    ),
    null,
    coalesce(person.original_hire_date, current_date - 365),
    coalesce(person.original_hire_date, current_date - 365),
    true,
    'NL',
    'Synthetische performance-fixture.'
  from rich_people person
  where person.is_active
    and person.administration_id is not null
    and not exists (
      select 1
      from public.employments employment
      where employment.employee_id = person.employee_id
        and employment.deleted_at is null
        and employment.record_status = 'CONFIRMED'
        and employment.is_primary
        and (employment.ends_on is null or employment.ends_on >= current_date)
    )
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    record_status = excluded.record_status,
    is_primary = excluded.is_primary,
    ends_on = excluded.ends_on;

  insert into public.employment_contracts (
    id, tenant_id, administration_id, employee_id, employment_id,
    sequence_number, worker_type, flex_phase_id, labor_condition_set_id,
    duration_type, starts_on, ends_on, probation_applies, probation_ends_on
  )
  select
    md5('liquidhr-rich-v1:contract:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.administration_id,
    person.employee_id,
    md5('liquidhr-rich-v1:employment:' || person.employee_id::text)::uuid,
    1,
    'EMPLOYEE',
    null,
    labor_condition.id,
    'INDEFINITE',
    greatest(
      current_date - 365,
      coalesce(
        (
          select max(previous_employment.ends_on) + 1
          from public.employments previous_employment
          where previous_employment.employee_id = person.employee_id
            and previous_employment.deleted_at is null
            and previous_employment.is_primary
            and previous_employment.ends_on is not null
        ),
        current_date - 365
      )
    ),
    null,
    false,
    null
  from rich_people person
  join lateral (
    select condition_set.id
    from public.labor_condition_sets condition_set
    where condition_set.administration_id = person.administration_id
      and condition_set.is_active
    order by condition_set.code
    limit 1
  ) labor_condition on true
  where person.is_active
    and person.administration_id is not null
    and exists (
      select 1
      from public.employments employment
      where employment.id = md5('liquidhr-rich-v1:employment:' || person.employee_id::text)::uuid
    )
    and not exists (
      select 1 from public.employment_contracts contract
      where contract.employment_id = md5('liquidhr-rich-v1:employment:' || person.employee_id::text)::uuid
    )
  on conflict (id) do update set
    labor_condition_set_id = excluded.labor_condition_set_id,
    duration_type = excluded.duration_type,
    ends_on = excluded.ends_on;

  create temporary table rich_scope on commit drop as
  select
    person.*,
    coalesce(current_employment.administration_id, person.administration_id) as resolved_administration_id,
    current_employment.id as employment_id,
    current_employment.starts_on as employment_starts_on,
    current_employment.ends_on as employment_ends_on
  from rich_people person
  left join lateral (
    select employment.*
    from public.employments employment
    where employment.employee_id = person.employee_id
      and employment.deleted_at is null
      and employment.record_status = 'CONFIRMED'
      and employment.is_primary
      and (employment.ends_on is null or employment.ends_on >= current_date)
    order by
      employment.starts_on desc
    limit 1
  ) current_employment on true;

  create index rich_scope_employee_idx on rich_scope (employee_id);
  create index rich_scope_employment_idx on rich_scope (employment_id);

  insert into public.income_relationships (
    id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
    ikv_number, relationship_type, starts_on, ends_on, reporting_status
  )
  select
    md5('liquidhr-rich-v1:income-relationship:' || scope.employment_id::text)::uuid,
    scope.tenant_id,
    scope.resolved_administration_id,
    scope.employee_id,
    lpad((100 + scope.sequence_no)::text, 4, '0'),
    1 + mod(scope.sequence_no - 1, 99),
    'EMPLOYMENT',
    coalesce(scope.employment_starts_on, current_date - 365),
    scope.employment_ends_on,
    'DRAFT'
  from rich_scope scope
  where scope.employment_id is not null
    and not exists (
      select 1
      from public.employment_income_relationships link
      where link.employment_id = scope.employment_id
        and link.valid_from <= current_date
        and (link.valid_until is null or link.valid_until >= current_date)
    )
  on conflict (id) do update set
    ends_on = excluded.ends_on,
    reporting_status = excluded.reporting_status;

  insert into public.employment_income_relationships (
    id, tenant_id, administration_id, employee_id, employment_id,
    income_relationship_id, valid_from, valid_until
  )
  select
    md5('liquidhr-rich-v1:employment-income-link:' || scope.employment_id::text)::uuid,
    scope.tenant_id,
    scope.resolved_administration_id,
    scope.employee_id,
    scope.employment_id,
    md5('liquidhr-rich-v1:income-relationship:' || scope.employment_id::text)::uuid,
    greatest(
      coalesce(scope.employment_starts_on, current_date - 365),
      coalesce(
        (
          select max(previous_link.valid_until)
          from public.employment_income_relationships previous_link
          where previous_link.employment_id = scope.employment_id
            and previous_link.valid_until is not null
        ),
        current_date - 365
      )
    ),
    scope.employment_ends_on
  from rich_scope scope
  where scope.employment_id is not null
    and exists (
      select 1
      from public.income_relationships relationship
      where relationship.id = md5('liquidhr-rich-v1:income-relationship:' || scope.employment_id::text)::uuid
    )
    and not exists (
      select 1
      from public.employment_income_relationships link
      where link.employment_id = scope.employment_id
        and (link.valid_until is null or link.valid_until > current_date)
    )
  on conflict (id) do update set
    income_relationship_id = excluded.income_relationship_id,
    valid_until = excluded.valid_until;

  -- Persoonskaart: telefoons, opleiding, burgerlijke staat, testkenmerken en
  -- een ingebedde synthetische SVG-avatar. Bestaande e-mail/auth blijft staan.
  update public.employees employee
  set
    private_phone = coalesce(employee.private_phone, '+31 6 ' || lpad((200000 + person.sequence_no * 137)::text, 6, '0')),
    private_mobile = coalesce(employee.private_mobile, '+31 6 ' || lpad((300000 + person.sequence_no * 149)::text, 6, '0')),
    work_phone = coalesce(employee.work_phone, '+31 30 ' || lpad((400000 + person.sequence_no * 157)::text, 6, '0')),
    work_phone_ext = coalesce(employee.work_phone_ext, lpad((100 + person.sequence_no)::text, 3, '0')),
    work_mobile = coalesce(employee.work_mobile, '+31 6 ' || lpad((500000 + person.sequence_no * 163)::text, 6, '0')),
    avatar_url = coalesce(
      employee.avatar_url,
      'data:image/svg+xml;base64,' || encode(convert_to(format(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="%s"/><circle cx="80" cy="62" r="28" fill="#F8D2B0"/><path d="M34 143c4-32 25-49 46-49s42 17 46 49" fill="#F8D2B0"/><circle cx="70" cy="60" r="4" fill="#16324F"/><circle cx="90" cy="60" r="4" fill="#16324F"/><path d="M65 76c10 8 20 8 30 0" fill="none" stroke="#16324F" stroke-width="4" stroke-linecap="round"/></svg>',
        case mod(person.sequence_no, 5)
          when 0 then '#BFE3F2'
          when 1 then '#D9C7F2'
          when 2 then '#C9E8D0'
          when 3 then '#F4D6A6'
          else '#F2C6D4'
        end
      ), 'UTF8'), 'base64')
    ),
    marital_status = coalesce(employee.marital_status, case mod(person.sequence_no, 5) when 0 then 'MARRIED' when 1 then 'SINGLE' when 2 then 'REGISTERED_PARTNERSHIP' when 3 then 'DIVORCED' else 'SINGLE' end::public.marital_status),
    education_level = coalesce(employee.education_level, case mod(person.sequence_no, 4) when 0 then 'MBO' when 1 then 'HBO' when 2 then 'WO' else 'HBO' end::public.education_level),
    custom_fields = employee.custom_fields || jsonb_build_object(
      'rich_test_fixture', 'liquidhr-rich-v1',
      'synthetic_profile_index', person.sequence_no,
      'performance_scenarios', jsonb_build_array(
        case when mod(person.sequence_no, 2) = 0 then 'team-scope' else 'company-scope' end,
        case when mod(person.sequence_no, 3) = 0 then 'salary-history' else 'standard-employment' end,
        case when mod(person.sequence_no, 4) = 0 then 'international-address' else 'dutch-address' end
      )
    )
  from rich_people person
  where employee.id = person.employee_id;

  -- Vul een bestaande primaire adreskaart bij of maak er een aan, plus een
  -- secundaire kaart voor de adres-tab en URL-/zoekfilters.
  insert into public.employee_addresses (
    id, tenant_id, employee_id, street, house_number, postal_code, city,
    region, country_code, valid_from, valid_until, address_line_1,
    address_line_2, postal_code_normalized, source, source_reference,
    address_type, description
  )
  select
    md5('liquidhr-rich-v1:primary-address:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.employee_id,
    case when mod(person.sequence_no, 5) = 0 then 'Mechelsesteenweg' when mod(person.sequence_no, 5) = 1 then 'Invalidenstrasse' else 'Teststraat' end,
    case when mod(person.sequence_no, 5) = 0 then '18' when mod(person.sequence_no, 5) = 1 then '27' else (10 + person.sequence_no)::text end,
    case when mod(person.sequence_no, 5) = 0 then '2000' when mod(person.sequence_no, 5) = 1 then '10115' else '35' || lpad((100 + person.sequence_no)::text, 2, '0') || 'AB' end,
    case when mod(person.sequence_no, 5) = 0 then 'Antwerpen' when mod(person.sequence_no, 5) = 1 then 'Berlin' else 'Utrecht' end,
    case when mod(person.sequence_no, 5) = 0 then 'Antwerpen' when mod(person.sequence_no, 5) = 1 then 'Berlin' else 'Utrecht' end,
    case when mod(person.sequence_no, 5) = 0 then 'BE' when mod(person.sequence_no, 5) = 1 then 'DE' else 'NL' end,
    greatest(coalesce(person.original_hire_date, current_date - 365), current_date - 365),
    null,
    case when mod(person.sequence_no, 5) = 0 then 'Mechelsesteenweg 18' when mod(person.sequence_no, 5) = 1 then 'Invalidenstrasse 27' else 'Teststraat ' || (10 + person.sequence_no)::text end,
    null,
    case when mod(person.sequence_no, 5) = 0 then '2000' when mod(person.sequence_no, 5) = 1 then '10115' else '35' || lpad((100 + person.sequence_no)::text, 2, '0') || 'AB' end,
    'manual',
    'liquidhr-rich-v1',
    'PRIMARY',
    'Synthetisch primair adres voor testdoeleinden.'
  from rich_people person
  where not exists (
    select 1 from public.employee_addresses existing_address
    where existing_address.employee_id = person.employee_id
      and existing_address.deleted_at is null
      and existing_address.address_type = 'PRIMARY'
  )
  on conflict (id) do update set
    address_line_1 = excluded.address_line_1,
    city = excluded.city,
    country_code = excluded.country_code,
    description = excluded.description,
    deleted_at = null;

  insert into public.employee_addresses (
    id, tenant_id, employee_id, street, house_number, postal_code, city,
    region, country_code, valid_from, valid_until, address_line_1,
    address_line_2, postal_code_normalized, source, source_reference,
    address_type, description
  )
  select
    md5('liquidhr-rich-v1:secondary-address:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.employee_id,
    'Thuiswerklaan',
    (20 + person.sequence_no)::text,
    '37' || lpad((100 + person.sequence_no)::text, 2, '0') || 'CD',
    'Amersfoort',
    'Utrecht',
    'NL',
    current_date - 365,
    current_date + 180,
    'Thuiswerklaan ' || (20 + person.sequence_no)::text,
    'Unit ' || lpad(person.sequence_no::text, 2, '0'),
    '37' || lpad((100 + person.sequence_no)::text, 2, '0') || 'CD',
    'manual',
    'liquidhr-rich-v1',
    'SECONDARY',
    'Synthetisch secundair adres voor thuiswerk- en zoektests.'
  from rich_people person
  where not exists (
    select 1 from public.employee_addresses existing_address
    where existing_address.id = md5('liquidhr-rich-v1:secondary-address:' || person.employee_id::text)::uuid
  )
  on conflict (id) do update set
    address_line_1 = excluded.address_line_1,
    address_line_2 = excluded.address_line_2,
    description = excluded.description,
    deleted_at = null;

  insert into public.employee_bank_accounts (
    id, tenant_id, employee_id, iban_ciphertext, iban_last_four, bic,
    account_holder, description, is_primary
  )
  select
    md5('liquidhr-rich-v1:primary-bank:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.employee_id,
    'fixture-ciphertext-rich-v1-' || md5(person.employee_id::text),
    lpad((1000 + person.sequence_no)::text, 4, '0'),
    'ABNANL2A',
    left(trim(person.first_name || ' ' || person.birth_name), 160),
    'Synthetische testrekening; geen echte IBAN.',
    true
  from rich_people person
  where not exists (
    select 1 from public.employee_bank_accounts account
    where account.employee_id = person.employee_id
      and account.deleted_at is null
      and account.is_primary
  )
  on conflict (id) do update set
    iban_ciphertext = excluded.iban_ciphertext,
    iban_last_four = excluded.iban_last_four,
    bic = excluded.bic,
    account_holder = excluded.account_holder,
    description = excluded.description,
    is_primary = true,
    deleted_at = null;

  insert into public.employee_bank_accounts (
    id, tenant_id, employee_id, iban_ciphertext, iban_last_four, bic,
    account_holder, description, is_primary
  )
  select
    md5('liquidhr-rich-v1:secondary-bank:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.employee_id,
    'fixture-ciphertext-rich-v1-secondary-' || md5(person.employee_id::text),
    lpad((5000 + person.sequence_no)::text, 4, '0'),
    'RABONL2U',
    left(trim(person.first_name || ' ' || person.birth_name), 160),
    'Synthetische tweede rekening voor lijst- en archiveertests.',
    false
  from rich_people person
  where mod(person.sequence_no, 3) = 0
  on conflict (id) do update set
    iban_ciphertext = excluded.iban_ciphertext,
    iban_last_four = excluded.iban_last_four,
    bic = excluded.bic,
    account_holder = excluded.account_holder,
    description = excluded.description,
    is_primary = false,
    deleted_at = null;

  insert into public.employee_relations (
    id, tenant_id, employee_id, relation_type, is_emergency_contact,
    first_name, initials, last_name, gender, phone, mobile, email, notes
  )
  select
    md5('liquidhr-rich-v1:partner:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.employee_id,
    'PARTNER',
    mod(person.sequence_no, 2) = 0,
    'Testcontact',
    'TC',
    'Partner ' || lpad(person.sequence_no::text, 3, '0'),
    case when mod(person.sequence_no, 2) = 0 then 'FEMALE'::public.gender else 'MALE'::public.gender end,
    '+31 30 ' || lpad((600000 + person.sequence_no * 173)::text, 6, '0'),
    '+31 6 ' || lpad((700000 + person.sequence_no * 179)::text, 6, '0'),
    'partner-' || person.sequence_no::text || '@liquidhr.invalid',
    'Synthetische relatie voor testdoeleinden.'
  from rich_people person
  on conflict (id) do update set
    relation_type = excluded.relation_type,
    is_emergency_contact = excluded.is_emergency_contact,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    mobile = excluded.mobile,
    email = excluded.email,
    notes = excluded.notes,
    deleted_at = null;

  insert into public.employee_relations (
    id, tenant_id, employee_id, relation_type, is_emergency_contact,
    first_name, initials, last_name, gender, phone, mobile, email, notes
  )
  select
    md5('liquidhr-rich-v1:child:' || person.employee_id::text)::uuid,
    person.tenant_id,
    person.employee_id,
    'CHILD',
    false,
    'Testkind',
    'TK',
    'Kind ' || lpad(person.sequence_no::text, 3, '0'),
    case when mod(person.sequence_no, 2) = 0 then 'MALE'::public.gender else 'FEMALE'::public.gender end,
    null,
    null,
    null,
    'Synthetische gezinsrelatie voor testdoeleinden.'
  from rich_people person
  where mod(person.sequence_no, 4) = 0
  on conflict (id) do update set
    relation_type = excluded.relation_type,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    notes = excluded.notes,
    deleted_at = null;

  -- Organisatie: iedere medewerker krijgt een afdeling, functie, locatie en
  -- waar mogelijk een directe testmanager. Bestaande actuele plaatsingen
  -- worden verrijkt; ontbrekende plaatsingen worden aangemaakt.
  with targets as (
    select
      scope.*,
      md5('liquidhr-rich-v1:department:' || scope.tenant_id::text || ':' || (1 + mod(scope.sequence_no - 1, 5))::text)::uuid as department_id,
      md5('liquidhr-rich-v1:job:' || scope.tenant_id::text || ':' || (1 + mod(scope.sequence_no - 1, 5))::text)::uuid as job_id,
      md5('liquidhr-rich-v1:location:' || scope.resolved_administration_id::text)::uuid as location_id,
      manager.employee_id as manager_id
    from rich_scope scope
    left join lateral (
      select manager_scope.employee_id
      from rich_scope manager_scope
      where manager_scope.resolved_administration_id = scope.resolved_administration_id
        and manager_scope.is_active
      order by manager_scope.employee_number
      limit 1
    ) manager on true
    where scope.resolved_administration_id is not null
      and scope.employment_id is not null
  )
  update public.employee_organizations organization
  set
    department_id = target.department_id,
    direct_manager_id = case when target.manager_id = target.employee_id then null else target.manager_id end,
    effective_from = organization.effective_from,
    job_title = case mod(target.sequence_no - 1, 5) when 0 then 'People specialist' when 1 then 'Operations specialist' when 2 then 'Finance specialist' when 3 then 'Customer success specialist' else 'Product specialist' end,
    cost_bearer = 'RICH-DR-' || lpad((1 + mod(target.sequence_no - 1, 3))::text, 2, '0'),
    administration_id = organization.administration_id,
    employment_id = organization.employment_id,
    job_id = target.job_id,
    location_id = target.location_id
  from targets target
  where organization.id = (
    select existing.id
    from public.employee_organizations existing
    where existing.employee_id = target.employee_id
      and existing.administration_id = target.resolved_administration_id
      and existing.effective_from <= current_date
      and (existing.effective_to is null or existing.effective_to >= current_date)
    order by existing.effective_from desc
    limit 1
  );

  with targets as (
    select
      scope.*,
      md5('liquidhr-rich-v1:department:' || scope.tenant_id::text || ':' || (1 + mod(scope.sequence_no - 1, 5))::text)::uuid as department_id,
      md5('liquidhr-rich-v1:job:' || scope.tenant_id::text || ':' || (1 + mod(scope.sequence_no - 1, 5))::text)::uuid as job_id,
      md5('liquidhr-rich-v1:location:' || scope.resolved_administration_id::text)::uuid as location_id,
      manager.employee_id as manager_id
    from rich_scope scope
    left join lateral (
      select manager_scope.employee_id
      from rich_scope manager_scope
      where manager_scope.resolved_administration_id = scope.resolved_administration_id
        and manager_scope.is_active
      order by manager_scope.employee_number
      limit 1
    ) manager on true
    where scope.is_active
      and scope.resolved_administration_id is not null
      and scope.employment_id is not null
      and not exists (
        select 1
        from public.employee_organizations existing
        where existing.employee_id = scope.employee_id
          and existing.administration_id = scope.resolved_administration_id
          and existing.effective_from <= current_date
          and (existing.effective_to is null or existing.effective_to >= current_date)
      )
  )
  insert into public.employee_organizations (
    id, tenant_id, employee_id, department_id, direct_manager_id,
    effective_from, effective_to, direct_manager_deputy_id, job_title,
    cost_bearer, administration_id, employment_id, job_id, location_id
  )
  select
    md5('liquidhr-rich-v1:organization:' || target.employee_id::text)::uuid,
    target.tenant_id,
    target.employee_id,
    target.department_id,
    case when target.manager_id = target.employee_id then null else target.manager_id end,
    greatest(
      current_date,
      coalesce(
        (
          select max(existing.effective_to) + 1
          from public.employee_organizations existing
          where existing.employee_id = target.employee_id
            and existing.administration_id = target.resolved_administration_id
            and existing.effective_to is not null
        ),
        current_date
      )
    ),
    null,
    null,
    case mod(target.sequence_no - 1, 5) when 0 then 'People specialist' when 1 then 'Operations specialist' when 2 then 'Finance specialist' when 3 then 'Customer success specialist' else 'Product specialist' end,
    'RICH-DR-' || lpad((1 + mod(target.sequence_no - 1, 3))::text, 2, '0'),
    target.resolved_administration_id,
    target.employment_id,
    target.job_id,
    target.location_id
  from targets target
  on conflict (id) do update set
    department_id = excluded.department_id,
    direct_manager_id = excluded.direct_manager_id,
    job_title = excluded.job_title,
    administration_id = excluded.administration_id,
    employment_id = excluded.employment_id,
    job_id = excluded.job_id,
    location_id = excluded.location_id,
    effective_to = null;

  -- Rooster, salaris, arbeidsvoorwaarden en kostenverdeling voor ieder
  -- dienstverband waarvoor de bestaande demo nog geen actuele regel heeft.
  insert into public.employment_schedules (
    id, tenant_id, administration_id, employee_id, employment_id,
    schedule_type, start_week, average_days_per_week, average_hours_per_week,
    part_time_factor, time_for_time_accrual, monday_hours, tuesday_hours,
    wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours,
    valid_from, valid_until, is_on_call, on_call_obligation, work_scope
  )
  select
    md5('liquidhr-rich-v1:schedule:' || scope.employment_id::text)::uuid,
    scope.tenant_id,
    scope.resolved_administration_id,
    scope.employee_id,
    scope.employment_id,
    'HOURS_AND_SPECIFIC_DAYS',
    1,
    case when mod(scope.sequence_no, 4) = 0 then 4 else 5 end,
    case when mod(scope.sequence_no, 4) = 0 then 32 else 40 end,
    case when mod(scope.sequence_no, 4) = 0 then .8 else 1 end,
    0,
    8,
    8,
    8,
    8,
    case when mod(scope.sequence_no, 4) = 0 then null else 8 end,
    null,
    null,
    coalesce(scope.employment_starts_on, current_date - 365),
    scope.employment_ends_on,
    false,
    null,
    case when mod(scope.sequence_no, 4) = 0 then 'PART_TIME' else 'FULL_TIME' end::public.employment_work_scope
  from rich_scope scope
  where scope.employment_id is not null
    and not exists (
      select 1 from public.employment_schedules schedule
      where schedule.employment_id = scope.employment_id
        and schedule.valid_from <= current_date
        and (schedule.valid_until is null or schedule.valid_until >= current_date)
    )
  on conflict (id) do update set
    average_days_per_week = excluded.average_days_per_week,
    average_hours_per_week = excluded.average_hours_per_week,
    part_time_factor = excluded.part_time_factor,
    valid_until = excluded.valid_until,
    is_on_call = excluded.is_on_call,
    on_call_obligation = excluded.on_call_obligation,
    work_scope = excluded.work_scope;

  insert into public.employment_salaries (
    id, tenant_id, administration_id, employee_id, employment_id,
    payment_type, payment_frequency, salary_basis, fulltime_amount,
    parttime_amount, hourly_rate, currency_code, valid_from, valid_until,
    salary_frequency_id
  )
  select
    md5('liquidhr-rich-v1:salary:' || scope.employment_id::text)::uuid,
    scope.tenant_id,
    scope.resolved_administration_id,
    scope.employee_id,
    scope.employment_id,
    'PERIODIC_FIXED',
    'MONTHLY',
    'MANUAL',
    2800 + (mod(scope.sequence_no, 9) * 275),
    case when mod(scope.sequence_no, 4) = 0 then 2240 + (mod(scope.sequence_no, 9) * 220) else null end,
    null,
    'EUR',
    coalesce(scope.employment_starts_on, current_date - 365),
    scope.employment_ends_on,
    frequency.id
  from rich_scope scope
  join lateral (
    select salary_frequency.id
    from public.salary_frequencies salary_frequency
    where salary_frequency.administration_id = scope.resolved_administration_id
      and salary_frequency.is_active
      and salary_frequency.code = 'MONTHLY'
    order by salary_frequency.id
    limit 1
  ) frequency on true
  where scope.employment_id is not null
    and not exists (
      select 1 from public.employment_salaries salary
      where salary.employment_id = scope.employment_id
        and salary.valid_from <= current_date
        and (salary.valid_until is null or salary.valid_until >= current_date)
    )
  on conflict (id) do update set
    fulltime_amount = excluded.fulltime_amount,
    parttime_amount = excluded.parttime_amount,
    salary_frequency_id = excluded.salary_frequency_id,
    valid_until = excluded.valid_until;

  insert into public.employment_labor_conditions (
    id, tenant_id, administration_id, employee_id, employment_id,
    employment_contract_id, condition_group, valid_from, valid_until
  )
  select
    md5('liquidhr-rich-v1:labor-condition:' || scope.employment_id::text)::uuid,
    scope.tenant_id,
    scope.resolved_administration_id,
    scope.employee_id,
    scope.employment_id,
    contract.id,
    'RICH-CAO-' || lpad((1 + mod(scope.sequence_no - 1, 3))::text, 2, '0'),
    contract.starts_on,
    contract.ends_on
  from rich_scope scope
  join lateral (
    select contract.id, contract.starts_on, contract.ends_on
    from public.employment_contracts contract
    where contract.employment_id = scope.employment_id
    order by contract.sequence_number desc
    limit 1
  ) contract on true
  where scope.employment_id is not null
    and not exists (
      select 1 from public.employment_labor_conditions condition
      where condition.employment_id = scope.employment_id
        and condition.valid_from <= current_date
        and (condition.valid_until is null or condition.valid_until >= current_date)
    )
  on conflict (id) do update set
    employment_contract_id = excluded.employment_contract_id,
    condition_group = excluded.condition_group,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  insert into public.employment_cost_allocations (
    id, tenant_id, administration_id, employee_id, employment_id,
    cost_center_id, cost_carrier_id, percentage, valid_from, valid_until
  )
  select
    md5('liquidhr-rich-v1:cost-allocation:' || scope.employment_id::text)::uuid,
    scope.tenant_id,
    scope.resolved_administration_id,
    scope.employee_id,
    scope.employment_id,
    md5('liquidhr-rich-v1:cost-center:' || scope.resolved_administration_id::text || ':' || (1 + mod(scope.sequence_no - 1, 3))::text)::uuid,
    md5('liquidhr-rich-v1:cost-carrier:' || scope.resolved_administration_id::text || ':' || (1 + mod(scope.sequence_no - 1, 3))::text)::uuid,
    100,
    coalesce(scope.employment_starts_on, current_date - 365),
    scope.employment_ends_on
  from rich_scope scope
  where scope.employment_id is not null
    and not exists (
      select 1 from public.employment_cost_allocations allocation
      where allocation.employment_id = scope.employment_id
        and allocation.valid_from <= current_date
        and (allocation.valid_until is null or allocation.valid_until >= current_date)
    )
  on conflict (id) do update set
    cost_center_id = excluded.cost_center_id,
    cost_carrier_id = excluded.cost_carrier_id,
    percentage = 100,
    valid_until = excluded.valid_until;

  -- Eén historische gesloten verzuimcasus voor een deel van de populatie.
  if v_actor is not null then
    insert into public.absence_cases (
      id, tenant_id, administration_id, employee_id, employment_id, status,
      first_absence_on, effective_clock_start_on, case_manager_employee_id,
      has_sickness_benefit_safety_net, is_work_accident,
      is_third_party_traffic_accident, prior_case_count_12_months,
      frequent_absence_threshold, is_frequent_absence, closed_at,
      created_by_user_id
    )
    select
      md5('liquidhr-rich-v1:absence-case:' || scope.employee_id::text)::uuid,
      scope.tenant_id,
      scope.resolved_administration_id,
      scope.employee_id,
      scope.employment_id,
      'CLOSED',
      current_date - (90 + scope.sequence_no)::integer,
      current_date - (90 + scope.sequence_no)::integer,
      null,
      mod(scope.sequence_no, 5) = 0,
      false,
      false,
      0,
      3,
      false,
      timezone('utc', now()) - interval '45 days',
      v_actor
    from rich_scope scope
    where scope.is_active
      and scope.employment_id is not null
      and mod(scope.sequence_no, 6) = 0
    on conflict (id) do update set
      status = excluded.status,
      first_absence_on = excluded.first_absence_on,
      effective_clock_start_on = excluded.effective_clock_start_on,
      closed_at = excluded.closed_at,
      created_by_user_id = excluded.created_by_user_id;

    insert into public.absence_spells (
      id, tenant_id, case_id, started_on, expected_recovery_on,
      recovered_on, recovered_at, reported_by_user_id, recovered_by_user_id
    )
    select
      md5('liquidhr-rich-v1:absence-spell:' || scope.employee_id::text)::uuid,
      scope.tenant_id,
      md5('liquidhr-rich-v1:absence-case:' || scope.employee_id::text)::uuid,
      current_date - (90 + scope.sequence_no)::integer,
      current_date - (45 + scope.sequence_no)::integer,
      current_date - (45 + scope.sequence_no)::integer,
      timezone('utc', now()) - interval '45 days',
      v_actor,
      v_actor
    from rich_scope scope
    where scope.is_active
      and scope.employment_id is not null
      and mod(scope.sequence_no, 6) = 0
    on conflict (id) do update set
      started_on = excluded.started_on,
      expected_recovery_on = excluded.expected_recovery_on,
      recovered_on = excluded.recovered_on,
      recovered_at = excluded.recovered_at,
      reported_by_user_id = excluded.reported_by_user_id,
      recovered_by_user_id = excluded.recovered_by_user_id;

    insert into public.absence_capacity_changes (
      id, tenant_id, case_id, spell_id, effective_on, absence_percentage,
      expected_next_review_on, created_by_user_id
    )
    select
      md5('liquidhr-rich-v1:absence-capacity:' || scope.employee_id::text)::uuid,
      scope.tenant_id,
      md5('liquidhr-rich-v1:absence-case:' || scope.employee_id::text)::uuid,
      md5('liquidhr-rich-v1:absence-spell:' || scope.employee_id::text)::uuid,
      current_date - (90 + scope.sequence_no)::integer,
      case when mod(scope.sequence_no, 2) = 0 then 50 else 100 end,
      current_date - (60 + scope.sequence_no)::integer,
      v_actor
    from rich_scope scope
    where scope.is_active
      and scope.employment_id is not null
      and mod(scope.sequence_no, 6) = 0
    on conflict (id) do update set
      effective_on = excluded.effective_on,
      absence_percentage = excluded.absence_percentage,
      expected_next_review_on = excluded.expected_next_review_on,
      created_by_user_id = excluded.created_by_user_id;

    insert into public.employee_notes (
      id, tenant_id, administration_id, employee_id, title,
      description, created_by_user_id, updated_by_user_id
    )
    select
      md5('liquidhr-rich-v1:note:' || scope.employee_id::text)::uuid,
      scope.tenant_id,
      scope.resolved_administration_id,
      scope.employee_id,
      'Synthetische testnotitie',
      'Fixture voor dossier-, zoek- en performancecontrole. Geen echte personeelsinformatie.',
      v_actor,
      v_actor
    from rich_scope scope
    where mod(scope.sequence_no, 2) = 0
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      updated_by_user_id = excluded.updated_by_user_id;

    insert into public.employee_activity_entries (
      id, tenant_id, administration_id, employee_id, created_by_user_id, message
    )
    select
      md5('liquidhr-rich-v1:activity:' || scope.employee_id::text)::uuid,
      scope.tenant_id,
      scope.resolved_administration_id,
      scope.employee_id,
      v_actor,
      'Synthetische testactiviteit voor performancecontrole.'
    from rich_scope scope
    where mod(scope.sequence_no, 3) = 0
    on conflict (id) do update set
      message = excluded.message;
  end if;
end;
$$;
