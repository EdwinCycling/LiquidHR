alter table public.custom_field_definitions
  add column show_in_organization_chart_filter boolean not null default false;

insert into public.permissions (code, name, category, description)
values (
  'organization-chart:read',
  'Organogram bekijken',
  'Organisatie & inrichting',
  'Bekijkt het organogram binnen de geldige organisatie- en medewerkerscope.'
)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'organization-chart:read'
where role.code in ('TENANT_ADMIN', 'HR_ADVISOR', 'TEAM_LEAD')
  and role.deleted_at is null
on conflict do nothing;
