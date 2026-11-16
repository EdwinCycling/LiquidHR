begin;

-- Employees may use the group-wide self-report switch without receiving the
-- rest of the HR absence configuration. The wrapper deliberately returns
-- only the boolean and re-checks the current employee permission and scope.
create or replace function public.get_employee_self_report_enabled(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, internal_security, pg_temp
as $$
declare
  current_employee uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  current_employee := internal_security.current_employee_id(
    requested_tenant_id,
    requested_hr_group_id
  );

  if current_employee is null
     or not internal_security.current_employee_has_permission('self:absence:write') then
    return false;
  end if;

  return exists (
    select 1
    from public.absence_settings settings
    where settings.tenant_id = requested_tenant_id
      and settings.hr_group_id = requested_hr_group_id
      and settings.employee_self_report_enabled
  );
end;
$$;

revoke all on function public.get_employee_self_report_enabled(uuid, uuid) from public, anon;
grant execute on function public.get_employee_self_report_enabled(uuid, uuid) to authenticated;

commit;
