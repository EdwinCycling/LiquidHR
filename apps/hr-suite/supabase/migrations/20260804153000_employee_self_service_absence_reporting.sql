alter table public.absence_settings
  add column if not exists employee_self_report_enabled boolean not null default false;

create or replace function internal_security.report_absence(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_start_date date,
  requested_absence_percentage numeric,
  requested_expected_recovery_on date default null,
  requested_has_sickness_benefit_safety_net boolean default null,
  requested_is_work_accident boolean default null,
  requested_is_third_party_traffic_accident boolean default null,
  requested_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  existing_mutation uuid;
  case_record public.absence_cases%rowtype;
  spell_id uuid;
  threshold smallint;
  prior_count smallint;
  existing_recovered date;
  self_report boolean := false;
  target_employee_id uuid;
  reminder_id uuid;
  reminder_description text;
begin
  self_report := requested_employee_id = internal_security.current_employee_id()
    and exists (
      select 1 from public.absence_settings
      where tenant_id = requested_tenant_id
        and administration_id = requested_administration_id
        and employee_self_report_enabled
    );
  if auth.uid() is null or (not self_report and not internal_security.can_manage_employee(requested_employee_id, 'absence:write')) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_absence_percentage is null then requested_absence_percentage := 100; end if;
  if requested_absence_percentage <= 0 or requested_absence_percentage > 100 then
    raise exception 'ABSENCE_PERCENTAGE_INVALID' using errcode = '22023';
  end if;
  if self_report and (requested_expected_recovery_on is not null or requested_has_sickness_benefit_safety_net is not null or requested_is_work_accident is not null or requested_is_third_party_traffic_accident is not null) then
    raise exception 'ABSENCE_SELF_SERVICE_FIELDS_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_idempotency_key is not null then
    select result_case_id into existing_mutation from public.absence_mutations where tenant_id = requested_tenant_id and operation_key = requested_idempotency_key;
    if existing_mutation is not null then return existing_mutation; end if;
  end if;
  select frequent_absence_threshold into threshold from public.absence_settings where tenant_id = requested_tenant_id and administration_id = requested_administration_id;
  threshold := coalesce(threshold, 3);
  select count(*)::smallint into prior_count from public.absence_cases where tenant_id = requested_tenant_id and administration_id = requested_administration_id and employee_id = requested_employee_id and first_absence_on >= requested_start_date - interval '1 year' and first_absence_on < requested_start_date and archived_at is null;
  select * into case_record from public.absence_cases where tenant_id = requested_tenant_id and administration_id = requested_administration_id and employment_id = requested_employment_id and status in ('ACTIVE','RECOVERY_WINDOW') and archived_at is null order by first_absence_on desc limit 1 for update;
  if case_record.id is not null then
    select recovered_on into existing_recovered from public.absence_spells where case_id = case_record.id order by started_on desc limit 1;
    if existing_recovered is null then raise exception 'ABSENCE_ACTIVE_SPELL_EXISTS' using errcode = '23514'; end if;
    if requested_start_date - existing_recovered < 28 then
      update public.absence_cases set status = 'ACTIVE', recovery_window_ends_on = null, updated_at = timezone('utc', now()) where id = case_record.id;
    else
      update public.absence_cases set status = 'CLOSED', closed_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = case_record.id;
      case_record.id := null;
    end if;
  end if;
  if case_record.id is null then
    insert into public.absence_cases (tenant_id, administration_id, employee_id, employment_id, first_absence_on, effective_clock_start_on, has_sickness_benefit_safety_net, is_work_accident, is_third_party_traffic_accident, prior_case_count_12_months, frequent_absence_threshold, is_frequent_absence, created_by_user_id)
    values (requested_tenant_id, requested_administration_id, requested_employee_id, requested_employment_id, requested_start_date, requested_start_date, requested_has_sickness_benefit_safety_net, requested_is_work_accident, requested_is_third_party_traffic_accident, prior_count, threshold, prior_count + 1 >= threshold, auth.uid()) returning * into case_record;
  end if;
  insert into public.absence_spells (tenant_id, case_id, started_on, expected_recovery_on, reported_by_user_id) values (requested_tenant_id, case_record.id, requested_start_date, requested_expected_recovery_on, auth.uid()) returning id into spell_id;
  insert into public.absence_capacity_changes (tenant_id, case_id, spell_id, effective_on, absence_percentage, created_by_user_id) values (requested_tenant_id, case_record.id, spell_id, requested_start_date, requested_absence_percentage, auth.uid());
  if self_report then
    reminder_description := format('Ziekmelding door medewerker. Eerste ziektedag: %s. Controleer de ziekmelding en vul de aanvullende gegevens aan.', requested_start_date);
    for target_employee_id in
      select employee.id from public.user_access access join public.management_roles role on role.id = access.management_role_id join public.employees employee on employee.auth_user_id = access.user_id and employee.tenant_id = requested_tenant_id and employee.deleted_at is null where access.tenant_id = requested_tenant_id and access.is_active and role.code in ('TENANT_ADMIN','HR_ADMIN') and (access.administration_id is null or access.administration_id = requested_administration_id)
      union
      select manager.id from public.employee_organizations placement join public.employees manager on manager.id = placement.direct_manager_id and manager.tenant_id = requested_tenant_id and manager.deleted_at is null where placement.tenant_id = requested_tenant_id and placement.employee_id = requested_employee_id and placement.effective_from <= current_date and (placement.effective_to is null or placement.effective_to >= current_date) and placement.administration_id = requested_administration_id
    loop
      insert into public.reminders (tenant_id, administration_id, created_by_user_id, reminder_type, target_type, title, description, remind_at, status, published_at) values (requested_tenant_id, requested_administration_id, auth.uid(), 'HR', 'EMPLOYEES', 'Controleer ziekmelding', reminder_description, timezone('utc', now()), 'PUBLISHED', timezone('utc', now())) returning id into reminder_id;
      insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id) values (requested_tenant_id, requested_administration_id, reminder_id, target_employee_id);
      insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at) select requested_tenant_id, reminder_id, employee.auth_user_id, employee.id, timezone('utc', now()) from public.employees employee where employee.id = target_employee_id and employee.auth_user_id is not null on conflict (reminder_id, user_id) do nothing;
    end loop;
  end if;
  if requested_idempotency_key is not null then insert into public.absence_mutations (tenant_id, operation_key, operation_type, result_case_id) values (requested_tenant_id, requested_idempotency_key, 'REPORT', case_record.id) on conflict do nothing; end if;
  return case_record.id;
end;
$$;

revoke all on function internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) from public, anon;
grant execute on function internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) to authenticated;
