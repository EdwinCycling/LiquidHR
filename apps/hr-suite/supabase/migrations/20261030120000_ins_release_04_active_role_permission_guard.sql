begin;

-- Phase A2: keep the shared HR-group permission helper aligned with the
-- current preboarding contract while rejecting stale role snapshots.
create or replace function internal_security.current_user_has_hr_group_permission(
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
  select (select auth.uid()) is not null
    and not internal_security.current_employee_is_preboarding(
      requested_tenant_id,
      requested_hr_group_id
    )
    and exists (
      select 1
      from public.user_hr_group_access access
      join public.management_roles role
        on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
      join public.hr_groups group_row
        on group_row.tenant_id = access.tenant_id
       and group_row.id = access.hr_group_id
       and group_row.is_active
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.hr_group_id = requested_hr_group_id
        and access.is_active
        and role.is_active is true
        and role.deleted_at is null
        and permission.code = requested_permission_code
        and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
    );
$$;

-- CREATE OR REPLACE preserves the existing function owner and ACL. Repeat the
-- established callable-role boundary so a partially configured database is
-- corrected idempotently without changing service-role grants.
revoke all on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text)
  to authenticated;

commit;
