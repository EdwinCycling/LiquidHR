-- Testfixture: uitsluitend kunstmatige data voor de demo-tenant.
-- De vaste UUID's maken deze migratie idempotent en voorkomen dubbele medewerkers.
do $$
declare
  v_tenant_id uuid;
  v_administration_id uuid;
  v_manager_id uuid;
  v_manager_user_id uuid;
  v_fin_department_id uuid;
  v_hr_department_id uuid;
  v_cost_center_id uuid;
  v_salary_step_id uuid;
begin
  select id into strict v_tenant_id
  from public.tenants
  where name = 'Liquid HR Demo Holding';

  select id into strict v_administration_id
  from public.administrations
  where tenant_id = v_tenant_id
    and name = 'Liquid HR Demo Holding B.V.'
    and is_active;

  select id into strict v_manager_id
  from public.employees
  where tenant_id = v_tenant_id
    and first_name = 'Edwin'
    and birth_name = 'Testbeheerder'
    and is_active
  limit 1;

  select id into strict v_manager_user_id
  from auth.users
  where email = 'edwin@editsolutions.nl'
  limit 1;

  select id into strict v_fin_department_id
  from public.departments
  where tenant_id = v_tenant_id
    and administration_id = v_administration_id
    and code = 'FIN';

  select id into strict v_hr_department_id
  from public.departments
  where tenant_id = v_tenant_id
    and administration_id = v_administration_id
    and code = 'HR';

  select id into strict v_cost_center_id
  from public.cost_centers
  where tenant_id = v_tenant_id
    and administration_id = v_administration_id
    and is_active
  order by code
  limit 1;

  select id into strict v_salary_step_id
  from public.salary_scale_steps
  where tenant_id = v_tenant_id
    and administration_id = v_administration_id
  order by valid_from desc, step_code
  limit 1;

  -- Medewerkers: Fin de Groot en Noah Hendriks.
  insert into public.employees (
    id, tenant_id, employee_number, initials, first_name, birth_name,
    name_usage, gender, birth_date, birth_place, birth_country, nationality,
    marital_status, education_level, preferred_language, private_email,
    private_phone, private_mobile, work_email, work_phone, work_mobile,
    original_hire_date, is_active, custom_fields
  ) values
    (
      '11111111-1111-4111-8111-111111111111', v_tenant_id, 'TEST-VERZ-047',
      'F.', 'Fin', 'de Groot', 'BIRTH_NAME', 'MALE', '1991-05-14',
      'Utrecht', 'NL', 'NL', 'SINGLE', 'HBO', 'nl',
      'fin.degroot@example.invalid', '+31 30 000 4700', '+31 6 0000 4700',
      'fin.degroot@liquid-hr.example.invalid', '+31 20 000 4700', '+31 6 1000 4700',
      '2025-01-01', true,
      '{"fixture":"verzuim-rijke-testdata","scenario":"gedeeltelijk-actief"}'::jsonb
    ),
    (
      '22222222-2222-4222-8222-222222222222', v_tenant_id, 'TEST-VERZ-048',
      'N.', 'Noah', 'Hendriks', 'BIRTH_NAME', 'MALE', '1987-10-03',
      'Amersfoort', 'NL', 'NL', 'MARRIED', 'WO', 'nl',
      'noah.hendriks@example.invalid', '+31 33 000 4800', '+31 6 0000 4800',
      'noah.hendriks@liquid-hr.example.invalid', '+31 20 000 4801', '+31 6 1000 4801',
      '2024-06-01', true,
      '{"fixture":"verzuim-rijke-testdata","scenario":"veiligheidsnet-en-historie"}'::jsonb
    )
  on conflict (id) do update set
    employee_number = excluded.employee_number,
    initials = excluded.initials,
    first_name = excluded.first_name,
    birth_name = excluded.birth_name,
    name_usage = excluded.name_usage,
    gender = excluded.gender,
    birth_date = excluded.birth_date,
    birth_place = excluded.birth_place,
    birth_country = excluded.birth_country,
    nationality = excluded.nationality,
    marital_status = excluded.marital_status,
    education_level = excluded.education_level,
    preferred_language = excluded.preferred_language,
    private_email = excluded.private_email,
    private_phone = excluded.private_phone,
    private_mobile = excluded.private_mobile,
    work_email = excluded.work_email,
    work_phone = excluded.work_phone,
    work_mobile = excluded.work_mobile,
    original_hire_date = excluded.original_hire_date,
    is_active = excluded.is_active,
    is_archived = false,
    deleted_at = null,
    custom_fields = excluded.custom_fields;

  -- Administratieve scope.
  insert into public.employee_administration_assignments (
    id, tenant_id, administration_id, employee_id, effective_from, effective_to
  ) values
    ('31111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '2025-01-01', null),
    ('32222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '2024-06-01', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to;

  -- Dienstverbanden, loonrelatie, contractvoorwaarden, rooster en salaris.
  insert into public.employments (
    id, tenant_id, administration_id, employee_id, employment_number,
    employment_type, contract_type, record_status, starts_on, probation_ends_on,
    seniority_date, original_hire_date, is_primary, reason_started
  ) values
    ('51111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', 'EMP-TEST-047-A', 'EMPLOYEE',
     'INDEFINITE', 'CONFIRMED', '2025-01-01', null, '2025-01-01', '2025-01-01',
     true, 'Testfixture primair dienstverband'),
    ('52222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', 'EMP-TEST-048-A', 'EMPLOYEE',
     'DEFINITE', 'CONFIRMED', '2024-06-01', '2024-12-01', '2024-06-01', '2024-06-01',
     true, 'Testfixture verlengd dienstverband')
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_number = excluded.employment_number,
    employment_type = excluded.employment_type,
    contract_type = excluded.contract_type,
    record_status = excluded.record_status,
    starts_on = excluded.starts_on,
    probation_ends_on = excluded.probation_ends_on,
    seniority_date = excluded.seniority_date,
    original_hire_date = excluded.original_hire_date,
    is_primary = excluded.is_primary,
    reason_started = excluded.reason_started,
    deleted_at = null;

  insert into public.employee_organizations (
    id, tenant_id, administration_id, employee_id, department_id,
    direct_manager_id, direct_manager_deputy_id, effective_from, effective_to,
    job_title, cost_bearer, employment_id, job_id
  ) values
    ('41111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', v_fin_department_id, v_manager_id,
     null, '2025-01-01', null, 'Financial controller', 'CC-TEST-FIN',
     '51111111-1111-4111-8111-111111111111', null),
    ('42222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', v_hr_department_id, v_manager_id,
     null, '2024-06-01', null, 'HR business partner', 'CC-TEST-HR',
     '52222222-2222-4222-8222-222222222222', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    department_id = excluded.department_id,
    direct_manager_id = excluded.direct_manager_id,
    direct_manager_deputy_id = excluded.direct_manager_deputy_id,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    job_title = excluded.job_title,
    cost_bearer = excluded.cost_bearer,
    employment_id = excluded.employment_id,
    job_id = excluded.job_id;

  insert into public.income_relationships (
    id, tenant_id, administration_id, employee_id, payroll_tax_subnumber,
    ikv_number, relationship_type, starts_on, reporting_status
  ) values
    ('61111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', 'L01', 47, 'EMPLOYMENT', '2025-01-01', 'READY'),
    ('62222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', 'L02', 48, 'EMPLOYMENT', '2024-06-01', 'READY')
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    payroll_tax_subnumber = excluded.payroll_tax_subnumber,
    ikv_number = excluded.ikv_number,
    relationship_type = excluded.relationship_type,
    starts_on = excluded.starts_on,
    reporting_status = excluded.reporting_status,
    deleted_at = null;

  insert into public.employment_income_relationships (
    id, tenant_id, administration_id, employee_id, employment_id,
    income_relationship_id, valid_from, valid_until
  ) values
    ('71111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     '61111111-1111-4111-8111-111111111111', '2025-01-01', null),
    ('72222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     '62222222-2222-4222-8222-222222222222', '2024-06-01', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_id = excluded.employment_id,
    income_relationship_id = excluded.income_relationship_id,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  insert into public.employment_labor_conditions (
    id, tenant_id, administration_id, employee_id, employment_id,
    condition_group, valid_from, valid_until
  ) values
    ('81111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     'Testregeling Finance', '2025-01-01', null),
    ('82222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     'Testregeling People & Culture', '2024-06-01', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_id = excluded.employment_id,
    condition_group = excluded.condition_group,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  insert into public.employment_schedules (
    id, tenant_id, administration_id, employee_id, employment_id, schedule_type,
    start_week, average_days_per_week, average_hours_per_week, part_time_factor,
    time_for_time_accrual, monday_hours, tuesday_hours, wednesday_hours,
    thursday_hours, friday_hours, valid_from, valid_until
  ) values
    ('91111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     'HOURS_AND_SPECIFIC_DAYS', 1, 5, 40, 1, 0, 8, 8, 8, 8, 8, '2025-01-01', null),
    ('92222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     'HOURS_AND_SPECIFIC_DAYS', 1, 4, 32, 0.8, 0, 8, 8, 8, 8, null, '2024-06-01', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_id = excluded.employment_id,
    schedule_type = excluded.schedule_type,
    start_week = excluded.start_week,
    average_days_per_week = excluded.average_days_per_week,
    average_hours_per_week = excluded.average_hours_per_week,
    part_time_factor = excluded.part_time_factor,
    time_for_time_accrual = excluded.time_for_time_accrual,
    monday_hours = excluded.monday_hours,
    tuesday_hours = excluded.tuesday_hours,
    wednesday_hours = excluded.wednesday_hours,
    thursday_hours = excluded.thursday_hours,
    friday_hours = excluded.friday_hours,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  insert into public.employment_salaries (
    id, tenant_id, administration_id, employee_id, employment_id, payment_type,
    payment_frequency, salary_basis, fulltime_amount, currency_code,
    salary_scale_step_id, valid_from, valid_until
  ) values
    ('a1111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     'PERIODIC_FIXED', 'MONTHLY', 'CUSTOM_SCALE', 4650, 'EUR', v_salary_step_id, '2025-01-01', null),
    ('a2222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     'PERIODIC_FIXED', 'MONTHLY', 'CUSTOM_SCALE', 5100, 'EUR', v_salary_step_id, '2024-06-01', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_id = excluded.employment_id,
    payment_type = excluded.payment_type,
    payment_frequency = excluded.payment_frequency,
    salary_basis = excluded.salary_basis,
    fulltime_amount = excluded.fulltime_amount,
    currency_code = excluded.currency_code,
    salary_scale_step_id = excluded.salary_scale_step_id,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  insert into public.employment_cost_allocations (
    id, tenant_id, administration_id, employee_id, employment_id,
    cost_center_id, percentage, valid_from, valid_until
  ) values
    ('a3111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     v_cost_center_id, 100, '2025-01-01', null),
    ('a3222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     v_cost_center_id, 100, '2024-06-01', null)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_id = excluded.employment_id,
    cost_center_id = excluded.cost_center_id,
    percentage = excluded.percentage,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until;

  -- Adressen, gemaskeerde bankrekeningen en twee relaties per medewerker.
  insert into public.employee_addresses (
    id, tenant_id, employee_id, street, house_number, house_number_addition,
    postal_code, city, region, country_code, valid_from, valid_until,
    address_line_1, address_line_2, postal_code_normalized, source, source_reference
  ) values
    ('b1111111-1111-4111-8111-111111111111', v_tenant_id,
     '11111111-1111-4111-8111-111111111111', 'Testlaan', '47', 'A', '3511AB',
     'Utrecht', 'Utrecht', 'NL', '2025-01-01', null, 'Testlaan 47A', null,
     '3511AB', 'manual', 'fixture-verzuim-fin'),
    ('b2222222-2222-4222-8222-222222222222', v_tenant_id,
     '22222222-2222-4222-8222-222222222222', 'Proefstraat', '48', null, '3811CD',
     'Amersfoort', 'Utrecht', 'NL', '2024-06-01', null, 'Proefstraat 48', null,
     '3811CD', 'manual', 'fixture-verzuim-noah')
  on conflict (id) do update set
    employee_id = excluded.employee_id,
    street = excluded.street,
    house_number = excluded.house_number,
    house_number_addition = excluded.house_number_addition,
    postal_code = excluded.postal_code,
    city = excluded.city,
    region = excluded.region,
    country_code = excluded.country_code,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    address_line_1 = excluded.address_line_1,
    address_line_2 = excluded.address_line_2,
    postal_code_normalized = excluded.postal_code_normalized,
    source = excluded.source,
    source_reference = excluded.source_reference,
    deleted_at = null;

  insert into public.employee_bank_accounts (
    id, tenant_id, employee_id, iban_ciphertext, iban_last_four, bic,
    account_holder, description, is_primary
  ) values
    ('b3111111-1111-4111-8111-111111111111', v_tenant_id,
     '11111111-1111-4111-8111-111111111111',
     'fixture-ciphertext-NL20INGB0001234567', '4567', 'INGBNL2A',
     'Fin de Groot', 'Kunstmatige testrekening', true),
    ('b3222222-2222-4222-8222-222222222222', v_tenant_id,
     '22222222-2222-4222-8222-222222222222',
     'fixture-ciphertext-NL91ABNA0417164300', '4300', 'ABNANL2A',
     'Noah Hendriks', 'Kunstmatige testrekening', true)
  on conflict (id) do update set
    employee_id = excluded.employee_id,
    iban_ciphertext = excluded.iban_ciphertext,
    iban_last_four = excluded.iban_last_four,
    bic = excluded.bic,
    account_holder = excluded.account_holder,
    description = excluded.description,
    is_primary = excluded.is_primary,
    deleted_at = null;

  insert into public.employee_relations (
    id, tenant_id, employee_id, relation_type, is_emergency_contact,
    first_name, initials, last_name, gender, birth_date, phone, mobile, email, notes
  ) values
    ('b4111111-1111-4111-8111-111111111111', v_tenant_id,
     '11111111-1111-4111-8111-111111111111', 'PARTNER', true,
     'Mila', 'M.', 'Groot', 'FEMALE', '1992-08-21', '+31 6 0000 4710',
     '+31 6 0000 4710', 'mila.groot@example.invalid', 'Kunstmatig noodcontact'),
    ('b4222222-2222-4222-8222-222222222222', v_tenant_id,
     '11111111-1111-4111-8111-111111111111', 'DOCTOR', false,
     'Test', 'T.', 'Huisarts', 'OTHER', null, '+31 30 000 4711', null,
     'huisarts.fin@example.invalid', 'Geen medische gegevens in deze fixture'),
    ('b4333333-3333-4333-8333-333333333333', v_tenant_id,
     '22222222-2222-4222-8222-222222222222', 'PARTNER', true,
     'Sanne', 'S.', 'Hendriks', 'FEMALE', '1988-04-11', '+31 6 0000 4820',
     '+31 6 0000 4820', 'sanne.hendriks@example.invalid', 'Kunstmatig noodcontact'),
    ('b4444444-4444-4444-8444-444444444444', v_tenant_id,
     '22222222-2222-4222-8222-222222222222', 'OTHER', false,
     'Test', 'T.', 'Contact', 'OTHER', null, '+31 33 000 4821', null,
     'contact.noah@example.invalid', 'Kunstmatige relatie voor tests')
  on conflict (id) do update set
    employee_id = excluded.employee_id,
    relation_type = excluded.relation_type,
    is_emergency_contact = excluded.is_emergency_contact,
    first_name = excluded.first_name,
    initials = excluded.initials,
    last_name = excluded.last_name,
    gender = excluded.gender,
    birth_date = excluded.birth_date,
    phone = excluded.phone,
    mobile = excluded.mobile,
    email = excluded.email,
    notes = excluded.notes,
    deleted_at = null;

  -- Twee reminders per medewerker: een geplande HR-opvolging en een controle.
  insert into public.reminders (
    id, tenant_id, administration_id, created_by_user_id, reminder_type,
    target_type, title, description, remind_at, status, published_at
  ) values
    ('c1111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     v_manager_user_id, 'HR', 'EMPLOYEES', 'Verzuimcheck Fin de Groot',
     'Controleer de geplande contactdatum in het testdossier.',
     timezone('utc', now()) + interval '1 day', 'PUBLISHED', timezone('utc', now())),
    ('c1222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     v_manager_user_id, 'HR', 'EMPLOYEES', 'Verzuimcheck Noah Hendriks',
     'Controleer de volgende evaluatie in het testdossier.',
     timezone('utc', now()) + interval '3 days', 'PUBLISHED', timezone('utc', now())),
    ('c1333333-3333-4333-8333-333333333333', v_tenant_id, v_administration_id,
     v_manager_user_id, 'HR', 'EMPLOYEES', 'Test salariscontrole Fin',
     'Controleer de salarisregel en het rooster.',
     timezone('utc', now()) + interval '5 days', 'PUBLISHED', timezone('utc', now())),
    ('c1444444-4444-4444-8444-444444444444', v_tenant_id, v_administration_id,
     v_manager_user_id, 'HR', 'EMPLOYEES', 'Test salariscontrole Noah',
     'Controleer de salarisregel en het parttime rooster.',
     timezone('utc', now()) + interval '7 days', 'PUBLISHED', timezone('utc', now()))
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    created_by_user_id = excluded.created_by_user_id,
    reminder_type = excluded.reminder_type,
    target_type = excluded.target_type,
    title = excluded.title,
    description = excluded.description,
    remind_at = excluded.remind_at,
    status = excluded.status,
    published_at = excluded.published_at,
    cancelled_at = null;

  insert into public.reminder_recipients (
    id, tenant_id, reminder_id, user_id, employee_id, status, effective_remind_at
  ) values
    ('c2111111-1111-4111-8111-111111111111', v_tenant_id,
     'c1111111-1111-4111-8111-111111111111', v_manager_user_id,
     '11111111-1111-4111-8111-111111111111', 'PENDING', timezone('utc', now()) + interval '1 day'),
    ('c2222222-2222-4222-8222-222222222222', v_tenant_id,
     'c1222222-2222-4222-8222-222222222222', v_manager_user_id,
     '22222222-2222-4222-8222-222222222222', 'PENDING', timezone('utc', now()) + interval '3 days'),
    ('c2333333-3333-4333-8333-333333333333', v_tenant_id,
     'c1333333-3333-4333-8333-333333333333', v_manager_user_id,
     '11111111-1111-4111-8111-111111111111', 'PENDING', timezone('utc', now()) + interval '5 days'),
    ('c2444444-4444-4444-8444-444444444444', v_tenant_id,
     'c1444444-4444-4444-8444-444444444444', v_manager_user_id,
     '22222222-2222-4222-8222-222222222222', 'PENDING', timezone('utc', now()) + interval '7 days')
  on conflict (id) do update set
    reminder_id = excluded.reminder_id,
    user_id = excluded.user_id,
    employee_id = excluded.employee_id,
    status = excluded.status,
    effective_remind_at = excluded.effective_remind_at,
    completed_at = null,
    dismissed_at = null;

  -- Verzuim: per medewerker een actieve casus plus een gesloten historiecasus.
  insert into public.absence_cases (
    id, tenant_id, administration_id, employee_id, employment_id, status,
    first_absence_on, effective_clock_start_on, case_manager_employee_id,
    has_sickness_benefit_safety_net, is_work_accident, is_third_party_traffic_accident,
    prior_case_count_12_months, frequent_absence_threshold, is_frequent_absence,
    recovery_window_ends_on, closed_at, archived_at, created_by_user_id
  ) values
    ('d1111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     'ACTIVE', '2026-07-18', '2026-07-18', v_manager_id, false, false, false,
     0, 3, false, null, null, null, v_manager_user_id),
    ('d1222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     '11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111',
     'CLOSED', '2026-03-10', '2026-03-10', v_manager_id, false, false, false,
     0, 3, false, null, '2026-04-02 10:00:00+00', null, v_manager_user_id),
    ('d1333333-3333-4333-8333-333333333333', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     'ACTIVE', '2026-07-08', '2026-07-08', v_manager_id, true, false, false,
     1, 3, false, null, null, null, v_manager_user_id),
    ('d1444444-4444-4444-8444-444444444444', v_tenant_id, v_administration_id,
     '22222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222',
     'CLOSED', '2026-01-12', '2026-01-12', v_manager_id, false, false, false,
     0, 3, false, null, '2026-02-12 10:00:00+00', null, v_manager_user_id)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    employee_id = excluded.employee_id,
    employment_id = excluded.employment_id,
    status = excluded.status,
    first_absence_on = excluded.first_absence_on,
    effective_clock_start_on = excluded.effective_clock_start_on,
    case_manager_employee_id = excluded.case_manager_employee_id,
    has_sickness_benefit_safety_net = excluded.has_sickness_benefit_safety_net,
    is_work_accident = excluded.is_work_accident,
    is_third_party_traffic_accident = excluded.is_third_party_traffic_accident,
    prior_case_count_12_months = excluded.prior_case_count_12_months,
    frequent_absence_threshold = excluded.frequent_absence_threshold,
    is_frequent_absence = excluded.is_frequent_absence,
    recovery_window_ends_on = excluded.recovery_window_ends_on,
    closed_at = excluded.closed_at,
    archived_at = null,
    created_by_user_id = excluded.created_by_user_id;

  insert into public.absence_spells (
    id, tenant_id, case_id, started_on, expected_recovery_on,
    recovered_on, recovered_at, reported_by_user_id, recovered_by_user_id
  ) values
    ('d2111111-1111-4111-8111-111111111111', v_tenant_id,
     'd1111111-1111-4111-8111-111111111111', '2026-07-18', '2026-08-15',
     null, null, v_manager_user_id, null),
    ('d2222222-2222-4222-8222-222222222222', v_tenant_id,
     'd1222222-2222-4222-8222-222222222222', '2026-03-10', '2026-04-02',
     '2026-04-02', '2026-04-02 10:00:00+00', v_manager_user_id, v_manager_user_id),
    ('d2333333-3333-4333-8333-333333333333', v_tenant_id,
     'd1333333-3333-4333-8333-333333333333', '2026-07-08', '2026-08-01',
     null, null, v_manager_user_id, null),
    ('d2444444-4444-4444-8444-444444444444', v_tenant_id,
     'd1444444-4444-4444-8444-444444444444', '2026-01-12', '2026-02-12',
     '2026-02-12', '2026-02-12 10:00:00+00', v_manager_user_id, v_manager_user_id)
  on conflict (id) do update set
    case_id = excluded.case_id,
    started_on = excluded.started_on,
    expected_recovery_on = excluded.expected_recovery_on,
    recovered_on = excluded.recovered_on,
    recovered_at = excluded.recovered_at,
    reported_by_user_id = excluded.reported_by_user_id,
    recovered_by_user_id = excluded.recovered_by_user_id;

  insert into public.absence_capacity_changes (
    id, tenant_id, case_id, spell_id, effective_on, absence_percentage,
    expected_next_review_on, created_by_user_id
  ) values
    ('d3111111-1111-4111-8111-111111111111', v_tenant_id,
     'd1111111-1111-4111-8111-111111111111', 'd2111111-1111-4111-8111-111111111111',
     '2026-07-18', 70, '2026-08-01', v_manager_user_id),
    ('d3222222-2222-4222-8222-222222222222', v_tenant_id,
     'd1222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222',
     '2026-03-10', 100, '2026-03-24', v_manager_user_id),
    ('d3333333-3333-4333-8333-333333333333', v_tenant_id,
     'd1333333-3333-4333-8333-333333333333', 'd2333333-3333-4333-8333-333333333333',
     '2026-07-08', 50, '2026-07-22', v_manager_user_id),
    ('d3444444-4444-4444-8444-444444444444', v_tenant_id,
     'd1444444-4444-4444-8444-444444444444', 'd2444444-4444-4444-8444-444444444444',
     '2026-01-12', 100, '2026-01-26', v_manager_user_id)
  on conflict (id) do update set
    case_id = excluded.case_id,
    spell_id = excluded.spell_id,
    effective_on = excluded.effective_on,
    absence_percentage = excluded.absence_percentage,
    expected_next_review_on = excluded.expected_next_review_on,
    created_by_user_id = excluded.created_by_user_id;

  insert into public.absence_mutations (
    id, tenant_id, operation_key, operation_type, result_case_id
  ) values
    ('d4111111-1111-4111-8111-111111111111', v_tenant_id, 'fixture-report-fin-active', 'REPORT', 'd1111111-1111-4111-8111-111111111111'),
    ('d4222222-2222-4222-8222-222222222222', v_tenant_id, 'fixture-report-fin-history', 'REPORT', 'd1222222-2222-4222-8222-222222222222'),
    ('d4333333-3333-4333-8333-333333333333', v_tenant_id, 'fixture-report-noah-active', 'REPORT', 'd1333333-3333-4333-8333-333333333333'),
    ('d4444444-4444-4444-8444-444444444444', v_tenant_id, 'fixture-report-noah-history', 'REPORT', 'd1444444-4444-4444-8444-444444444444')
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    operation_key = excluded.operation_key,
    operation_type = excluded.operation_type,
    result_case_id = excluded.result_case_id;

  -- Eigen testtemplates voor de demo; dit zijn geen wettelijke WvP-sjablonen.
  insert into public.absence_task_templates (
    id, tenant_id, administration_id, code, title, description,
    due_after_effective_days, evidence_required, evidence_category, source,
    source_version, valid_from, valid_until, is_active, is_system, created_by_user_id
  ) values
    ('e1111111-1111-4111-8111-111111111111', v_tenant_id, v_administration_id,
     'TEST_CONTACT', 'Test: eerste contact vastleggen',
     'Leg de geplande contactdatum vast voor de testcasus.', 3, false, null,
     'CUSTOM', 'fixture-2026-07', '2026-01-01', null, true, false, v_manager_user_id),
    ('e1222222-2222-4222-8222-222222222222', v_tenant_id, v_administration_id,
     'TEST_EVALUATIE', 'Test: evaluatie plannen',
     'Plan een evaluatiemoment voor de testcasus.', 14, true, 'contactverslag',
     'CUSTOM', 'fixture-2026-07', '2026-01-01', null, true, false, v_manager_user_id),
    ('e1333333-3333-4333-8333-333333333333', v_tenant_id, v_administration_id,
     'TEST_DOSSIER', 'Test: dossiercontrole',
     'Controleer of de testcasus alle niet-medische gegevens bevat.', 28, false, null,
     'CUSTOM', 'fixture-2026-07', '2026-01-01', null, true, false, v_manager_user_id)
  on conflict (id) do update set
    administration_id = excluded.administration_id,
    code = excluded.code,
    title = excluded.title,
    description = excluded.description,
    due_after_effective_days = excluded.due_after_effective_days,
    evidence_required = excluded.evidence_required,
    evidence_category = excluded.evidence_category,
    source = excluded.source,
    source_version = excluded.source_version,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    is_active = excluded.is_active,
    is_system = excluded.is_system,
    created_by_user_id = excluded.created_by_user_id;
end;
$$;
