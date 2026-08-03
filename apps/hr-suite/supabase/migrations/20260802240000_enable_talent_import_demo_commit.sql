begin;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles as management_role
join public.tenants as tenant on tenant.id = management_role.tenant_id
join public.permissions as permission on permission.code = 'talent-record:write'
where tenant.slug = 'liquid-hr-demo-holding'
  and management_role.code = 'TENANT_ADMIN'
on conflict do nothing;

commit;
