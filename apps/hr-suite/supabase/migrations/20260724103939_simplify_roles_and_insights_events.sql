insert into public.permissions (code, name, category, description)
values ('report-upcoming-events:read', 'Rapport: aankomende gebeurtenissen', 'Rapportages', 'Geeft toegang tot het rapport Aankomende gebeurtenissen.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

update public.management_roles
set name = case code
  when 'TENANT_ADMIN' then 'HR Admin'
  when 'DIRECT_MANAGER' then 'Leidinggevende'
  when 'EMPLOYEE' then 'Medewerker'
  else name
end
where tenant_id is null and code in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE');

delete from public.role_permissions
where management_role_id in (
  select id from public.management_roles
  where tenant_id is not null or code not in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE')
);
delete from public.user_access
where management_role_id in (
  select id from public.management_roles
  where tenant_id is not null or code not in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE')
);
delete from public.department_management
where management_role_id in (
  select id from public.management_roles
  where tenant_id is not null or code not in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE')
);
delete from public.management_roles
where tenant_id is not null or code not in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE');

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
on conflict do nothing;
