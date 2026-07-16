create type public.administration_mode as enum ('SEPARATE', 'COMBINED');
create type public.sharing_mode as enum ('FULLY_ISOLATED', 'SHARED_COLLEAGUES');
create type public.access_scope_type as enum ('TENANT', 'ADMINISTRATION');

alter table public.tenants
  add column administration_mode public.administration_mode not null default 'SEPARATE',
  add column sharing_mode public.sharing_mode not null default 'FULLY_ISOLATED',
  add column combined_at timestamptz,
  add constraint tenants_combined_at_matches_mode check (
    (administration_mode = 'SEPARATE' and combined_at is null)
    or (administration_mode = 'COMBINED' and combined_at is not null)
  );

create table public.administrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid,
  code text not null,
  name text not null,
  coc_number text,
  vat_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint administrations_tenant_code_key unique (tenant_id, code),
  constraint administrations_tenant_id_id_key unique (tenant_id, id),
  constraint administrations_parent_same_tenant_fkey
    foreign key (tenant_id, parent_id)
    references public.administrations(tenant_id, id)
    on delete restrict
);

create index administrations_tenant_parent_idx
  on public.administrations (tenant_id, parent_id);

create trigger set_administrations_updated_at
before update on public.administrations
for each row execute function internal_security.set_updated_at();

insert into public.administrations (tenant_id, code, name)
select tenant.id, 'DEFAULT', tenant.name
from public.tenants tenant
on conflict (tenant_id, code) do nothing;

alter table public.employees
  add constraint employees_tenant_id_id_key unique (tenant_id, id);

alter table public.departments
  add column administration_id uuid;

update public.departments department
set administration_id = administration.id
from public.administrations administration
where administration.tenant_id = department.tenant_id
  and administration.code = 'DEFAULT';

alter table public.departments
  alter column administration_id set not null,
  drop constraint departments_tenant_id_code_key,
  drop constraint departments_parent_id_fkey,
  add constraint departments_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  add constraint departments_tenant_administration_code_key
    unique (tenant_id, administration_id, code),
  add constraint departments_tenant_administration_id_key
    unique (tenant_id, administration_id, id),
  add constraint departments_parent_same_administration_fkey
    foreign key (tenant_id, administration_id, parent_id)
    references public.departments(tenant_id, administration_id, id)
    on delete restrict;

drop index if exists public.departments_tenant_parent_idx;
create index departments_tenant_administration_parent_idx
  on public.departments (tenant_id, administration_id, parent_id);
create index departments_administration_id_idx
  on public.departments (administration_id);

alter table public.department_management
  add column administration_id uuid;

update public.department_management assignment
set administration_id = department.administration_id
from public.departments department
where department.id = assignment.department_id;

alter table public.department_management
  alter column administration_id set not null,
  add constraint department_management_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  add constraint department_management_department_scope_fkey
    foreign key (tenant_id, administration_id, department_id)
    references public.departments(tenant_id, administration_id, id)
    on delete cascade,
  add constraint department_management_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete cascade;

create index department_management_tenant_administration_active_idx
  on public.department_management (tenant_id, administration_id, department_id, effective_from)
  where effective_to is null;
create index department_management_administration_id_idx
  on public.department_management (administration_id);

alter table public.employee_organizations
  add column administration_id uuid;

update public.employee_organizations organization
set administration_id = department.administration_id
from public.departments department
where department.id = organization.department_id;

alter table public.employee_organizations
  alter column administration_id set not null,
  add constraint employee_organizations_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  add constraint employee_organizations_department_scope_fkey
    foreign key (tenant_id, administration_id, department_id)
    references public.departments(tenant_id, administration_id, id)
    on delete restrict,
  add constraint employee_organizations_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete cascade,
  add constraint employee_organizations_manager_same_tenant_fkey
    foreign key (tenant_id, direct_manager_id)
    references public.employees(tenant_id, id),
  add constraint employee_organizations_deputy_same_tenant_fkey
    foreign key (tenant_id, direct_manager_deputy_id)
    references public.employees(tenant_id, id);

create index employee_organizations_tenant_administration_active_idx
  on public.employee_organizations (tenant_id, administration_id, employee_id, effective_from desc)
  where effective_to is null;
create index employee_organizations_administration_id_idx
  on public.employee_organizations (administration_id);

create table public.employee_administration_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  administration_id uuid not null,
  employee_id uuid not null,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_administration_assignments_dates_valid
    check (effective_to is null or effective_to >= effective_from),
  constraint employee_administration_assignments_administration_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  constraint employee_administration_assignments_employee_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete cascade
);

create unique index employee_administration_assignments_active_key
  on public.employee_administration_assignments (tenant_id, administration_id, employee_id)
  where effective_to is null;
create index employee_administration_assignments_employee_dates_idx
  on public.employee_administration_assignments (tenant_id, employee_id, effective_from, effective_to);
create index employee_administration_assignments_administration_id_idx
  on public.employee_administration_assignments (administration_id);

create trigger set_employee_administration_assignments_updated_at
before update on public.employee_administration_assignments
for each row execute function internal_security.set_updated_at();

insert into public.employee_administration_assignments (
  tenant_id,
  administration_id,
  employee_id,
  effective_from,
  effective_to
)
select distinct
  organization.tenant_id,
  organization.administration_id,
  organization.employee_id,
  organization.effective_from,
  organization.effective_to
from public.employee_organizations organization
on conflict do nothing;

insert into public.management_roles (code, name, description, is_system)
values (
  'TENANT_ADMIN',
  'Hoofdbeheerder',
  'Beheert alle toegestane administraties binnen één tenant.',
  true
)
on conflict (code) where tenant_id is null do update
set name = excluded.name,
    description = excluded.description,
    is_system = excluded.is_system;

insert into public.permissions (code, name, category, description)
values (
  'tenant:combine',
  'Administraties combineren',
  'Tenant & administraties',
  'Combineert gescheiden administraties eenmalig tot één operationele HR-omgeving.'
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and role.tenant_id is null
  and permission.code not like 'self:%'
on conflict do nothing;

create table public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  management_role_id uuid not null references public.management_roles(id) on delete restrict,
  scope_type public.access_scope_type not null,
  administration_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_access_scope_matches_administration check (
    (scope_type = 'TENANT' and administration_id is null)
    or (scope_type = 'ADMINISTRATION' and administration_id is not null)
  ),
  constraint user_access_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade
);

create unique index user_access_tenant_scope_key
  on public.user_access (user_id, tenant_id, management_role_id)
  where scope_type = 'TENANT' and is_active;
create unique index user_access_administration_scope_key
  on public.user_access (user_id, tenant_id, administration_id, management_role_id)
  where scope_type = 'ADMINISTRATION' and is_active;
create index user_access_user_tenant_active_idx
  on public.user_access (user_id, tenant_id, is_active);
create index user_access_tenant_administration_active_idx
  on public.user_access (tenant_id, administration_id, is_active);
create index user_access_management_role_id_idx
  on public.user_access (management_role_id);

create trigger set_user_access_updated_at
before update on public.user_access
for each row execute function internal_security.set_updated_at();

insert into public.user_access (
  user_id,
  tenant_id,
  management_role_id,
  scope_type
)
select distinct
  employee.auth_user_id,
  employee.tenant_id,
  role.id,
  'TENANT'::public.access_scope_type
from public.employees employee
join public.management_roles role
  on role.code = 'TENANT_ADMIN'
 and role.tenant_id is null
where employee.auth_user_id is not null
  and employee.deleted_at is null
on conflict do nothing;

drop trigger if exists link_employee_after_auth_user_write on auth.users;
drop function if exists internal_security.link_employee_from_auth_user();

create or replace function internal_security.validate_administration_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Een administratie kan niet zijn eigen parent zijn.';
  end if;

  if not exists (
    select 1
    from public.administrations parent
    where parent.id = new.parent_id
      and parent.tenant_id = new.tenant_id
  ) then
    raise exception 'De parentadministratie moet binnen dezelfde tenant vallen.';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_id
      from public.administrations parent
      where parent.id = new.parent_id

      union

      select parent.id, parent.parent_id
      from public.administrations parent
      join ancestors child on child.parent_id = parent.id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'De administratiehiërarchie mag geen cyclus bevatten.';
  end if;

  return new;
end;
$$;

create trigger validate_administration_parent_before_write
before insert or update of parent_id, tenant_id on public.administrations
for each row execute function internal_security.validate_administration_parent();

create or replace function internal_security.validate_department_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Een afdeling kan niet zijn eigen parent zijn.';
  end if;

  if not exists (
    select 1
    from public.departments parent
    where parent.id = new.parent_id
      and parent.tenant_id = new.tenant_id
      and parent.administration_id = new.administration_id
  ) then
    raise exception 'De parentafdeling moet binnen dezelfde administratie vallen.';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_id
      from public.departments parent
      where parent.id = new.parent_id

      union

      select parent.id, parent.parent_id
      from public.departments parent
      join ancestors child on child.parent_id = parent.id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'De afdelingenboom mag geen cyclus bevatten.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_department_parent_before_write on public.departments;
create trigger validate_department_parent_before_write
before insert or update of parent_id, tenant_id, administration_id on public.departments
for each row execute function internal_security.validate_department_parent();

create or replace function internal_security.validate_user_access_role_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.management_roles role
    where role.id = new.management_role_id
      and (role.tenant_id is null or role.tenant_id = new.tenant_id)
  ) then
    raise exception 'De toegangsrol moet globaal zijn of bij dezelfde tenant horen.';
  end if;

  return new;
end;
$$;

create trigger validate_user_access_role_scope_before_write
before insert or update of tenant_id, management_role_id on public.user_access
for each row execute function internal_security.validate_user_access_role_scope();

create or replace function internal_security.prevent_tenant_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'De tenant van een bestaand record kan niet worden gewijzigd.';
  end if;
  return new;
end;
$$;

create trigger prevent_employees_tenant_change
before update of tenant_id on public.employees
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_administrations_tenant_change
before update of tenant_id on public.administrations
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_departments_tenant_change
before update of tenant_id on public.departments
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_department_management_tenant_change
before update of tenant_id on public.department_management
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_employee_organizations_tenant_change
before update of tenant_id on public.employee_organizations
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_employee_assignments_tenant_change
before update of tenant_id on public.employee_administration_assignments
for each row execute function internal_security.prevent_tenant_scope_change();
create trigger prevent_user_access_tenant_change
before update of tenant_id on public.user_access
for each row execute function internal_security.prevent_tenant_scope_change();

create or replace function internal_security.has_tenant_access(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_access access
      join public.tenants tenant on tenant.id = access.tenant_id
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.is_active
        and tenant.is_active
    );
$$;

create or replace function internal_security.has_administration_access(
  requested_tenant_id uuid,
  requested_administration_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_access access
      join public.administrations administration
        on administration.tenant_id = access.tenant_id
       and administration.id = requested_administration_id
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.is_active
        and administration.is_active
        and (
          access.scope_type = 'TENANT'
          or (
            access.scope_type = 'ADMINISTRATION'
            and access.administration_id = requested_administration_id
          )
        )
    );
$$;

create or replace function internal_security.current_user_has_permission(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.user_access access
      join public.management_roles role on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission on permission.id = role_permission.permission_id
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.is_active
        and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
        and permission.code = requested_permission_code
        and (
          requested_administration_id is null
          or access.scope_type = 'TENANT'
          or access.administration_id = requested_administration_id
        )
    );
$$;

create or replace function internal_security.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id
  from public.employees employee
  where employee.auth_user_id = (select auth.uid())
    and employee.deleted_at is null
    and internal_security.has_tenant_access(employee.tenant_id)
  order by employee.created_at, employee.id
  limit 1;
$$;

create or replace function internal_security.can_manage_employee(
  target_employee_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive target_placements as (
    select organization.tenant_id,
           organization.administration_id,
           organization.department_id,
           organization.direct_manager_id
    from public.employee_organizations organization
    where organization.employee_id = target_employee_id
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to >= current_date)
  ),
  target_department_tree as (
    select department.id as department_id,
           department.parent_id,
           placement.tenant_id,
           placement.administration_id
    from target_placements placement
    join public.departments department
      on department.id = placement.department_id
     and department.tenant_id = placement.tenant_id
     and department.administration_id = placement.administration_id

    union

    select parent.id,
           parent.parent_id,
           tree.tenant_id,
           tree.administration_id
    from public.departments parent
    join target_department_tree tree on tree.parent_id = parent.id
    where parent.tenant_id = tree.tenant_id
      and parent.administration_id = tree.administration_id
  ),
  actors as (
    select employee.id, employee.tenant_id
    from public.employees employee
    where employee.auth_user_id = (select auth.uid())
      and employee.deleted_at is null
  )
  select exists (
    select 1
    from target_placements placement
    where internal_security.current_user_has_permission(
      placement.tenant_id,
      placement.administration_id,
      requested_permission_code
    )
  )
  or exists (
    select 1
    from target_placements placement
    join actors actor
      on actor.id = placement.direct_manager_id
     and actor.tenant_id = placement.tenant_id
    join public.management_roles role
      on role.code = 'DIRECT_MANAGER'
     and role.tenant_id is null
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = requested_permission_code
  )
  or exists (
    select 1
    from public.department_management assignment
    join actors actor
      on actor.id = assignment.employee_id
     and actor.tenant_id = assignment.tenant_id
    join public.role_permissions role_permission
      on role_permission.management_role_id = assignment.management_role_id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = requested_permission_code
    join target_department_tree tree
      on tree.department_id = assignment.department_id
     and tree.tenant_id = assignment.tenant_id
     and tree.administration_id = assignment.administration_id
    where assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
  );
$$;

create or replace function internal_security.enforce_combined_tenant_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.administration_mode = 'COMBINED' and (
    new.administration_mode <> 'COMBINED'
    or new.combined_at is distinct from old.combined_at
    or new.sharing_mode <> 'SHARED_COLLEAGUES'
  ) then
    raise exception 'Een gecombineerde tenant kan niet opnieuw worden gescheiden.';
  end if;

  if new.administration_mode = 'COMBINED' then
    if new.combined_at is null or new.sharing_mode <> 'SHARED_COLLEAGUES' then
      raise exception 'Combineren vereist een tijdstip en gedeelde collega-basisgegevens.';
    end if;
  elsif new.combined_at is not null then
    raise exception 'Een gescheiden tenant mag geen combineertijdstip hebben.';
  end if;

  return new;
end;
$$;

create trigger enforce_combined_tenant_immutable_before_update
before update of administration_mode, sharing_mode, combined_at on public.tenants
for each row execute function internal_security.enforce_combined_tenant_immutable();

create or replace function internal_security.combine_tenant_administrations(
  requested_tenant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not internal_security.current_user_has_permission(
    requested_tenant_id,
    null,
    'tenant:combine'
  ) then
    raise exception 'Je hebt geen recht om deze administraties te combineren.';
  end if;

  update public.tenants tenant
  set administration_mode = 'COMBINED',
      sharing_mode = 'SHARED_COLLEAGUES',
      combined_at = timezone('utc', now())
  where tenant.id = requested_tenant_id
    and tenant.administration_mode = 'SEPARATE';

  if not found then
    raise exception 'Deze tenant is al gecombineerd of bestaat niet.';
  end if;
end;
$$;

alter table public.administrations enable row level security;
alter table public.user_access enable row level security;
alter table public.employee_administration_assignments enable row level security;

drop policy if exists tenants_select_scoped on public.tenants;
create policy tenants_select_scoped
on public.tenants for select to authenticated
using ((select internal_security.has_tenant_access(id)));

create policy administrations_select_scoped
on public.administrations for select to authenticated
using ((select internal_security.has_administration_access(tenant_id, id)));

create policy user_access_select_own
on public.user_access for select to authenticated
using (user_id = (select auth.uid()) and is_active);

create policy employee_administration_assignments_select_scoped
on public.employee_administration_assignments for select to authenticated
using (
  (
    employee_id = (
      select employee.id
      from public.employees employee
      where employee.auth_user_id = (select auth.uid())
        and employee.tenant_id = employee_administration_assignments.tenant_id
        and employee.deleted_at is null
      limit 1
    )
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

drop policy if exists employees_select_scoped on public.employees;
create policy employees_select_scoped
on public.employees for select to authenticated
using (
  (
    auth_user_id = (select auth.uid())
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or (select internal_security.can_manage_employee(id, 'employee:read'))
  or exists (
    select 1
    from public.tenants tenant
    where tenant.id = employees.tenant_id
      and tenant.sharing_mode = 'SHARED_COLLEAGUES'
      and (select internal_security.current_user_has_permission(tenant.id, null, 'employee:read'))
  )
);

drop policy if exists employees_insert_scoped on public.employees;
create policy employees_insert_scoped
on public.employees for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));

drop policy if exists employees_update_scoped on public.employees;
create policy employees_update_scoped
on public.employees for update to authenticated
using ((select internal_security.can_manage_employee(id, 'employee:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'employee:write')));

drop policy if exists employees_delete_scoped on public.employees;
create policy employees_delete_scoped
on public.employees for delete to authenticated
using ((select internal_security.can_manage_employee(id, 'employee:delete')));

drop policy if exists departments_select_scoped on public.departments;
create policy departments_select_scoped
on public.departments for select to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'department:read'
  ))
);

drop policy if exists departments_insert_scoped on public.departments;
create policy departments_insert_scoped
on public.departments for insert to authenticated
with check (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'department:write'
  ))
);

drop policy if exists departments_update_scoped on public.departments;
create policy departments_update_scoped
on public.departments for update to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'department:write'
  ))
)
with check (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'department:write'
  ))
);

drop policy if exists departments_delete_scoped on public.departments;
create policy departments_delete_scoped
on public.departments for delete to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'department:write'
  ))
);

drop policy if exists department_management_select_scoped on public.department_management;
create policy department_management_select_scoped
on public.department_management for select to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id,
    administration_id,
    'department:read'
  ))
);

drop policy if exists employee_organizations_select_scoped on public.employee_organizations;
create policy employee_organizations_select_scoped
on public.employee_organizations for select to authenticated
using (
  (
    employee_id = (
      select employee.id
      from public.employees employee
      where employee.auth_user_id = (select auth.uid())
        and employee.tenant_id = employee_organizations.tenant_id
        and employee.deleted_at is null
      limit 1
    )
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or (select internal_security.can_manage_employee(employee_id, 'employee:read'))
);

drop policy if exists management_roles_select_scoped on public.management_roles;
create policy management_roles_select_scoped
on public.management_roles for select to authenticated
using (
  (
    tenant_id is null
    and exists (
      select 1 from public.user_access access
      where access.user_id = (select auth.uid()) and access.is_active
    )
  )
  or (select internal_security.has_tenant_access(tenant_id))
);

drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated
on public.permissions for select to authenticated
using (
  exists (
    select 1 from public.user_access access
    where access.user_id = (select auth.uid()) and access.is_active
  )
);

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated
on public.role_permissions for select to authenticated
using (
  exists (
    select 1 from public.user_access access
    where access.user_id = (select auth.uid()) and access.is_active
  )
);

grant select on table public.administrations to authenticated;
grant select on table public.user_access to authenticated;
grant select on table public.employee_administration_assignments to authenticated;

revoke all on function internal_security.validate_administration_parent() from public, anon, authenticated;
revoke all on function internal_security.validate_department_parent() from public, anon, authenticated;
revoke all on function internal_security.validate_user_access_role_scope() from public, anon, authenticated;
revoke all on function internal_security.prevent_tenant_scope_change() from public, anon, authenticated;
revoke all on function internal_security.enforce_combined_tenant_immutable() from public, anon, authenticated;
revoke all on function internal_security.has_tenant_access(uuid) from public, anon, authenticated;
revoke all on function internal_security.has_administration_access(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.current_user_has_permission(uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.current_employee_id() from public, anon, authenticated;
revoke all on function internal_security.can_manage_employee(uuid, text) from public, anon, authenticated;
revoke all on function internal_security.combine_tenant_administrations(uuid) from public, anon, authenticated;

grant execute on function internal_security.has_tenant_access(uuid) to authenticated;
grant execute on function internal_security.has_administration_access(uuid, uuid) to authenticated;
grant execute on function internal_security.current_user_has_permission(uuid, uuid, text) to authenticated;
grant execute on function internal_security.current_employee_id() to authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text) to authenticated;
grant execute on function internal_security.combine_tenant_administrations(uuid) to authenticated;
