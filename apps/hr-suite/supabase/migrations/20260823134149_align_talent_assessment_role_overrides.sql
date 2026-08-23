begin;

-- Tenant-specifieke rol-overrides vervangen globale permissions bij resolveAuthContext.
-- Houd de assessmentrechten daarom ook op bestaande tenant-overrides aanwezig.
insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
cross join public.permissions permission
where management_role.tenant_id is not null
  and (
    (management_role.code = 'TENANT_ADMIN' and permission.code in ('talent-assessment:manage', 'talent-assessment:read', 'talent-team:read'))
    or (management_role.code = 'DIRECT_MANAGER' and permission.code in ('talent-assessment:read', 'talent-assessment:write', 'talent-team:read'))
    or (management_role.code = 'EMPLOYEE' and permission.code in ('self:talent-assessment:read', 'self:talent-assessment:write'))
  )
on conflict do nothing;

commit;
