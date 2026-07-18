insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR')
  and permission.code in ('dashboard-widget:read', 'dashboard-widget:write')
on conflict do nothing;
