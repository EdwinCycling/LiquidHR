begin;

-- A linked employee without an active or future confirmed employment is not
-- an Employee ESS user. Keep the identity row readable for the Focus state,
-- but fail closed for every ordinary selfservice permission. This remains
-- exact tenant/HR-group scoped for auth users linked to multiple employees.
create or replace function internal_security.current_employee_has_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.management_roles management_role
    join public.role_permissions role_permission
      on role_permission.management_role_id = management_role.id
    join public.permissions permission
      on permission.id = role_permission.permission_id
    where management_role.code = 'EMPLOYEE'
      and management_role.tenant_id is null
      and permission.code = requested_permission_code
      and (
        requested_permission_code = 'self:employee:read'
        or (
          exists (
            select 1
            from public.employees employee
            join public.employments employment
              on employment.employee_id = employee.id
             and employment.tenant_id = employee.tenant_id
             and employment.hr_group_id = employee.hr_group_id
            where employee.auth_user_id = (select auth.uid())
              and employee.tenant_id = requested_tenant_id
              and employee.hr_group_id = requested_hr_group_id
              and employee.deleted_at is null
              and employee.is_active
              and not employee.is_archived
              and employment.record_status = 'CONFIRMED'
              and employment.deleted_at is null
              and (
                employment.starts_on > current_date
                or (
                  employment.starts_on <= current_date
                  and (employment.ends_on is null or employment.ends_on >= current_date)
                )
              )
          )
          and not internal_security.current_employee_ess_access_is_blocked(
            requested_tenant_id,
            requested_hr_group_id
          )
          and (
            not internal_security.current_employee_is_preboarding(
              requested_tenant_id,
              requested_hr_group_id
            )
            or requested_permission_code in (
              'self:employee:read',
              'self:employee:write',
              'self:address:write',
              'self:relation:write',
              'self:bank-account:read',
              'self:bank-account:write',
              'self:contract:read',
              'self:custom-field-values:read',
              'self:custom-field-values:write',
              'self:journey:read',
              'self:journey:write',
              'self:document:read',
              'self:document-signing:read',
              'self:document-signing:write'
            )
          )
        )
      )
  );
$$;

commit;
