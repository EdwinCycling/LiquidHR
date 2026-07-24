create table public.employee_activity_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  employee_id uuid not null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  message text not null check (length(btrim(message)) between 1 and 2_000),
  created_at timestamptz not null default timezone('utc', now()),
  constraint employee_activity_entries_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  constraint employee_activity_entries_administration_scope_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id) on delete restrict
);

create index employee_activity_entries_employee_idx
  on public.employee_activity_entries (tenant_id, employee_id, created_at desc);

insert into public.permissions (code, name, category, description)
values
  ('employee-activity:read', 'Medewerkeractiviteiten bekijken', 'Persoonlijk', 'Bekijkt handmatige activiteiten voor een geautoriseerde medewerker.'),
  ('employee-activity:write', 'Medewerkeractiviteit toevoegen', 'Persoonlijk', 'Voegt een handmatige activiteit toe voor een geautoriseerde medewerker.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('employee-activity:read', 'employee-activity:write')
on conflict do nothing;

alter table public.employee_activity_entries enable row level security;

create policy employee_activity_entries_select_scoped
on public.employee_activity_entries for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee-activity:read')));

create policy employee_activity_entries_insert_scoped
on public.employee_activity_entries for insert to authenticated
with check (
  created_by_user_id = auth.uid()
  and (select internal_security.can_manage_employee(employee_id, 'employee-activity:write'))
);

grant select, insert on public.employee_activity_entries to authenticated;
