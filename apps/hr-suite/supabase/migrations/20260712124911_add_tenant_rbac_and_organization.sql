create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.employees
  add column tenant_id uuid references public.tenants(id) on delete restrict,
  add column auth_user_id uuid references auth.users(id) on delete set null;

alter table public.employees
  alter column tenant_id set not null;

create unique index employees_tenant_auth_user_idx
  on public.employees (tenant_id, auth_user_id)
  where auth_user_id is not null and deleted_at is null;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, code)
);

create index departments_tenant_parent_idx on public.departments (tenant_id, parent_id);

create table public.management_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  deputy_role_id uuid references public.management_roles(id) on delete set null,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index management_roles_global_code_idx
  on public.management_roles (code)
  where tenant_id is null;

create unique index management_roles_tenant_code_idx
  on public.management_roles (tenant_id, code)
  where tenant_id is not null;

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.role_permissions (
  management_role_id uuid not null references public.management_roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (management_role_id, permission_id)
);

create table public.department_management (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  management_role_id uuid not null references public.management_roles(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete cascade,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint department_management_effective_dates_valid
    check (effective_to is null or effective_to >= effective_from)
);

create index department_management_active_employee_idx
  on public.department_management (tenant_id, employee_id, department_id)
  where effective_to is null;

create table public.employee_organizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  manager_employee_id uuid references public.employees(id) on delete set null,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_organizations_effective_dates_valid
    check (effective_to is null or effective_to >= effective_from)
);

create index employee_organizations_active_employee_idx
  on public.employee_organizations (tenant_id, employee_id, effective_from desc)
  where effective_to is null;

create index employee_organizations_active_department_idx
  on public.employee_organizations (tenant_id, department_id)
  where effective_to is null;

create function internal_security.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.deleted_at is null
  limit 1;
$$;

create function internal_security.has_tenant_access(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = (select auth.uid())
      and e.tenant_id = requested_tenant_id
      and e.deleted_at is null
  );
$$;

create function internal_security.can_manage_employee(
  target_employee_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with recursive target_department_tree as (
    select eo.department_id, d.parent_id
    from public.employee_organizations eo
    join public.departments d on d.id = eo.department_id
    where eo.employee_id = target_employee_id
      and eo.effective_from <= current_date
      and (eo.effective_to is null or eo.effective_to >= current_date)
    union all
    select d.id, d.parent_id
    from public.departments d
    join target_department_tree tree on tree.parent_id = d.id
  )
  select exists (
    select 1
    from public.department_management dm
    join public.role_permissions rp on rp.management_role_id = dm.management_role_id
    join public.permissions p on p.id = rp.permission_id
    join public.employees actor on actor.id = dm.employee_id
    where dm.employee_id = internal_security.current_employee_id()
      and actor.deleted_at is null
      and dm.effective_from <= current_date
      and (dm.effective_to is null or dm.effective_to >= current_date)
      and p.code = requested_permission_code
      and dm.department_id in (select department_id from target_department_tree)
  );
$$;

revoke all on function internal_security.current_employee_id() from public;
revoke all on function internal_security.has_tenant_access(uuid) from public;
revoke all on function internal_security.can_manage_employee(uuid, text) from public;
grant usage on schema internal_security to authenticated;
grant execute on function internal_security.current_employee_id() to authenticated;
grant execute on function internal_security.has_tenant_access(uuid) to authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text) to authenticated;

create trigger set_tenants_updated_at
before update on public.tenants
for each row execute function internal_security.set_updated_at();

create trigger set_departments_updated_at
before update on public.departments
for each row execute function internal_security.set_updated_at();

create trigger set_management_roles_updated_at
before update on public.management_roles
for each row execute function internal_security.set_updated_at();

create trigger set_department_management_updated_at
before update on public.department_management
for each row execute function internal_security.set_updated_at();

create trigger set_employee_organizations_updated_at
before update on public.employee_organizations
for each row execute function internal_security.set_updated_at();

alter table public.tenants enable row level security;
alter table public.departments enable row level security;
alter table public.management_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.department_management enable row level security;
alter table public.employee_organizations enable row level security;

drop policy employees_bootstrap_deny_direct_access on public.employees;

create policy employees_select_scoped
on public.employees for select to authenticated
using (
  id = internal_security.current_employee_id()
  or internal_security.can_manage_employee(id, 'employee:read')
);

create policy employees_write_scoped
on public.employees for all to authenticated
using (internal_security.can_manage_employee(id, 'employee:write'))
with check (internal_security.has_tenant_access(tenant_id));

create policy tenants_select_scoped
on public.tenants for select to authenticated
using (internal_security.has_tenant_access(id));

create policy departments_select_scoped
on public.departments for select to authenticated
using (
  internal_security.has_tenant_access(tenant_id)
  and internal_security.can_manage_employee(internal_security.current_employee_id(), 'department:read')
);

create policy departments_write_scoped
on public.departments for all to authenticated
using (
  internal_security.has_tenant_access(tenant_id)
  and internal_security.can_manage_employee(internal_security.current_employee_id(), 'department:write')
)
with check (internal_security.has_tenant_access(tenant_id));

create policy management_roles_select_scoped
on public.management_roles for select to authenticated
using (tenant_id is null or internal_security.has_tenant_access(tenant_id));

create policy permissions_select_authenticated
on public.permissions for select to authenticated
using (internal_security.current_employee_id() is not null);

create policy role_permissions_select_authenticated
on public.role_permissions for select to authenticated
using (internal_security.current_employee_id() is not null);

create policy department_management_select_scoped
on public.department_management for select to authenticated
using (internal_security.has_tenant_access(tenant_id));

create policy employee_organizations_select_scoped
on public.employee_organizations for select to authenticated
using (
  employee_id = internal_security.current_employee_id()
  or internal_security.can_manage_employee(employee_id, 'employee:read')
);

grant select, insert, update, delete on table public.tenants to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.departments to authenticated;
grant select, insert, update, delete on table public.management_roles to authenticated;
grant select, insert, update, delete on table public.permissions to authenticated;
grant select, insert, update, delete on table public.role_permissions to authenticated;
grant select, insert, update, delete on table public.department_management to authenticated;
grant select, insert, update, delete on table public.employee_organizations to authenticated;

insert into public.management_roles (code, name, description, is_system)
values
  ('EMPLOYEE', 'Medewerker', 'Selfservice-rol voor medewerkers.', true),
  ('DIRECT_MANAGER', 'Leidinggevende', 'Standaardrol voor directe leidinggevenden.', true)
on conflict (code) where tenant_id is null do update
set name = excluded.name,
    description = excluded.description,
    is_system = excluded.is_system;

insert into public.permissions (code, name, description)
values
  ('self:read', 'Eigen gegevens lezen', 'Leest de eigen basisgegevens.'),
  ('self:employee:read', 'Eigen medewerkerkaart lezen', 'Leest de eigen medewerkerkaart.'),
  ('employee:read', 'Medewerkers lezen', 'Leest medewerkers binnen de eigen managementscope.'),
  ('employee:write', 'Medewerkers wijzigen', 'Wijzigt medewerkers binnen de eigen managementscope.'),
  ('department:read', 'Afdelingen lezen', 'Leest de afdelingenboom.'),
  ('department:write', 'Afdelingen wijzigen', 'Wijzigt de afdelingenboom.'),
  ('salary:read', 'Salaris lezen', 'Leest salarisgegevens binnen de eigen managementscope.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code in (
  'self:read',
  'self:employee:read',
  'employee:read',
  'employee:write',
  'department:read',
  'department:write',
  'salary:read'
)
where management_role.code = 'DIRECT_MANAGER'
  and management_role.tenant_id is null
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code in ('self:read', 'self:employee:read')
where management_role.code = 'EMPLOYEE'
  and management_role.tenant_id is null
on conflict do nothing;
