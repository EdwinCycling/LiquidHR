begin;

-- HR Admin mag Administratie openen en bestaande administraties/HR-groepgegevens
-- beheren. Tenant-, HR-groep- en RLS-scopes blijven ongewijzigd.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('HR_ADMIN', 'TENANT_ADMIN')
  and permission.code in ('hr-group:read', 'hr-group:manage')
on conflict do nothing;

commit;
