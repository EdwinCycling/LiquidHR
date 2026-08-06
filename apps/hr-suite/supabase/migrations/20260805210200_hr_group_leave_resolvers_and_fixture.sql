begin;

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
    return query select resolved_profile_id, requested_leave_type_id, null::uuid,
      'EMPLOYMENT_EXCEPTION', exception_row.no_accrual, exception_row.accrual_amount,
      null::numeric, exception_row.expiration_months;
    return;
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

  return query select resolved_profile_id, requested_leave_type_id, rule_row.id,
    profile_source, false, rule_row.accrual_amount, rule_row.accrual_rate,
    rule_row.expiration_months;
end;
$$;

revoke all on function public.resolve_leave_accrual_rule_for_employment(uuid, uuid, uuid, uuid, date) from public, anon;
grant execute on function public.resolve_leave_accrual_rule_for_employment(uuid, uuid, uuid, uuid, date) to authenticated;

-- Controlled Step-7 data: a separate group standard, an employee-set override
-- and two employment-specific balance rows for the cross-administration
-- DEMO-028 fixture. All IDs are derived from stable fixture keys.
do $$
declare
  target_tenant uuid;
  multigroup_id uuid;
  default_group_id uuid;
  target_employee_id uuid;
  default_profile_id uuid;
  set_profile_id uuid;
  target_leave_type_id uuid;
  employment_row record;
  bucket_id uuid;
begin
  select id into target_tenant from public.tenants where slug = 'liquid-hr-demo-holding';
  select id into multigroup_id from public.hr_groups where tenant_id = target_tenant and code = 'TEST-MULTIGROUP';
  select id into default_group_id from public.hr_groups where tenant_id = target_tenant and code = 'DEFAULT';
  select id into target_employee_id from public.employees where tenant_id = target_tenant and hr_group_id = multigroup_id and employee_number = 'TEST-MULTIGROUP-MANAGER';

  insert into public.leave_profiles (tenant_id, hr_group_id, name, description, is_active, is_group_default)
  values (target_tenant, multigroup_id, 'Stap 7 groepsstandaard', 'Groepsstandaard voor de Stap 7-scopeproef.', true, true)
  on conflict (tenant_id, hr_group_id, name) do update
    set is_active = excluded.is_active, is_group_default = excluded.is_group_default
  returning id into default_profile_id;

  if default_profile_id is null then
    select id into default_profile_id from public.leave_profiles
    where tenant_id = target_tenant and hr_group_id = multigroup_id and name = 'Stap 7 groepsstandaard';
  end if;

  insert into public.leave_profiles (tenant_id, hr_group_id, name, description, is_active, is_group_default)
  values (target_tenant, multigroup_id, 'Stap 7 medewerker-set', 'Afwijkend profiel voor de medewerker-setproef.', true, false)
  on conflict (tenant_id, hr_group_id, name) do update
    set is_active = excluded.is_active, is_group_default = false
  returning id into set_profile_id;

  if set_profile_id is null then
    select id into set_profile_id from public.leave_profiles
    where tenant_id = target_tenant and hr_group_id = multigroup_id and name = 'Stap 7 medewerker-set';
  end if;

  insert into public.leave_types (
    tenant_id, hr_group_id, name, color_code, scope, is_system, is_active,
    is_self_service, entitlement_mode
  ) values (
    target_tenant, multigroup_id, 'Stap 7 testverlof', 'primary', 'OTHER', false, true,
    true, 'ACCRUAL'
  )
  on conflict (tenant_id, hr_group_id, name) do update set is_active = true
  returning id into target_leave_type_id;

  if target_leave_type_id is null then
    select id into target_leave_type_id from public.leave_types
    where tenant_id = target_tenant and hr_group_id = multigroup_id and name = 'Stap 7 testverlof';
  end if;

  insert into public.leave_accrual_rules (
    tenant_id, hr_group_id, leave_profile_id, leave_type_id, valid_from,
    accrual_basis, accrual_frequency, accrual_timing, accrual_amount,
    expiration_months
  ) values (
    target_tenant, multigroup_id, default_profile_id, target_leave_type_id,
    date '2026-01-01', 'CONTRACT_HOURS', 'YEARLY', 'UPFRONT', 1.5, 6
  ) on conflict do nothing;

  insert into public.leave_accrual_rules (
    tenant_id, hr_group_id, leave_profile_id, leave_type_id, valid_from,
    accrual_basis, accrual_frequency, accrual_timing, accrual_amount,
    expiration_months
  ) values (
    target_tenant, multigroup_id, set_profile_id, target_leave_type_id,
    date '2026-01-01', 'CONTRACT_HOURS', 'YEARLY', 'UPFRONT', 2.5, 12
  ) on conflict do nothing;

  insert into public.employee_sets (
    tenant_id, hr_group_id, leave_profile_id, name, description, priority, is_active
  ) values (
    target_tenant, multigroup_id, set_profile_id, 'Stap 7 afwijkende set',
    'Fixture: profielafwijking vóór de groepsstandaard.', 10, true
  ) on conflict (tenant_id, hr_group_id, name) do update
    set leave_profile_id = excluded.leave_profile_id, is_active = true, priority = excluded.priority;

  insert into public.employee_set_members (tenant_id, hr_group_id, employee_set_id, employee_id, valid_from)
  select target_tenant, multigroup_id, employee_set.id, target_employee_id, date '2026-01-01'
  from public.employee_sets employee_set
  where employee_set.tenant_id = target_tenant
    and employee_set.hr_group_id = multigroup_id
    and employee_set.name = 'Stap 7 afwijkende set'
  on conflict do nothing;

  if target_employee_id is not null then
    insert into public.leave_settings (tenant_id, hr_group_id, half_day_minutes)
    values (target_tenant, multigroup_id, 240)
    on conflict (tenant_id, hr_group_id) do update set half_day_minutes = excluded.half_day_minutes;
  end if;

  for employment_row in
    select employment.*
    from public.employments employment
    join public.employees employee on employee.tenant_id = employment.tenant_id and employee.id = employment.employee_id
    where employment.tenant_id = target_tenant
      and employment.hr_group_id = default_group_id
      and employee.employee_number = 'DEMO-028'
      and employment.record_status = 'CONFIRMED'
      and employment.deleted_at is null
  loop
    select id into target_leave_type_id
    from public.leave_types
    where tenant_id = target_tenant and hr_group_id = default_group_id and name = 'Wettelijk verlof'
    limit 1;
    if target_leave_type_id is null then continue; end if;

    insert into public.leave_balance_buckets (
      tenant_id, administration_id, hr_group_id, employee_id, employment_id,
      leave_type_id, accrual_year, accrual_reference_date, total_accrued,
      total_taken, total_expired, expiration_date
    ) values (
      target_tenant, employment_row.administration_id, default_group_id,
      employment_row.employee_id, employment_row.id, target_leave_type_id,
      2026, date '2026-01-01', 40, 0, 0, date '2027-07-01'
    ) on conflict do nothing
    returning id into bucket_id;

    if bucket_id is null then
      select id into bucket_id from public.leave_balance_buckets
      where tenant_id = target_tenant and hr_group_id = default_group_id
        and employment_id = employment_row.id and leave_type_id = target_leave_type_id
        and accrual_year = 2026 limit 1;
    end if;

    insert into public.leave_accrual_transactions (
      tenant_id, administration_id, hr_group_id, employee_id, employment_id,
      leave_type_id, bucket_id, transaction_type, amount, source_type,
      source_key, transaction_date
    ) values (
      target_tenant, employment_row.administration_id, default_group_id,
      employment_row.employee_id, employment_row.id, target_leave_type_id,
      bucket_id, 'OPENING_BALANCE', 40, 'STAP7_FIXTURE',
      'stap7-demo028-' || employment_row.id::text, date '2026-01-01'
    ) on conflict do nothing;
  end loop;
end;
$$;

commit;
