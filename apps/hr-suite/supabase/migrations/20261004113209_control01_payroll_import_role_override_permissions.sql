-- CONTROL01 permission-seed correction discovered during CONTROL02 acceptance.
-- Existing tenant-specific system-role overrides replace the global matrix.
-- Keep only the payroll-import permissions already assigned to the matching
-- global role; do not grant them to unrelated tenant roles.
-- CONVERGENCE_REQUIRED: apply only after central approval for the exact project.
begin;

insert into public.role_permissions (management_role_id, permission_id)
select tenant_role.id, permission.id
from public.management_roles as tenant_role
cross join public.permissions as permission
where tenant_role.tenant_id is not null
  and tenant_role.code in ('TENANT_ADMIN', 'HR_ADMIN', 'PAYROLL_SPECIALIST')
  and permission.code in ('payroll-import:read', 'payroll-import:write')
  and exists (
    select 1
    from public.management_roles as global_role
    join public.role_permissions as global_role_permission
      on global_role_permission.management_role_id = global_role.id
    where global_role.tenant_id is null
      and global_role.code = tenant_role.code
      and global_role_permission.permission_id = permission.id
  )
on conflict do nothing;

commit;
