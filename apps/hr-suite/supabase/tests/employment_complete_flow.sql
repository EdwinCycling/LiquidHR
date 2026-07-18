begin;

do $$
declare
  tenant uuid := md5('tenant:liquid-hr-demo-holding')::uuid;
  administration uuid;
  employee uuid;
  actor uuid;
  department uuid;
  cost_center uuid;
  created_employment uuid;
  employment_count_before integer;
begin
  select id into actor from auth.users where lower(email) = 'edwin@editsolutions.nl' limit 1;
  select assignment.administration_id, assignment.employee_id
    into administration, employee
  from public.employee_administration_assignments assignment
  where assignment.tenant_id = tenant
  order by assignment.effective_from, assignment.employee_id
  limit 1;
  select id into department from public.departments
    where tenant_id = tenant and administration_id = administration
    order by code limit 1;
  select id into cost_center from public.cost_centers
    where tenant_id = tenant and administration_id = administration
    order by code limit 1;

  if actor is null or administration is null or employee is null
     or department is null or cost_center is null then
    raise exception 'Testbasis voor complete dienstverbandflow ontbreekt.';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  created_employment := public.publish_complete_employment(
    employee,
    administration,
    jsonb_build_object(
      'employment', jsonb_build_object(
        'employmentNumber', 'TEST-COMPLETE-001', 'employmentType', 'EMPLOYEE',
        'contractType', 'INDEFINITE', 'startsOn', '2026-08-01',
        'seniorityDate', '2026-08-01', 'originalHireDate', '2026-08-01',
        'isPrimary', false, 'reasonStarted', 'COMPLETE_FLOW_TEST'
      ),
      'incomeRelationship', jsonb_build_object(
        'payrollTaxSubnumber', 'TEST', 'ikvNumber', 9901, 'validFrom', '2026-08-01'
      ),
      'organization', jsonb_build_object(
        'departmentId', department, 'jobTitle', 'Testfunctie', 'effectiveFrom', '2026-08-01'
      ),
      'laborCondition', jsonb_build_object(
        'conditionGroup', 'Testregeling', 'validFrom', '2026-08-01'
      ),
      'schedule', jsonb_build_object(
        'scheduleType', 'HOURS_AND_AVG_DAYS', 'startWeek', 1,
        'averageDaysPerWeek', 5, 'averageHoursPerWeek', 36,
        'partTimeFactor', 1, 'timeForTimeAccrual', 0, 'validFrom', '2026-08-01'
      ),
      'salary', jsonb_build_object(
        'paymentType', 'PERIODIC_FIXED', 'paymentFrequency', 'MONTHLY',
        'salaryBasis', 'MANUAL', 'fulltimeAmount', 4200,
        'currencyCode', 'EUR', 'validFrom', '2026-08-01'
      ),
      'costAllocation', jsonb_build_object(
        'validFrom', '2026-08-01',
        'allocations', jsonb_build_array(jsonb_build_object('costCenterId', cost_center, 'percentage', 100))
      )
    )
  );

  if (select record_status from public.employments where id = created_employment) <> 'CONFIRMED' then
    raise exception 'Het complete dienstverband is niet bevestigd.';
  end if;
  if (select count(*) from public.employment_income_relationships where employment_id = created_employment) <> 1
     or (select count(*) from public.employee_organizations where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_labor_conditions where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_schedules where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_salaries where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_cost_allocations where employment_id = created_employment) <> 1 then
    raise exception 'Niet alle onderdelen zijn atomair gepubliceerd.';
  end if;

  select count(*) into employment_count_before from public.employments;
  begin
    perform public.publish_complete_employment(
      employee,
      administration,
      jsonb_build_object(
        'employment', jsonb_build_object(
          'employmentNumber', 'TEST-COMPLETE-INVALID', 'contractType', 'INDEFINITE',
          'startsOn', '2026-09-01', 'seniorityDate', '2026-09-01',
          'originalHireDate', '2026-09-01'
        ),
        'incomeRelationship', jsonb_build_object(
          'payrollTaxSubnumber', 'TEST', 'ikvNumber', 9902, 'validFrom', '2026-09-01'
        ),
        'organization', jsonb_build_object(
          'departmentId', department, 'jobTitle', 'Testfunctie', 'effectiveFrom', '2026-09-01'
        ),
        'laborCondition', jsonb_build_object(
          'conditionGroup', 'Testregeling', 'validFrom', '2026-09-01'
        ),
        'schedule', jsonb_build_object(
          'scheduleType', 'HOURS_AND_AVG_DAYS', 'averageDaysPerWeek', 5,
          'averageHoursPerWeek', 36, 'partTimeFactor', 1, 'validFrom', '2026-09-01'
        ),
        'costAllocation', jsonb_build_object(
          'validFrom', '2026-09-01',
          'allocations', jsonb_build_array(jsonb_build_object('costCenterId', cost_center, 'percentage', 90))
        )
      )
    );
    raise exception 'Een onvolledige kostenverdeling is toegestaan.';
  exception when others then
    if sqlerrm not like '%COST_ALLOCATION_TOTAL_INVALID%' then raise; end if;
  end;
  if (select count(*) from public.employments) <> employment_count_before then
    raise exception 'Een ongeldig pakket heeft gedeeltelijke gegevens achtergelaten.';
  end if;
end
$$;

rollback;
