create function public.publish_complete_employment(
  requested_employee_id uuid,
  requested_administration_id uuid,
  requested_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  requested_tenant_id uuid;
  employment_payload jsonb := requested_payload -> 'employment';
  income_payload jsonb := requested_payload -> 'incomeRelationship';
  organization_payload jsonb := requested_payload -> 'organization';
  labor_payload jsonb := requested_payload -> 'laborCondition';
  schedule_payload jsonb := requested_payload -> 'schedule';
  salary_payload jsonb := requested_payload -> 'salary';
  cost_payload jsonb := requested_payload -> 'costAllocation';
  requested_starts_on date;
  requested_ends_on date;
  created_employment_id uuid;
  created_income_relationship_id uuid;
  created_change_set_id uuid;
  allocation jsonb;
  allocation_count integer;
  allocation_total numeric;
begin
  if jsonb_typeof(requested_payload) <> 'object'
     or jsonb_typeof(employment_payload) <> 'object'
     or jsonb_typeof(income_payload) <> 'object'
     or jsonb_typeof(organization_payload) <> 'object'
     or jsonb_typeof(labor_payload) <> 'object'
     or jsonb_typeof(schedule_payload) <> 'object'
     or jsonb_typeof(cost_payload) <> 'object' then
    raise exception 'COMPLETE_EMPLOYMENT_PAYLOAD_INVALID';
  end if;

  select employee.tenant_id into requested_tenant_id
  from public.employees employee
  where employee.id = requested_employee_id
    and employee.deleted_at is null
  for update;
  if requested_tenant_id is null then raise exception 'EMPLOYEE_NOT_FOUND'; end if;

  if requested_administration_id is null then raise exception 'ADMINISTRATION_REQUIRED'; end if;

  if not internal_security.current_user_has_permission(
    requested_tenant_id, requested_administration_id, 'contract:write'
  ) then raise exception 'FORBIDDEN'; end if;
  if not internal_security.current_user_has_permission(
    requested_tenant_id, requested_administration_id, 'organization-placement:write'
  ) then raise exception 'FORBIDDEN'; end if;
  if salary_payload is not null and not internal_security.current_user_has_permission(
    requested_tenant_id, requested_administration_id, 'salary:write'
  ) then raise exception 'FORBIDDEN'; end if;

  requested_starts_on := (employment_payload ->> 'startsOn')::date;
  requested_ends_on := nullif(employment_payload ->> 'endsOn', '')::date;
  if requested_starts_on is null then raise exception 'EMPLOYMENT_START_DATE_REQUIRED'; end if;
  if requested_ends_on is not null and requested_ends_on < requested_starts_on then
    raise exception 'EMPLOYMENT_DATE_RANGE_INVALID';
  end if;
  if (income_payload ->> 'validFrom')::date <> requested_starts_on
     or (organization_payload ->> 'effectiveFrom')::date <> requested_starts_on
     or (labor_payload ->> 'validFrom')::date <> requested_starts_on
     or (schedule_payload ->> 'validFrom')::date <> requested_starts_on
     or (cost_payload ->> 'validFrom')::date <> requested_starts_on
     or (salary_payload is not null and (salary_payload ->> 'validFrom')::date <> requested_starts_on) then
    raise exception 'INITIAL_TIMELINE_DATE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.employee_administration_assignments assignment
    where assignment.tenant_id = requested_tenant_id
      and assignment.administration_id = requested_administration_id
      and assignment.employee_id = requested_employee_id
      and assignment.effective_from <= requested_starts_on
      and (assignment.effective_to is null or assignment.effective_to >= requested_starts_on)
  ) then raise exception 'EMPLOYEE_ADMINISTRATION_MISMATCH'; end if;

  select count(*), coalesce(sum((item ->> 'percentage')::numeric), 0)
    into allocation_count, allocation_total
  from jsonb_array_elements(cost_payload -> 'allocations') item;
  if allocation_count = 0 or allocation_total <> 100 then
    raise exception 'COST_ALLOCATION_TOTAL_INVALID';
  end if;

  insert into public.employments (
    tenant_id, administration_id, employee_id, employment_number, employment_type,
    contract_type, record_status, starts_on, ends_on, probation_ends_on,
    seniority_date, original_hire_date, is_primary, reason_started, contract_document_url
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    employment_payload ->> 'employmentNumber',
    coalesce(employment_payload ->> 'employmentType', 'EMPLOYEE')::public.employment_type,
    (employment_payload ->> 'contractType')::public.contract_type, 'CONFIRMED',
    requested_starts_on, requested_ends_on,
    nullif(employment_payload ->> 'probationEndsOn', '')::date,
    (employment_payload ->> 'seniorityDate')::date,
    (employment_payload ->> 'originalHireDate')::date,
    coalesce((employment_payload ->> 'isPrimary')::boolean, false),
    nullif(employment_payload ->> 'reasonStarted', ''),
    nullif(employment_payload ->> 'contractDocumentUrl', '')
  ) returning id into created_employment_id;

  insert into public.employment_change_sets (
    tenant_id, administration_id, employee_id, employment_id, effective_on,
    reason, domains, status, applied_at, created_by_user_id
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, requested_starts_on,
    coalesce(nullif(employment_payload ->> 'reasonStarted', ''), 'EMPLOYMENT_CREATED'),
    case when salary_payload is null
      then array['EMPLOYMENT', 'INCOME_RELATIONSHIP', 'ORGANIZATION', 'LABOR_CONDITIONS', 'SCHEDULE', 'COST_ALLOCATION']
      else array['EMPLOYMENT', 'INCOME_RELATIONSHIP', 'ORGANIZATION', 'LABOR_CONDITIONS', 'SCHEDULE', 'SALARY', 'COST_ALLOCATION']
    end,
    'APPLIED', timezone('utc', now()), (select auth.uid())
  ) returning id into created_change_set_id;
  perform set_config('app.change_set_id', created_change_set_id::text, true);

  insert into public.income_relationships (
    tenant_id, administration_id, employee_id, payroll_tax_subnumber,
    ikv_number, relationship_type, starts_on, ends_on
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    income_payload ->> 'payrollTaxSubnumber', (income_payload ->> 'ikvNumber')::integer,
    'EMPLOYMENT', requested_starts_on,
    nullif(income_payload ->> 'validUntil', '')::date
  ) returning id into created_income_relationship_id;

  insert into public.employment_income_relationships (
    tenant_id, administration_id, employee_id, employment_id,
    income_relationship_id, valid_from, valid_until
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, created_income_relationship_id, requested_starts_on,
    nullif(income_payload ->> 'validUntil', '')::date
  );

  insert into public.employee_organizations (
    tenant_id, administration_id, employee_id, employment_id, department_id,
    job_title, direct_manager_id, direct_manager_deputy_id, cost_bearer,
    effective_from, effective_to
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, (organization_payload ->> 'departmentId')::uuid,
    organization_payload ->> 'jobTitle',
    nullif(organization_payload ->> 'managerEmployeeId', '')::uuid,
    nullif(organization_payload ->> 'directManagerDeputyId', '')::uuid,
    nullif(organization_payload ->> 'costBearer', ''), requested_starts_on,
    nullif(organization_payload ->> 'effectiveTo', '')::date
  );

  insert into public.employment_labor_conditions (
    tenant_id, administration_id, employee_id, employment_id,
    condition_group, valid_from, valid_until, change_set_id
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, labor_payload ->> 'conditionGroup', requested_starts_on,
    nullif(labor_payload ->> 'validUntil', '')::date, created_change_set_id
  );

  insert into public.employment_schedules (
    tenant_id, administration_id, employee_id, employment_id, schedule_type,
    start_week, average_days_per_week, average_hours_per_week, part_time_factor,
    time_for_time_accrual, monday_hours, tuesday_hours, wednesday_hours,
    thursday_hours, friday_hours, saturday_hours, sunday_hours,
    valid_from, valid_until, change_set_id
  ) values (
    requested_tenant_id, requested_administration_id, requested_employee_id,
    created_employment_id, (schedule_payload ->> 'scheduleType')::public.schedule_type,
    coalesce((schedule_payload ->> 'startWeek')::smallint, 1),
    (schedule_payload ->> 'averageDaysPerWeek')::numeric,
    (schedule_payload ->> 'averageHoursPerWeek')::numeric,
    (schedule_payload ->> 'partTimeFactor')::numeric,
    coalesce((schedule_payload ->> 'timeForTimeAccrual')::numeric, 0),
    nullif(schedule_payload ->> 'mondayHours', '')::numeric,
    nullif(schedule_payload ->> 'tuesdayHours', '')::numeric,
    nullif(schedule_payload ->> 'wednesdayHours', '')::numeric,
    nullif(schedule_payload ->> 'thursdayHours', '')::numeric,
    nullif(schedule_payload ->> 'fridayHours', '')::numeric,
    nullif(schedule_payload ->> 'saturdayHours', '')::numeric,
    nullif(schedule_payload ->> 'sundayHours', '')::numeric,
    requested_starts_on, nullif(schedule_payload ->> 'validUntil', '')::date,
    created_change_set_id
  );

  if salary_payload is not null then
    insert into public.employment_salaries (
      tenant_id, administration_id, employee_id, employment_id, payment_type,
      payment_frequency, salary_basis, fulltime_amount, hourly_rate, currency_code,
      salary_scale_step_id, cao_scale_name, cao_step_name,
      valid_from, valid_until, change_set_id
    ) values (
      requested_tenant_id, requested_administration_id, requested_employee_id,
      created_employment_id, (salary_payload ->> 'paymentType')::public.salary_payment_type,
      (salary_payload ->> 'paymentFrequency')::public.salary_frequency,
      (salary_payload ->> 'salaryBasis')::public.salary_basis,
      nullif(salary_payload ->> 'fulltimeAmount', '')::numeric,
      nullif(salary_payload ->> 'hourlyRate', '')::numeric,
      coalesce(salary_payload ->> 'currencyCode', 'EUR'),
      nullif(salary_payload ->> 'salaryScaleStepId', '')::uuid,
      nullif(salary_payload ->> 'caoScaleName', ''),
      nullif(salary_payload ->> 'caoStepName', ''),
      requested_starts_on, nullif(salary_payload ->> 'validUntil', '')::date,
      created_change_set_id
    );
  end if;

  for allocation in select value from jsonb_array_elements(cost_payload -> 'allocations') loop
    insert into public.employment_cost_allocations (
      tenant_id, administration_id, employee_id, employment_id, cost_center_id,
      percentage, valid_from, valid_until, change_set_id
    ) values (
      requested_tenant_id, requested_administration_id, requested_employee_id,
      created_employment_id, (allocation ->> 'costCenterId')::uuid,
      (allocation ->> 'percentage')::numeric, requested_starts_on,
      nullif(cost_payload ->> 'validUntil', '')::date, created_change_set_id
    );
  end loop;

  return created_employment_id;
exception
  when unique_violation then
    raise exception 'EMPLOYMENT_NUMBER_OR_IKV_CONFLICT';
end;
$$;

revoke all on function public.publish_complete_employment(uuid, uuid, jsonb) from public, anon;
grant execute on function public.publish_complete_employment(uuid, uuid, jsonb) to authenticated;
