begin;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.tenants tenant on tenant.id = role.tenant_id
cross join public.permissions permission
where tenant.slug = 'liquid-hr-demo-holding'
  and (
    (role.code = 'TENANT_ADMIN' and permission.code in ('talent-goal:manage', 'talent-goal:read'))
    or (role.code = 'DIRECT_MANAGER' and permission.code in ('talent-goal:read', 'talent-goal:write'))
    or (role.code = 'EMPLOYEE' and permission.code in ('self:talent-goal:read', 'self:talent-goal:write'))
  )
on conflict do nothing;

commit;