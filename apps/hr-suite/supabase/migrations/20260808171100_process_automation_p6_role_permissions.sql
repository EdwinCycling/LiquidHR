begin;

-- Tenant-specifieke HR-adminrollen krijgen dezelfde Process Automation-lees-,
-- start-, beheer- en operatorrechten als de globale tenant-adminrol.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in (
  'process-definition:read', 'process-definition:write', 'process-definition:publish',
  'form-definition:read', 'form-definition:write', 'form-definition:publish',
  'process-instance:read', 'process-instance:start', 'process-instance:cancel',
  'process-task:read', 'process-task:act', 'process-task:reassign',
  'process-operations:read', 'process-operations:write'
)
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and role.tenant_id is not null
on conflict do nothing;

commit;
