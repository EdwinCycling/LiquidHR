begin;

-- Align only the existing tenant-specific TENANT_ADMIN override of the DEV
-- demo tenant with the already-existing global TENANT_ADMIN contract.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'focus:act-as-employee'
join public.tenants tenant on tenant.id = role.tenant_id
where role.code = 'TENANT_ADMIN'
  and tenant.slug = 'liquid-hr-demo-holding'
on conflict do nothing;

commit;
