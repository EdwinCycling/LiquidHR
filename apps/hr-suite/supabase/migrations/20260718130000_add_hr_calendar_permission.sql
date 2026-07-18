insert into public.permissions (code, name, category, description) values
  ('hr-calendar:read', 'HR-wijzigingskalender bekijken', 'Kalender', 'Bekijkt toegestane HR-wijzigingen in een administratiebrede maandkalender.')
on conflict (code) do update set name=excluded.name, category=excluded.category, description=excluded.description;
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code in ('TENANT_ADMIN','HR_ADVISOR') and permission.code='hr-calendar:read' on conflict do nothing;
