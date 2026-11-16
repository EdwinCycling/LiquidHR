-- Forward repair for the self-service lifecycle wrapper. The canonical
-- one-argument helper is current_employee_has_permission; the user-level
-- helper requires tenant and administration arguments.
create or replace function internal_security.normalize_expired_absence_cases(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  normalized_count integer;
begin
  if auth.uid() is null
     or not internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id)
     or not (
       internal_security.current_user_has_hr_group_permission(
         requested_tenant_id, requested_hr_group_id, 'absence:read'
       )
       or (
         internal_security.current_employee_id() is not null
         and internal_security.current_employee_has_permission('self:absence:read')
       )
     ) then
    raise exception 'ABSENCE_FORBIDDEN' using errcode = '42501';
  end if;

  update public.absence_cases absence_case
  set status = 'CLOSED',
      closed_at = coalesce(absence_case.closed_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where absence_case.tenant_id = requested_tenant_id
    and absence_case.hr_group_id = requested_hr_group_id
    and absence_case.status = 'RECOVERY_WINDOW'
    and absence_case.recovery_window_ends_on <= current_date
    and (
      internal_security.current_user_has_hr_group_permission(
        absence_case.tenant_id, absence_case.hr_group_id, 'absence:read'
      )
      or internal_security.can_manage_employee(absence_case.employee_id, 'absence:read')
      or (
        absence_case.employee_id = internal_security.current_employee_id()
        and internal_security.current_employee_has_permission('self:absence:read')
      )
    );

  get diagnostics normalized_count = row_count;
  return normalized_count;
end;
$$;

revoke all on function internal_security.normalize_expired_absence_cases(uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.normalize_expired_absence_cases(uuid, uuid) to authenticated;
