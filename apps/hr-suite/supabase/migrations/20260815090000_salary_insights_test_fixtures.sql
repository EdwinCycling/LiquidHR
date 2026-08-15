-- Dev/test-fixtures voor Salary Insights.
-- Deze migratie is bewust gebonden aan de huidige niet-productie testtenant.
begin;

do $$
declare
  v_tenant_id uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  v_hr_group_id uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  v_publisher_id uuid;
  v_structure_id uuid;
  v_revision_id uuid;
  v_band_id uuid;
begin
  if not exists (
    select 1
    from public.tenants
    where id = v_tenant_id
      and is_active
  ) then
    raise exception 'SALARY_INSIGHTS_FIXTURE_TENANT_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.hr_groups
    where id = v_hr_group_id
      and tenant_id = v_tenant_id
      and is_active
  ) then
    raise exception 'SALARY_INSIGHTS_FIXTURE_HR_GROUP_NOT_FOUND';
  end if;

  select access.user_id
  into v_publisher_id
  from public.user_hr_group_access access
  where access.hr_group_id = v_hr_group_id
    and access.is_active
  limit 1;

  if v_publisher_id is null then
    raise exception 'SALARY_INSIGHTS_FIXTURE_PUBLISHER_NOT_FOUND';
  end if;

  -- Dezelfde canonieke bandankers als TEST-SALARY-STRUCTURES-FULL-V1.
  select structure.id
  into v_structure_id
  from public.salary_structures structure
  where structure.tenant_id = v_tenant_id
    and structure.hr_group_id = v_hr_group_id
    and structure.code = 'ENG'
  limit 1;
  if v_structure_id is null then
    insert into public.salary_structures (tenant_id, hr_group_id, structure_type, name, code, description)
    values (v_tenant_id, v_hr_group_id, 'SALARY_BAND', 'Engineering salarisbanden', 'ENG', 'Canonieke Salary Insights testdata')
    returning id into v_structure_id;
  end if;

  select revision.id
  into v_revision_id
  from public.salary_structure_revisions revision
  where revision.salary_structure_id = v_structure_id
    and revision.effective_from = '2026-01-01'
  limit 1;
  if v_revision_id is null then
    insert into public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, revision_number, status, effective_from, salary_basis, currency_code, description)
    values (v_tenant_id, v_hr_group_id, v_structure_id, 1, 'DRAFT', '2026-01-01', 'MONTHLY_BASE', 'EUR', 'Canonieke Salary Insights testdata')
    returning id into v_revision_id;
  end if;

  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'ENG-E1' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'ENG-E1') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'E1', 'Engineering 1', 1, 'MIDPOINT_SPREAD', 2723.40, 3200.00, 3676.60, 35); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'ENG-E2' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'ENG-E2') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'E2', 'Engineering 2', 2, 'MIDPOINT_SPREAD', 3166.67, 3800.00, 4433.33, 40); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'ENG-E3' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'ENG-E3') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'E3', 'Engineering 3', 3, 'MIDPOINT_SPREAD', 3755.10, 4600.00, 5444.90, 45); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'ENG-E4' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'ENG-E4') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'E4', 'Engineering 4', 4, 'MIDPOINT_SPREAD', 4480.00, 5600.00, 6720.00, 50); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'ENG-E5' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'ENG-E5') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'E5', 'Engineering 5', 5, 'MIDPOINT_SPREAD', 5490.20, 7000.00, 8509.80, 55); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'ENG-E6' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'ENG-E6') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'E6', 'Engineering Principal', 6, 'MANUAL_ANCHORS', 7500.00, 9000.00, null, null); end if;
  if exists (select 1 from public.salary_structure_revisions where id = v_revision_id and status = 'DRAFT') then
    perform internal_security.validate_salary_structure_revision(v_revision_id);
    update public.salary_structure_revisions
    set status = 'PUBLISHED', published_at = timezone('utc', now()), published_by_user_id = v_publisher_id, updated_by_user_id = v_publisher_id, updated_at = timezone('utc', now())
    where id = v_revision_id;
  end if;

  select structure.id
  into v_structure_id
  from public.salary_structures structure
  where structure.tenant_id = v_tenant_id
    and structure.hr_group_id = v_hr_group_id
    and structure.code = 'MGT'
  limit 1;
  if v_structure_id is null then
    insert into public.salary_structures (tenant_id, hr_group_id, structure_type, name, code, description)
    values (v_tenant_id, v_hr_group_id, 'SALARY_BAND', 'Managementbanden', 'MGT', 'Canonieke Salary Insights testdata')
    returning id into v_structure_id;
  end if;
  select revision.id into v_revision_id from public.salary_structure_revisions revision where revision.salary_structure_id = v_structure_id and revision.effective_from = '2026-01-01' limit 1;
  if v_revision_id is null then
    insert into public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, revision_number, status, effective_from, salary_basis, currency_code, description)
    values (v_tenant_id, v_hr_group_id, v_structure_id, 1, 'DRAFT', '2026-01-01', 'MONTHLY_BASE', 'EUR', 'Canonieke Salary Insights testdata')
    returning id into v_revision_id;
  end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'MGT-M1' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'MGT-M1') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'M1', 'Management 1', 1, 'MANUAL_ANCHORS', 5500.00, 6500.00, 7800.00, null); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'MGT-M2' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'MGT-M2') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'M2', 'Management 2', 2, 'MANUAL_ANCHORS', 7000.00, 8500.00, 10500.00, null); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'MGT-M3' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'MGT-M3') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'M3', 'Directie', 3, 'MANUAL_ANCHORS', 9500.00, 12000.00, null, null); end if;
  if exists (select 1 from public.salary_structure_revisions where id = v_revision_id and status = 'DRAFT') then
    perform internal_security.validate_salary_structure_revision(v_revision_id);
    update public.salary_structure_revisions
    set status = 'PUBLISHED', published_at = timezone('utc', now()), published_by_user_id = v_publisher_id, updated_by_user_id = v_publisher_id, updated_at = timezone('utc', now())
    where id = v_revision_id;
  end if;

  select structure.id
  into v_structure_id
  from public.salary_structures structure
  where structure.tenant_id = v_tenant_id
    and structure.hr_group_id = v_hr_group_id
    and structure.code = 'SUP'
  limit 1;
  if v_structure_id is null then
    insert into public.salary_structures (tenant_id, hr_group_id, structure_type, name, code, description)
    values (v_tenant_id, v_hr_group_id, 'SALARY_BAND', 'Support salarisbanden', 'SUP', 'Canonieke Salary Insights testdata')
    returning id into v_structure_id;
  end if;
  select revision.id into v_revision_id from public.salary_structure_revisions revision where revision.salary_structure_id = v_structure_id and revision.effective_from = '2026-01-01' limit 1;
  if v_revision_id is null then
    insert into public.salary_structure_revisions (tenant_id, hr_group_id, salary_structure_id, revision_number, status, effective_from, salary_basis, currency_code, description)
    values (v_tenant_id, v_hr_group_id, v_structure_id, 1, 'DRAFT', '2026-01-01', 'MONTHLY_BASE', 'EUR', 'Canonieke Salary Insights testdata')
    returning id into v_revision_id;
  end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'SUP-S1' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'SUP-S1') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'S1', 'Support 1', 1, 'MIN_MAX', 2600.00, 3000.00, 3400.00, null); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'SUP-S2' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'SUP-S2') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'S2', 'Support 2', 2, 'MIN_MAX', 3000.00, 3550.00, 4100.00, null); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'SUP-S3' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'SUP-S3') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'S3', 'Support 3', 3, 'MIN_MAX', 3700.00, 4400.00, 5100.00, null); end if;
  select id into v_band_id from public.salary_bands where tenant_id = v_tenant_id and hr_group_id = v_hr_group_id and salary_structure_id = v_structure_id and identity_key = 'SUP-S4' limit 1;
  if v_band_id is null then insert into public.salary_bands (tenant_id, hr_group_id, salary_structure_id, identity_key) values (v_tenant_id, v_hr_group_id, v_structure_id, 'SUP-S4') returning id into v_band_id; end if;
  if not exists (select 1 from public.salary_band_values where salary_structure_revision_id = v_revision_id and salary_band_id = v_band_id) then insert into public.salary_band_values (tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage) values (v_tenant_id, v_hr_group_id, v_revision_id, v_band_id, 'S4', 'Support 4', 4, 'MIN_MAX', 5000.00, 6000.00, 7000.00, null); end if;
  if exists (select 1 from public.salary_structure_revisions where id = v_revision_id and status = 'DRAFT') then
    perform internal_security.validate_salary_structure_revision(v_revision_id);
    update public.salary_structure_revisions
    set status = 'PUBLISHED', published_at = timezone('utc', now()), published_by_user_id = v_publisher_id, updated_by_user_id = v_publisher_id, updated_at = timezone('utc', now())
    where id = v_revision_id;
  end if;
end $$;

do $$
declare
  v_tenant_id uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  v_hr_group_id uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  v_effective_from date := '2026-08-15';
  v_target record;
  v_employment record;
  v_current record;
  v_salary_frequency_id uuid;
  v_structure_id uuid;
  v_band_id uuid;
begin
  create temporary table salary_insights_fixture_targets (
    employment_id uuid primary key,
    salary_route text not null,
    minimum_wage_scheme text,
    structure_code text,
    band_key text,
    fulltime_amount numeric,
    parttime_amount numeric
  ) on commit drop;

  insert into salary_insights_fixture_targets (employment_id, salary_route, minimum_wage_scheme, structure_code, band_key, fulltime_amount, parttime_amount)
  values
    ('dac1749b-ce82-2131-9d0a-656794ff75c5', 'MINIMUM_WAGE', 'REGULAR', null, null, null, null),
    ('51111111-1111-4111-8111-111111111111', 'MINIMUM_WAGE', 'REGULAR', null, null, null, null),
    ('52222222-2222-4222-8222-222222222222', 'MINIMUM_WAGE', 'BBL', null, null, null, null),
    ('b407c312-3293-7830-5c49-f2c8514ac32f', 'SALARY_BAND', null, 'ENG', 'ENG-E3', 4500.00, 4500.00),
    ('61576c43-149c-febe-ca9d-e3ef947295f8', 'SALARY_BAND', null, 'ENG', 'ENG-E1', 3075.00, 3075.00),
    ('2838593a-fb4d-d8c7-c5ae-c9e4a831fcf8', 'SALARY_BAND', null, 'ENG', 'ENG-E2', 4700.00, 3760.00),
    ('1ada8fd0-237d-06fa-22ad-d5f5287c4371', 'SALARY_BAND', null, 'SUP', 'SUP-S1', 2400.00, 1920.00),
    ('563c2f8c-47e4-6ba4-c146-bc43dffa186b', 'SALARY_BAND', null, 'SUP', 'SUP-S1', 2400.00, 480.00),
    ('57672695-4af3-2ade-d3bf-1b09a3aff8d9', 'SALARY_BAND', null, 'SUP', 'SUP-S1', 4850.00, 3880.00);

  if (select count(*) from public.employments employment where employment.id in (select employment_id from salary_insights_fixture_targets) and employment.tenant_id = v_tenant_id and employment.hr_group_id = v_hr_group_id) <> (select count(*) from salary_insights_fixture_targets) then
    raise exception 'SALARY_INSIGHTS_FIXTURE_EMPLOYMENT_SCOPE_MISMATCH';
  end if;

  for v_target in select * from salary_insights_fixture_targets loop
    select employment.*
    into v_employment
    from public.employments employment
    where employment.id = v_target.employment_id;

    select salary.*
    into v_current
    from public.employment_salaries salary
    where salary.employment_id = v_target.employment_id
      and salary.valid_from <= v_effective_from
      and (salary.valid_until is null or salary.valid_until > v_effective_from)
    order by salary.valid_from desc, salary.created_at desc
    limit 1;

    if v_current.id is not null and v_current.valid_from = v_effective_from and v_current.salary_route::text = v_target.salary_route then
      continue;
    end if;

    if v_current.id is not null then
      if v_current.valid_from >= v_effective_from then
        raise exception 'SALARY_INSIGHTS_FIXTURE_EXISTING_ROW_AFTER_EFFECTIVE_DATE: %', v_target.employment_id;
      end if;
      update public.employment_salaries
      set valid_until = v_effective_from, updated_at = timezone('utc', now())
      where id = v_current.id;
    end if;

    select salary.salary_frequency_id
    into v_salary_frequency_id
    from public.employment_salaries salary
    where salary.tenant_id = v_tenant_id
      and salary.administration_id = v_employment.administration_id
      and salary.salary_frequency_id is not null
    limit 1;
    if v_salary_frequency_id is null then
      raise exception 'SALARY_INSIGHTS_FIXTURE_SALARY_FREQUENCY_NOT_FOUND: %', v_target.employment_id;
    end if;

    v_structure_id := null;
    v_band_id := null;
    if v_target.salary_route = 'SALARY_BAND' then
      select structure.id
      into v_structure_id
      from public.salary_structures structure
      where structure.tenant_id = v_tenant_id
        and structure.hr_group_id = v_hr_group_id
        and structure.code = v_target.structure_code
        and structure.structure_type = 'SALARY_BAND'
        and structure.is_active
      limit 1;
      select band.id
      into v_band_id
      from public.salary_bands band
      where band.tenant_id = v_tenant_id
        and band.hr_group_id = v_hr_group_id
        and band.salary_structure_id = v_structure_id
        and band.identity_key = v_target.band_key
      limit 1;
      if v_structure_id is null or v_band_id is null then
        raise exception 'SALARY_INSIGHTS_FIXTURE_BAND_NOT_FOUND: %', v_target.band_key;
      end if;
    end if;

    insert into public.employment_salaries (
      tenant_id, administration_id, employee_id, employment_id,
      payment_type, payment_frequency, salary_basis, fulltime_amount, hourly_rate,
      currency_code, valid_from, valid_until, salary_frequency_id, parttime_amount,
      hr_group_id, salary_route, minimum_wage_scheme, salary_structure_id,
      salary_scale_id, salary_step_code, salary_band_id
    ) values (
      v_employment.tenant_id,
      v_employment.administration_id,
      v_employment.employee_id,
      v_employment.id,
      'PERIODIC_FIXED',
      'MONTHLY',
      case when v_target.salary_route = 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::salary_basis else 'SALARY_BAND'::salary_basis end,
      case when v_target.salary_route = 'MINIMUM_WAGE' then null else v_target.fulltime_amount end,
      null,
      coalesce(v_current.currency_code, 'EUR'),
      v_effective_from,
      null,
      coalesce(v_current.salary_frequency_id, v_salary_frequency_id),
      case when v_target.salary_route = 'MINIMUM_WAGE' then null else v_target.parttime_amount end,
      v_hr_group_id,
      v_target.salary_route::salary_application_route,
      case when v_target.minimum_wage_scheme is null then null else v_target.minimum_wage_scheme::minimum_wage_scheme end,
      v_structure_id,
      null,
      null,
      v_band_id
    );
  end loop;
end $$;

commit;
