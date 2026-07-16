alter table public.permissions
  add column category text;

update public.permissions
set category = case
  when code like 'self:%' or code like 'employee:%' then 'Persoonlijk'
  when code like 'salary:%' then 'Salaris & payroll'
  when code like 'contract:%' then 'Contract & dienstverband'
  when code like 'department:%' or code like 'custom-fields:%' then 'Organisatie & inrichting'
  else 'Overig'
end;

alter table public.permissions
  alter column category set not null;

alter table public.employee_organizations
  rename column manager_employee_id to direct_manager_id;

update public.employee_organizations
set direct_manager_id = null
where direct_manager_id = employee_id;

alter table public.employee_organizations
  add column direct_manager_deputy_id uuid references public.employees(id) on delete set null,
  add column job_title text,
  add column cost_bearer text,
  add constraint employee_organizations_manager_not_self
    check (direct_manager_id is null or direct_manager_id <> employee_id),
  add constraint employee_organizations_deputy_not_self
    check (direct_manager_deputy_id is null or direct_manager_deputy_id <> employee_id),
  add constraint employee_organizations_manager_deputy_differ
    check (
      direct_manager_id is null
      or direct_manager_deputy_id is null
      or direct_manager_id <> direct_manager_deputy_id
    );

alter index public.employee_organizations_manager_employee_id_idx
  rename to employee_organizations_direct_manager_id_idx;

create index employee_organizations_direct_manager_deputy_id_idx
  on public.employee_organizations (direct_manager_deputy_id);

insert into public.permissions (code, name, category, description)
values
  ('employee:read', 'Medewerkers lezen', 'Persoonlijk', 'Leest medewerkers binnen de geldige managementscope.'),
  ('employee:write', 'Medewerkers wijzigen', 'Persoonlijk', 'Wijzigt medewerkers binnen de geldige managementscope.'),
  ('employee:delete', 'Medewerkers archiveren', 'Persoonlijk', 'Archiveert medewerkers binnen de geldige managementscope.'),
  ('self:employee:read', 'Eigen medewerkerkaart lezen', 'Persoonlijk', 'Leest uitsluitend de eigen medewerkerkaart.'),
  ('self:address:write', 'Eigen adres wijzigen', 'Persoonlijk', 'Wijzigt uitsluitend het eigen adres.'),
  ('self:relation:write', 'Eigen relaties wijzigen', 'Persoonlijk', 'Wijzigt uitsluitend eigen relaties en noodcontacten.'),
  ('salary:read', 'Salaris lezen', 'Salaris & payroll', 'Leest salarisgegevens binnen de geldige managementscope.'),
  ('salary:write', 'Salaris wijzigen', 'Salaris & payroll', 'Wijzigt salarisgegevens binnen de geldige managementscope.'),
  ('self:salary:read', 'Eigen salaris lezen', 'Salaris & payroll', 'Leest uitsluitend de eigen salarisgegevens.'),
  ('contract:read', 'Contracten lezen', 'Contract & dienstverband', 'Leest contractgegevens binnen de geldige managementscope.'),
  ('contract:write', 'Contracten wijzigen', 'Contract & dienstverband', 'Wijzigt contractgegevens binnen de geldige managementscope.'),
  ('self:contract:read', 'Eigen contract lezen', 'Contract & dienstverband', 'Leest uitsluitend het eigen contract.'),
  ('department:read', 'Afdelingen lezen', 'Organisatie & inrichting', 'Leest de afdelingenboom.'),
  ('department:write', 'Afdelingen wijzigen', 'Organisatie & inrichting', 'Wijzigt de afdelingenboom en managementtoewijzingen.'),
  ('custom-fields:write', 'Vrije velden beheren', 'Organisatie & inrichting', 'Beheert definities van dynamische vrije velden.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select employee_role.id, canonical_permission.id
from public.management_roles employee_role
join public.permissions legacy_permission on legacy_permission.code = 'self:read'
join public.role_permissions legacy_role_permission
  on legacy_role_permission.management_role_id = employee_role.id
 and legacy_role_permission.permission_id = legacy_permission.id
join public.permissions canonical_permission on canonical_permission.code = 'self:employee:read'
on conflict do nothing;

delete from public.permissions
where code = 'self:read';

insert into public.role_permissions (management_role_id, permission_id)
select employee_role.id, permission.id
from public.management_roles employee_role
join public.permissions permission on permission.code in (
  'self:employee:read',
  'self:address:write',
  'self:relation:write',
  'self:salary:read',
  'self:contract:read'
)
where employee_role.code = 'EMPLOYEE'
  and employee_role.tenant_id is null
on conflict do nothing;

delete from public.role_permissions role_permission
using public.management_roles management_role, public.permissions permission
where role_permission.management_role_id = management_role.id
  and role_permission.permission_id = permission.id
  and management_role.code = 'DIRECT_MANAGER'
  and management_role.tenant_id is null
  and permission.code like 'self:%';

create or replace function internal_security.current_employee_has_permission(
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.management_roles management_role
    join public.role_permissions role_permission
      on role_permission.management_role_id = management_role.id
    join public.permissions permission
      on permission.id = role_permission.permission_id
    where management_role.code = 'EMPLOYEE'
      and management_role.tenant_id is null
      and permission.code = requested_permission_code
      and internal_security.current_employee_id() is not null
  );
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
  with recursive target_placement as (
    select organization.tenant_id,
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
           placement.tenant_id
    from target_placement placement
    join public.departments department on department.id = placement.department_id

    union

    select parent.id,
           parent.parent_id,
           tree.tenant_id
    from public.departments parent
    join target_department_tree tree on tree.parent_id = parent.id
    where parent.tenant_id = tree.tenant_id
  ),
  actor as (
    select internal_security.current_employee_id() as employee_id
  )
  select
    exists (
      select 1
      from target_placement placement
      join actor on actor.employee_id = placement.direct_manager_id
      join public.management_roles management_role
        on management_role.code = 'DIRECT_MANAGER'
       and management_role.tenant_id is null
      join public.role_permissions role_permission
        on role_permission.management_role_id = management_role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = requested_permission_code
    )
    or exists (
      select 1
      from public.department_management assignment
      join actor on actor.employee_id = assignment.employee_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = assignment.management_role_id
      join public.permissions permission
        on permission.id = role_permission.permission_id
       and permission.code = requested_permission_code
      join target_department_tree tree
        on tree.department_id = assignment.department_id
       and tree.tenant_id = assignment.tenant_id
      where assignment.effective_from <= current_date
        and (assignment.effective_to is null or assignment.effective_to >= current_date)
    );
$$;

revoke all on function internal_security.current_employee_has_permission(text) from public, anon, authenticated;
revoke all on function internal_security.can_manage_employee(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.current_employee_has_permission(text) to authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text) to authenticated;

drop policy employees_select_scoped on public.employees;
create policy employees_select_scoped
on public.employees for select to authenticated
using (
  (
    id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or internal_security.can_manage_employee(id, 'employee:read')
);

drop policy employee_organizations_select_scoped on public.employee_organizations;
create policy employee_organizations_select_scoped
on public.employee_organizations for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or internal_security.can_manage_employee(employee_id, 'employee:read')
);

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
  ) then
    raise exception 'De parentafdeling moet binnen dezelfde tenant vallen.';
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

create trigger validate_department_parent_before_write
before insert or update of parent_id, tenant_id on public.departments
for each row execute function internal_security.validate_department_parent();

create or replace function internal_security.validate_management_role_deputy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deputy_role_id is null then
    return new;
  end if;

  if new.deputy_role_id = new.id then
    raise exception 'Een managementrol kan niet zijn eigen deputy zijn.';
  end if;

  if not exists (
    select 1
    from public.management_roles deputy
    where deputy.id = new.deputy_role_id
      and deputy.tenant_id is not distinct from new.tenant_id
  ) then
    raise exception 'De deputyrol moet binnen dezelfde scope vallen.';
  end if;

  if exists (
    with recursive deputies as (
      select deputy.id, deputy.deputy_role_id
      from public.management_roles deputy
      where deputy.id = new.deputy_role_id

      union

      select deputy.id, deputy.deputy_role_id
      from public.management_roles deputy
      join deputies child on child.deputy_role_id = deputy.id
    )
    select 1 from deputies where id = new.id
  ) then
    raise exception 'Deputyrollen mogen geen cyclus bevatten.';
  end if;

  return new;
end;
$$;

create trigger validate_management_role_deputy_before_write
before insert or update of deputy_role_id, tenant_id on public.management_roles
for each row execute function internal_security.validate_management_role_deputy();

revoke all on function internal_security.validate_department_parent() from public, anon, authenticated;
revoke all on function internal_security.validate_management_role_deputy() from public, anon, authenticated;
