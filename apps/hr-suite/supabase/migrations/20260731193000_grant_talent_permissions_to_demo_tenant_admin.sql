-- The demo tenant has a tenant-specific TENANT_ADMIN override. Keep its
-- permissions aligned with the global role for the Talent Foundation.
insert into public.role_permissions (management_role_id, permission_id)
select role_row.id, permission_row.id
from public.management_roles as role_row
cross join public.permissions as permission_row
where role_row.code = 'TENANT_ADMIN'
  and role_row.tenant_id in (
    '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid
  )
  and permission_row.code in ('talent:manage', 'talent:manager-read', 'talent:read')
  and not exists (
    select 1
    from public.role_permissions as existing
    where existing.management_role_id = role_row.id
      and existing.permission_id = permission_row.id
  );
