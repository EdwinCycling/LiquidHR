begin;

-- An employment exception overrides only the values it owns. The resolver
-- still returns the effective base rule so the engine keeps its basis,
-- frequency and timing semantics while applying the exception overlay.
create or replace function public.resolve_leave_accrual_rule_for_employment(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employment_id uuid,
  requested_leave_type_id uuid,
  requested_as_of_date date
)
returns table (
  leave_profile_id uuid,
  leave_type_id uuid,
  rule_id uuid,
  resolution_source text,
  no_accrual boolean,
  accrual_amount numeric,
  accrual_rate numeric,
  expiration_months smallint
)
language plpgsql
stable
security definer
set search_path = public, internal_security, auth
as $$
declare
  resolved_profile_id uuid;
  target_employee_id uuid;
  profile_source text := 'HR_GROUP_DEFAULT';
  exception_row public.leave_accrual_exceptions;
  rule_row public.leave_accrual_rules;
begin
  select employment.employee_id
    into target_employee_id
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.id = requested_employment_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null;
  if target_employee_id is null then
    raise exception using errcode = '23503', message = 'LEAVE_EMPLOYMENT_NOT_FOUND';
  end if;

  resolved_profile_id := public.resolve_leave_profile_for_employment(
    requested_tenant_id, requested_hr_group_id, requested_employment_id, requested_as_of_date
  );

  if exists (
    select 1 from public.employment_leave_profiles assignment
    where assignment.tenant_id = requested_tenant_id
      and assignment.hr_group_id = requested_hr_group_id
      and assignment.employment_id = requested_employment_id
      and assignment.leave_profile_id = resolved_profile_id
      and assignment.valid_from <= requested_as_of_date
      and (assignment.valid_until is null or assignment.valid_until > requested_as_of_date)
  ) then
    profile_source := 'EMPLOYMENT_PROFILE';
  elsif exists (
    select 1
    from public.employee_set_members member
    join public.employee_sets employee_set
      on employee_set.tenant_id = member.tenant_id
     and employee_set.hr_group_id = member.hr_group_id
     and employee_set.id = member.employee_set_id
     and employee_set.leave_profile_id = resolved_profile_id
     and employee_set.is_active
    where member.tenant_id = requested_tenant_id
      and member.hr_group_id = requested_hr_group_id
      and member.employee_id = target_employee_id
      and member.valid_from <= requested_as_of_date
      and (member.valid_until is null or member.valid_until > requested_as_of_date)
  ) then
    profile_source := 'EMPLOYEE_SET';
  end if;

  select rule_value.*
    into rule_row
  from public.leave_accrual_rules rule_value
  where rule_value.tenant_id = requested_tenant_id
    and rule_value.hr_group_id = requested_hr_group_id
    and rule_value.leave_profile_id = resolved_profile_id
    and rule_value.leave_type_id = requested_leave_type_id
    and rule_value.valid_from <= requested_as_of_date
    and (rule_value.valid_until is null or rule_value.valid_until > requested_as_of_date)
  order by rule_value.valid_from desc
  limit 1;

  select exception_value.*
    into exception_row
  from public.leave_accrual_exceptions exception_value
  where exception_value.tenant_id = requested_tenant_id
    and exception_value.hr_group_id = requested_hr_group_id
    and exception_value.employment_id = requested_employment_id
    and exception_value.leave_type_id = requested_leave_type_id
    and exception_value.valid_from <= requested_as_of_date
    and (exception_value.valid_until is null or exception_value.valid_until > requested_as_of_date)
  order by exception_value.valid_from desc
  limit 1;

  if exception_row.id is not null then
    return query select resolved_profile_id, requested_leave_type_id, rule_row.id,
      'EMPLOYMENT_EXCEPTION', exception_row.no_accrual,
      exception_row.accrual_amount, null::numeric, exception_row.expiration_months;
    return;
  end if;

  return query select resolved_profile_id, requested_leave_type_id, rule_row.id,
    profile_source, false, rule_row.accrual_amount, rule_row.accrual_rate,
    rule_row.expiration_months;
end;
$$;

revoke all on function public.resolve_leave_accrual_rule_for_employment(uuid, uuid, uuid, uuid, date) from public, anon;
grant execute on function public.resolve_leave_accrual_rule_for_employment(uuid, uuid, uuid, uuid, date) to authenticated;

commit;
