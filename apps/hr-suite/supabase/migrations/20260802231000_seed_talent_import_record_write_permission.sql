begin;

-- The demo tenant has a tenant-specific TENANT_ADMIN override. Keep its
-- import command aligned with the record RLS policy without broadening access
-- for other roles or tenants.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id = (select tenant.id from public.tenants tenant where tenant.slug = 'liquid-hr-demo-holding')
  and permission.code = 'talent-record:write'
on conflict do nothing;

commit;
