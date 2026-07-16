begin;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  employee uuid;
  actor uuid;
  test_employment_id uuid := md5('employment:change-management-test')::uuid;
  change_id uuid;
begin
  select id into administration from public.administrations where tenant_id = tenant order by code limit 1;
  select id into employee from public.employees where tenant_id = tenant order by employee_number limit 1;
  select id into actor from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1;

  insert into public.employments (
    id, tenant_id, administration_id, employee_id, employment_number,
    contract_type, starts_on, seniority_date, original_hire_date
  ) values (
    test_employment_id, tenant, administration, employee, 'TEST-CHANGE',
    'INDEFINITE', '2026-01-01', '2026-01-01', '2026-01-01'
  );
  insert into public.employment_labor_conditions (
    tenant_id, administration_id, employee_id, employment_id, condition_group, valid_from, valid_until
  ) values
    (tenant, administration, employee, test_employment_id, 'Basis', '2026-01-01', '2026-07-01'),
    (tenant, administration, employee, test_employment_id, 'Gepland', '2026-07-01', null);

  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  change_id := public.apply_employment_timeline_mutation(
    test_employment_id, 'LABOR_CONDITIONS', '2026-03-01',
    '{"conditionGroup":"TWK"}'::jsonb, 'Correctie arbeidsvoorwaarden',
    array['RETROACTIVE_CHANGE'], '{"retroactive":true}'::jsonb
  );

  if (select count(*) from public.employment_labor_conditions where employment_id = test_employment_id) <> 3 then
    raise exception 'De mutatie heeft niet exact één tijdblok toegevoegd.';
  end if;
  if not exists (
    select 1 from public.employment_labor_conditions
    where employment_id = test_employment_id and valid_from = '2026-07-01' and valid_until is null
  ) then raise exception 'De toekomstige mutatie is niet behouden.'; end if;
  if (select status from public.employment_change_sets where id = change_id) <> 'APPLIED' then
    raise exception 'Het wijzigingspakket is niet toegepast.';
  end if;

  change_id := public.apply_combined_employment_timeline_mutation(
    test_employment_id, '2026-04-01',
    '[
      {"timeline":"LABOR_CONDITIONS","payload":{"conditionGroup":"Gecombineerd"}},
      {"timeline":"SCHEDULE","payload":{"scheduleType":"HOURS_AND_AVG_DAYS","startWeek":1,"averageDaysPerWeek":4,"averageHoursPerWeek":32,"partTimeFactor":0.8,"timeForTimeAccrual":0}}
    ]'::jsonb,
    'Arbeidsvoorwaarden en rooster samen wijzigen', array[]::text[], '{}'::jsonb
  );
  if (select domains from public.employment_change_sets where id = change_id) <> array['LABOR_CONDITIONS', 'SCHEDULE'] then
    raise exception 'Het gecombineerde pakket bevat niet precies de verwachte domeinen.';
  end if;
  if (select count(*) from public.employment_labor_conditions where employment_id = test_employment_id and change_set_id = change_id) <> 1
     or (select count(*) from public.employment_schedules where employment_id = test_employment_id and change_set_id = change_id) <> 1 then
    raise exception 'De gecombineerde wijziging is niet atomair op beide tijdlijnen vastgelegd.';
  end if;

  perform public.rollback_latest_employment_timeline(
    test_employment_id, 'LABOR_CONDITIONS', '2026-07-01', 'Geplande mutatie intrekken'
  );
  if exists (
    select 1 from public.employment_labor_conditions
    where employment_id = test_employment_id and valid_from = '2026-07-01'
  ) then raise exception 'Het laatste tijdblok is niet verwijderd.'; end if;
  if not exists (
    select 1 from public.employment_labor_conditions
    where employment_id = test_employment_id and valid_from = '2026-03-01' and valid_until is null
  ) then raise exception 'De voorganger is niet hersteld.'; end if;

  begin
    perform public.apply_employment_timeline_mutation(
      test_employment_id, 'COST_ALLOCATION', '2026-03-01',
      '{"allocations":[]}'::jsonb, 'Ongeldige verdeling', array[]::text[], '{}'::jsonb
    );
    raise exception 'Een lege kostenverdeling is toegestaan.';
  exception when others then
    if sqlerrm not like '%COST_ALLOCATION_TOTAL_INVALID%' then raise; end if;
  end;
end
$$;

rollback;
