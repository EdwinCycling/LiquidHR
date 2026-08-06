begin;

-- Tenant-specifieke TENANT_ADMIN-rollen zijn de effectieve HR-adminrollen in
-- demo- en klanttenants. Zij moeten dezelfde groepsbrede inrichting kunnen
-- beheren als de globale rol; de HR-groepsgrens en RLS blijven bepalend.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and permission.code in ('hr-group:read', 'hr-group:manage')
on conflict do nothing;

commit;
