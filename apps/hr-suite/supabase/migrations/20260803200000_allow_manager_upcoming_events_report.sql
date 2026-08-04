insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code = 'report-upcoming-events:read'
where management_role.code = 'DIRECT_MANAGER'
  and management_role.tenant_id is null
on conflict do nothing;
