update public.administration_hr_settings
set employee_directory_show_name = true
where employee_directory_show_name is distinct from true;

create or replace function public.get_employee_directory_visibility(
  requested_tenant_id uuid,
  requested_administration_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee-directory:read')
    or internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee:read')
  ) then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'enabled', coalesce((
      select settings.employee_directory_enabled
      from public.administration_hr_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.administration_id = requested_administration_id
    ), true),
    'showName', true,
    'showJobDepartment', coalesce((
      select settings.employee_directory_show_job_department
      from public.administration_hr_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.administration_id = requested_administration_id
    ), true),
    'showWorkEmail', coalesce((
      select settings.employee_directory_show_work_email
      from public.administration_hr_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.administration_id = requested_administration_id
    ), true),
    'showWorkPhone', coalesce((
      select settings.employee_directory_show_work_phone
      from public.administration_hr_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.administration_id = requested_administration_id
    ), true),
    'showPresence', coalesce((
      select settings.employee_directory_show_presence
      from public.administration_hr_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.administration_id = requested_administration_id
    ), true),
    'showSchedule', coalesce((
      select settings.employee_directory_show_schedule
      from public.administration_hr_settings settings
      where settings.tenant_id = requested_tenant_id
        and settings.administration_id = requested_administration_id
    ), true)
  );
end;
$$;

revoke all on function public.get_employee_directory_visibility(uuid, uuid) from public, anon;
grant execute on function public.get_employee_directory_visibility(uuid, uuid) to authenticated;
