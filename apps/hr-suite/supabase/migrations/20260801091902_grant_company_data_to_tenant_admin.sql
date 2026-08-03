insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and permission.code in ('company-data:read', 'company-data:write')
on conflict do nothing;
