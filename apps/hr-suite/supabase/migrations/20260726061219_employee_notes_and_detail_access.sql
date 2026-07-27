-- Employee notes are a separate, role-controlled employee-level record.
-- Managers can read and edit notes; only HR Admin can delete them.
insert into public.permissions (code, name, category, description)
values
  ('employee-note:read', 'Medewerkersnotities bekijken', 'MEDEWERKER', 'Notities op een medewerker bekijken.'),
  ('employee-note:write', 'Medewerkersnotities beheren', 'MEDEWERKER', 'Notities op een medewerker toevoegen en wijzigen.'),
  ('employee-note:delete', 'Medewerkersnotities verwijderen', 'MEDEWERKER', 'Notities op een medewerker verwijderen.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'TENANT_ADMIN'
  and permission.code in ('employee-note:read', 'employee-note:write', 'employee-note:delete')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'DIRECT_MANAGER'
  and permission.code in ('employee-note:read', 'employee-note:write')
on conflict do nothing;

create table public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid not null references public.administrations(id) on delete cascade,
  employee_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 4000),
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  updated_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_notes_employee_scope_fkey
    foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade
);

create index employee_notes_employee_created_idx
  on public.employee_notes (tenant_id, administration_id, employee_id, created_at desc);

create trigger set_employee_notes_updated_at
before update on public.employee_notes
for each row execute function internal_security.set_updated_at();

create trigger audit_employee_notes
after insert or update or delete on public.employee_notes
for each row execute function internal_security.audit_hr_change('employee_note');

alter table public.employee_notes enable row level security;

create policy employee_notes_select
on public.employee_notes for select to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee-note:read')));

create policy employee_notes_insert
on public.employee_notes for insert to authenticated
with check ((select internal_security.can_manage_employee(employee_id, 'employee-note:write')));

create policy employee_notes_update
on public.employee_notes for update to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee-note:write')))
with check ((select internal_security.can_manage_employee(employee_id, 'employee-note:write')));

create policy employee_notes_delete
on public.employee_notes for delete to authenticated
using ((select internal_security.can_manage_employee(employee_id, 'employee-note:delete')));

grant select, insert, update, delete on public.employee_notes to authenticated;
