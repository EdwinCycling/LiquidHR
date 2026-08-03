begin;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.tenants tenant on tenant.id = role.tenant_id
join public.permissions permission on permission.code = 'talent-record:read'
where tenant.slug = 'liquid-hr-demo-holding'
  and role.code = 'TENANT_ADMIN'
on conflict do nothing;

commit;
