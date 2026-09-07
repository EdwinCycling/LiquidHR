begin;

-- Tenant-scoped TENANT_ADMIN roles are the active HR Admin fixture in the
-- development tenant. Keep DG2/DG3 permissions aligned for global and
-- tenant-scoped admin role rows.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id = '07249eb9-545c-883b-b26b-d52f83b4f4a1'::uuid
  and exists (
    select 1
    from public.user_hr_group_access access
    where access.management_role_id = role.id
      and access.tenant_id = role.tenant_id
      and access.is_active
  )
  and permission.code in ('document-distribution:read', 'document-distribution:write', 'document-signing:read', 'document-signing:write')
on conflict do nothing;

commit;
