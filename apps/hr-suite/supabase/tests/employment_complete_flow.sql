begin;

-- Step 6: het actuele complete-employment contract wordt uitgevoerd binnen
-- één HR-groep; payrollcatalogi blijven aan de gekozen administratie gebonden.
do $$
declare
  actor uuid;
begin
  select id into actor
  from auth.users
  where lower(email) = 'edwin@editsolutions.nl'
  limit 1;

  if actor is null then
    raise exception 'COMPLETE_FLOW_ACTOR_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );
end
$$;

set local role authenticated;

do $$
declare
  tenant uuid := (select id from public.tenants where slug = 'liquid-hr-demo-holding' limit 1);
  employee uuid;
  hr_group uuid;
  administration uuid;
  department uuid;
  job uuid;
  labor_condition_set uuid;
  salary_frequency uuid;
  cost_center uuid;
  cost_carrier uuid;
  created_employment uuid;
  employment_count_before integer;
begin
  select employee_row.id, employee_row.hr_group_id
    into employee, hr_group
  from public.employees employee_row
  where employee_row.tenant_id = tenant
    and employee_row.employee_number = 'DEMO-046'
    and employee_row.deleted_at is null
    and exists (
      select 1
      from public.employee_secure_identifiers identifier
      where identifier.tenant_id = employee_row.tenant_id
        and identifier.employee_id = employee_row.id
        and identifier.bsn_fingerprint is not null
    )
  limit 1;

  select assignment.administration_id
    into administration
  from public.employee_administration_assignments assignment
  where assignment.tenant_id = tenant
    and assignment.hr_group_id = hr_group
    and assignment.employee_id = employee
    and assignment.effective_from <= date '2026-08-01'
    and (assignment.effective_to is null or assignment.effective_to >= date '2026-08-01')
  order by assignment.effective_from, assignment.administration_id
  limit 1;

  select department_row.id
    into department
  from public.departments department_row
  where department_row.tenant_id = tenant
    and department_row.hr_group_id = hr_group
    and department_row.is_active
  order by department_row.code
  limit 1;

  select job_row.id
    into job
  from public.jobs job_row
  where job_row.tenant_id = tenant
    and job_row.hr_group_id = hr_group
    and job_row.is_active
  order by job_row.code
  limit 1;

  select condition_set.id
    into labor_condition_set
  from public.labor_condition_sets condition_set
  where condition_set.tenant_id = tenant
    and condition_set.hr_group_id = hr_group
    and condition_set.administration_id = administration
    and condition_set.is_active
  order by condition_set.code
  limit 1;

  select frequency.id
    into salary_frequency
  from public.salary_frequencies frequency
  where frequency.tenant_id = tenant
    and frequency.administration_id = administration
    and frequency.is_active
  order by frequency.code
  limit 1;

  select cost_center_row.id
    into cost_center
  from public.cost_centers cost_center_row
  where cost_center_row.tenant_id = tenant
    and cost_center_row.administration_id = administration
  order by cost_center_row.code
  limit 1;

  select cost_carrier_row.id
    into cost_carrier
  from public.cost_carriers cost_carrier_row
  where cost_carrier_row.tenant_id = tenant
    and cost_carrier_row.administration_id = administration
  order by cost_carrier_row.code
  limit 1;

  if tenant is null or employee is null or hr_group is null or administration is null
     or department is null or job is null or labor_condition_set is null
     or salary_frequency is null or cost_center is null or cost_carrier is null then
    raise exception 'COMPLETE_FLOW_FIXTURE_MISSING';
  end if;

  select count(*)
    into employment_count_before
  from public.employments employment
  where employment.tenant_id = tenant
    and employment.hr_group_id = hr_group;

  created_employment := public.publish_complete_employment(
    employee,
    administration,
    jsonb_build_object(
      'employment', jsonb_build_object(
        'employmentNumber', 'TEST-COMPLETE-STEP6-001',
        'startsOn', '2026-08-01',
        'seniorityDate', '2026-08-01',
        'countryCode', 'NL',
        'isPrimary', false
      ),
      'incomeRelationship', jsonb_build_object(
        'payrollTaxSubnumber', 'TEST',
        'ikvNumber', 98,
        'validFrom', '2026-08-01'
      ),
      'organization', jsonb_build_object(
        'departmentId', department,
        'jobId', job,
        'jobTitle', 'Step 6 testfunctie',
        'managerEmployeeId', null,
        'directManagerDeputyId', null,
        'costBearer', null,
        'effectiveFrom', '2026-08-01',
        'effectiveTo', null
      ),
      'contract', jsonb_build_object(
        'workerType', 'EMPLOYEE',
        'flexPhaseId', null,
        'laborConditionSetId', labor_condition_set,
        'durationType', 'INDEFINITE',
        'startsOn', '2026-08-01',
        'endsOn', null,
        'probationApplies', false,
        'probationEndsOn', null
      ),
      'schedule', jsonb_build_object(
        'scheduleType', 'HOURS_AND_AVG_DAYS',
        'startWeek', 1,
        'averageDaysPerWeek', 5,
        'averageHoursPerWeek', 36,
        'partTimeFactor', 1,
        'timeForTimeAccrual', 0,
        'mondayHours', 7.2,
        'tuesdayHours', 7.2,
        'wednesdayHours', 7.2,
        'thursdayHours', 7.2,
        'fridayHours', 7.2,
        'saturdayHours', 0,
        'sundayHours', 0,
        'isOnCall', false,
        'onCallObligation', null,
        'workScope', 'FULL_TIME',
        'validFrom', '2026-08-01',
        'validUntil', null
      ),
      'salary', jsonb_build_object(
        'paymentType', 'PERIODIC_FIXED',
        'paymentFrequency', 'MONTHLY',
        'salaryBasis', 'MANUAL',
        'fulltimeAmount', 4200,
        'parttimeAmount', null,
        'hourlyRate', null,
        'currencyCode', 'EUR',
        'salaryFrequencyId', salary_frequency,
        'salaryScaleStepId', null,
        'caoScaleName', null,
        'caoStepName', null,
        'validFrom', '2026-08-01',
        'validUntil', null
      ),
      'costAllocation', jsonb_build_object(
        'validFrom', '2026-08-01',
        'validUntil', null,
        'allocations', jsonb_build_array(jsonb_build_object(
          'costCenterId', cost_center,
          'costCarrierId', cost_carrier,
          'percentage', 100
        ))
      )
    )
  );

  if (select record_status from public.employments where id = created_employment) <> 'CONFIRMED' then
    raise exception 'COMPLETE_FLOW_NOT_CONFIRMED';
  end if;
  if (select hr_group_id from public.employments where id = created_employment) <> hr_group then
    raise exception 'COMPLETE_FLOW_GROUP_KEY_MISSING';
  end if;
  if (select administration_id from public.employments where id = created_employment) <> administration then
    raise exception 'COMPLETE_FLOW_ADMINISTRATION_MISSING';
  end if;
  if (select count(*) from public.employment_income_relationships where employment_id = created_employment) <> 1
     or (select count(*) from public.employee_organizations where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_labor_conditions where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_schedules where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_salaries where employment_id = created_employment) <> 1
     or (select count(*) from public.employment_cost_allocations where employment_id = created_employment) <> 1 then
    raise exception 'COMPLETE_FLOW_ATOMIC_CHILDREN_MISSING';
  end if;
  if (select count(*) from public.employments where tenant_id = tenant and hr_group_id = hr_group)
     <> employment_count_before + 1 then
    raise exception 'COMPLETE_FLOW_EMPLOYMENT_COUNT_INVALID';
  end if;

  select count(*)
    into employment_count_before
  from public.employments employment
  where employment.tenant_id = tenant
    and employment.hr_group_id = hr_group;

  begin
    perform public.publish_complete_employment(
      employee,
      administration,
      jsonb_build_object(
        'employment', jsonb_build_object(
          'employmentNumber', 'TEST-COMPLETE-STEP6-INVALID',
          'startsOn', '2026-09-01',
          'seniorityDate', '2026-09-01',
          'countryCode', 'NL',
          'isPrimary', false
        ),
        'incomeRelationship', jsonb_build_object(
          'payrollTaxSubnumber', 'TEST',
          'ikvNumber', 97,
          'validFrom', '2026-09-01'
        ),
        'organization', jsonb_build_object(
          'departmentId', department,
          'jobId', job,
          'jobTitle', 'Ongeldige step 6 testfunctie',
          'effectiveFrom', '2026-09-01'
        ),
        'contract', jsonb_build_object(
          'workerType', 'EMPLOYEE',
          'laborConditionSetId', labor_condition_set,
          'durationType', 'INDEFINITE',
          'startsOn', '2026-09-01',
          'probationApplies', false
        ),
        'schedule', jsonb_build_object(
          'scheduleType', 'HOURS_AND_AVG_DAYS',
          'averageDaysPerWeek', 5,
          'averageHoursPerWeek', 36,
          'partTimeFactor', 1,
          'isOnCall', false,
          'workScope', 'FULL_TIME',
          'validFrom', '2026-09-01',
          'mondayHours', 7.2,
          'tuesdayHours', 7.2,
          'wednesdayHours', 7.2,
          'thursdayHours', 7.2,
          'fridayHours', 7.2
        ),
        'costAllocation', jsonb_build_object(
          'validFrom', '2026-09-01',
          'allocations', jsonb_build_array(jsonb_build_object(
            'costCenterId', cost_center,
            'costCarrierId', cost_carrier,
            'percentage', 90
          ))
        )
      )
    );
    raise exception 'COMPLETE_FLOW_INVALID_COST_ALLOCATION_ACCEPTED';
  exception when others then
    if sqlerrm not like '%COST_ALLOCATION_TOTAL_INVALID%' then
      raise;
    end if;
  end;

  if (select count(*) from public.employments where tenant_id = tenant and hr_group_id = hr_group)
     <> employment_count_before then
    raise exception 'COMPLETE_FLOW_INVALID_PAYLOAD_LEFT_PARTIAL_DATA';
  end if;
end
$$;

rollback;
