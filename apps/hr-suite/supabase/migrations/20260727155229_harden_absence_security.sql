alter function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text)
  set schema internal_security;
alter function public.recover_absence(uuid, date, text)
  set schema internal_security;

revoke all on function internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) from public, anon;
revoke all on function internal_security.recover_absence(uuid, date, text) from public, anon;
grant execute on function internal_security.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) to authenticated;
grant execute on function internal_security.recover_absence(uuid, date, text) to authenticated;

create or replace function public.report_absence(
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
language sql
security invoker
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.report_absence(
    requested_tenant_id,
    requested_administration_id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    requested_absence_percentage,
    requested_expected_recovery_on,
    requested_has_sickness_benefit_safety_net,
    requested_is_work_accident,
    requested_is_third_party_traffic_accident,
    requested_idempotency_key
  );
$$;

create or replace function public.recover_absence(
  requested_case_id uuid,
  requested_recovered_on date,
  requested_idempotency_key text default null
)
returns uuid
language sql
security invoker
set search_path = public, internal_security, pg_temp
as $$
  select internal_security.recover_absence(requested_case_id, requested_recovered_on, requested_idempotency_key);
$$;

revoke all on function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.recover_absence(uuid, date, text) from public, anon;
grant execute on function public.report_absence(uuid, uuid, uuid, uuid, date, numeric, date, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.recover_absence(uuid, date, text) to authenticated;

revoke all on table public.absence_settings, public.absence_cases, public.absence_spells,
  public.absence_capacity_changes, public.absence_mutations from anon;

drop policy if exists absence_settings_write on public.absence_settings;
create policy absence_settings_insert on public.absence_settings for insert to authenticated
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write')));
create policy absence_settings_update on public.absence_settings for update to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write')))
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'absence-settings:write')));
