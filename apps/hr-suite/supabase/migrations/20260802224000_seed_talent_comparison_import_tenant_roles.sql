begin;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id = (select tenant.id from public.tenants tenant where tenant.slug = 'liquid-hr-demo-holding')
  and permission.code in ('talent-comparison:read', 'talent-import:manage')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER'
  and role.tenant_id = (select tenant.id from public.tenants tenant where tenant.slug = 'liquid-hr-demo-holding')
  and permission.code = 'talent-comparison:read'
on conflict do nothing;

commit;
