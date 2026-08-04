create or replace function public.get_employee_directory_access(
  requested_tenant_id uuid,
  requested_administration_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee-directory:read') then
    raise exception 'insufficient employee directory permission' using errcode = '42501';
  end if;

  return coalesce((
    select settings.employee_directory_enabled
    from public.administration_hr_settings settings
    where settings.tenant_id = requested_tenant_id
      and settings.administration_id = requested_administration_id
  ), true);
end;
$$;

revoke all on function public.get_employee_directory_access(uuid, uuid) from public, anon;
grant execute on function public.get_employee_directory_access(uuid, uuid) to authenticated;
