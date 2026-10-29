begin;

do $$
begin
  if exists (
    select 1
    from public.actual_work_payroll_mappings mapping
    where mapping.processing_target = 'PAYMENT'
      and (
        mapping.salary_component_id <> 'system:payfull02:payfull02_variable_regular_wage'
        or mapping.salary_component_code <> 'PAYFULL02_VARIABLE_REGULAR_WAGE'
        or mapping.salary_component_version <> '2026.1-payfull02'
      )
  ) then
    raise exception using errcode = '23514', message = 'PAY_W04_COMPONENT_VERSION_PREFLIGHT_FAILED';
  end if;
end;
$$;

alter table public.actual_work_payroll_mappings
  drop constraint actual_work_payroll_mappings_target_check;

alter table public.actual_work_payroll_mappings
  add constraint actual_work_payroll_mappings_target_check check (
    (processing_target in ('INFORMATIONAL', 'TVT')
      and salary_component_id is null and salary_component_code is null
      and salary_component_version is null and salary_component_output is null
      and calculation_rule = 'NONE' and factor is null)
    or
    (processing_target = 'PAYMENT'
      and salary_component_id is not null and salary_component_code is not null
      and salary_component_version is not null and salary_component_output is not null
      and factor is not null and factor > 0
      and salary_component_id <> ''
      and salary_component_id = 'system:payfull02:payfull02_variable_regular_wage'
      and salary_component_code = 'PAYFULL02_VARIABLE_REGULAR_WAGE'
      and salary_component_version = '2026.1'
      and salary_component_output = 'amount'
      and calculation_rule = 'HOURLY_RATE_X_HOURS')
  );

create or replace function public.save_actual_work_payroll_mapping(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_work_hour_type_id uuid,
  requested_processing_target text,
  requested_salary_component_id text,
  requested_salary_component_code text,
  requested_salary_component_version text,
  requested_salary_component_output text,
  requested_calculation_rule text,
  requested_factor numeric,
  requested_valid_from date
)
returns public.actual_work_payroll_mappings
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  saved_mapping public.actual_work_payroll_mappings%rowtype;
begin
  if actor_id is null
    or not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'salary:write')
    or not internal_security.current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN']) then
    raise exception using errcode = '42501', message = 'ACTUAL_WORK_PAYROLL_MAPPING_NOT_AUTHORIZED';
  end if;
  if requested_processing_target = 'PREMIUM' then
    raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
  elsif requested_processing_target = 'PAYMENT' then
    if requested_salary_component_id <> 'system:payfull02:payfull02_variable_regular_wage'
      or requested_salary_component_code <> 'PAYFULL02_VARIABLE_REGULAR_WAGE'
      or requested_salary_component_version <> '2026.1'
      or requested_salary_component_output <> 'amount'
      or requested_calculation_rule <> 'HOURLY_RATE_X_HOURS'
      or requested_factor is null or requested_factor <= 0 then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP';
    end if;
  elsif requested_processing_target in ('TVT', 'INFORMATIONAL') then
    if requested_salary_component_id is not null or requested_salary_component_code is not null
      or requested_salary_component_version is not null or requested_salary_component_output is not null
      or requested_calculation_rule <> 'NONE' or requested_factor is not null then
      raise exception using errcode = '23514', message = 'ACTUAL_WORK_PAYROLL_NONPAYMENT_MAPPING_INVALID';
    end if;
  else
    raise exception using errcode = '22023', message = 'ACTUAL_WORK_PAYROLL_MAPPING_TARGET_INVALID';
  end if;
  insert into public.actual_work_payroll_mappings (
    tenant_id, hr_group_id, administration_id, work_hour_type_id,
    processing_target, salary_component_id, salary_component_code,
    salary_component_version, salary_component_output, calculation_rule,
    factor, valid_from, created_by
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_work_hour_type_id,
    requested_processing_target, requested_salary_component_id, requested_salary_component_code,
    requested_salary_component_version, requested_salary_component_output, requested_calculation_rule,
    requested_factor, requested_valid_from, actor_id
  ) returning * into saved_mapping;
  return saved_mapping;
end;
$$;

revoke all on function public.save_actual_work_payroll_mapping(uuid, uuid, uuid, uuid, text, text, text, text, text, text, numeric, date) from public, anon;
grant execute on function public.save_actual_work_payroll_mapping(uuid, uuid, uuid, uuid, text, text, text, text, text, text, numeric, date) to authenticated;

commit;
