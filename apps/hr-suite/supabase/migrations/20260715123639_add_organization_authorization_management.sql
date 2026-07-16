alter table public.management_roles
  add column is_active boolean not null default true,
  add column deleted_at timestamptz;

insert into public.permissions (code, name, category, description)
values
  ('authorization:read', 'Rollen en rechten bekijken', 'Autorisatie', 'Bekijkt rollen en de functiepuntenmatrix binnen de tenant.'),
  ('authorization:write', 'Rollen en rechten beheren', 'Autorisatie', 'Beheert tenantrollen en hun functiepuntenmatrix.'),
  ('organization-placement:read', 'Organisatieplaatsingen bekijken', 'Organisatie & inrichting', 'Bekijkt tijdsgebonden plaatsingen binnen de geldige scope.'),
  ('organization-placement:write', 'Organisatieplaatsingen beheren', 'Organisatie & inrichting', 'Beheert tijdsgebonden plaatsingen binnen de administratie.'),
  ('management-assignment:read', 'Managementtoewijzingen bekijken', 'Organisatie & inrichting', 'Bekijkt tijdsgebonden rolhouders per afdeling.'),
  ('management-assignment:write', 'Managementtoewijzingen beheren', 'Organisatie & inrichting', 'Beheert tijdsgebonden rolhouders per afdeling.')
on conflict (code) do update set
  name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN' and role.tenant_id is null
  and permission.code in (
    'authorization:read', 'authorization:write',
    'organization-placement:read', 'organization-placement:write',
    'management-assignment:read', 'management-assignment:write'
  )
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'DIRECT_MANAGER' and role.tenant_id is null
  and permission.code in ('organization-placement:read', 'management-assignment:read')
on conflict do nothing;

create function internal_security.guard_management_role()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system or old.tenant_id is null then
      raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_system or old.tenant_id is null then
      raise exception 'SYSTEM_ROLE_IMMUTABLE' using errcode = '23514';
    end if;
    if new.tenant_id is distinct from old.tenant_id or new.code is distinct from old.code then
      raise exception 'ROLE_TECHNICAL_IDENTITY_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  if new.tenant_id is null or new.is_system then
    raise exception 'TENANT_ROLE_CANNOT_BE_SYSTEM' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.guard_management_role() from public, anon, authenticated;
create trigger guard_management_role_before_write
before insert or update or delete on public.management_roles
for each row execute function internal_security.guard_management_role();

alter table public.department_management
  add constraint department_management_no_duplicate_period
  exclude using gist (
    tenant_id with =, administration_id with =, department_id with =,
    employee_id with =, management_role_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  );

alter table public.employee_organizations
  add constraint employee_organizations_without_employment_no_overlap
  exclude using gist (
    tenant_id with =, administration_id with =, employee_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (employment_id is null),
  add constraint employee_organizations_per_employment_no_overlap
  exclude using gist (
    tenant_id with =, administration_id with =, employee_id with =, employment_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (employment_id is not null);

create policy management_roles_insert_scoped
on public.management_roles for insert to authenticated
with check (
  tenant_id is not null and not is_system
  and (select internal_security.current_user_has_permission(tenant_id, null, 'authorization:write'))
);
create policy management_roles_update_scoped
on public.management_roles for update to authenticated
using (
  tenant_id is not null and not is_system
  and (select internal_security.current_user_has_permission(tenant_id, null, 'authorization:write'))
)
with check (
  tenant_id is not null and not is_system
  and (select internal_security.current_user_has_permission(tenant_id, null, 'authorization:write'))
);

create policy role_permissions_insert_scoped
on public.role_permissions for insert to authenticated
with check (exists (
  select 1 from public.management_roles role
  where role.id = management_role_id and role.tenant_id is not null
    and not role.is_system and role.deleted_at is null
    and (select internal_security.current_user_has_permission(role.tenant_id, null, 'authorization:write'))
));
create policy role_permissions_delete_scoped
on public.role_permissions for delete to authenticated
using (exists (
  select 1 from public.management_roles role
  where role.id = management_role_id and role.tenant_id is not null
    and not role.is_system and role.deleted_at is null
    and (select internal_security.current_user_has_permission(role.tenant_id, null, 'authorization:write'))
));

create policy department_management_insert_scoped
on public.department_management for insert to authenticated
with check (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id, administration_id, 'management-assignment:write'
  ))
);
create policy department_management_update_scoped
on public.department_management for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'management-assignment:write'
)))
with check (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id, administration_id, 'management-assignment:write'
  ))
);

create policy employee_organizations_insert_scoped
on public.employee_organizations for insert to authenticated
with check (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id, administration_id, 'organization-placement:write'
  ))
);
create policy employee_organizations_update_scoped
on public.employee_organizations for update to authenticated
using ((select internal_security.current_user_has_permission(
  tenant_id, administration_id, 'organization-placement:write'
)))
with check (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (select internal_security.current_user_has_permission(
    tenant_id, administration_id, 'organization-placement:write'
  ))
);

create function internal_security.audit_role_permission_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  role_id uuid := coalesce(new.management_role_id, old.management_role_id);
  permission_id_value uuid := coalesce(new.permission_id, old.permission_id);
  tenant_id_value uuid;
begin
  select tenant_id into tenant_id_value from public.management_roles where id = role_id;
  if tenant_id_value is not null then
    insert into public.audit_logs (
      tenant_id, entity_name, entity_id, actor_user_id, action, changes
    ) values (
      tenant_id_value, 'role_permission', role_id, auth.uid(),
      case when tg_op = 'INSERT' then 'CREATE' else 'DELETE' end,
      jsonb_build_object('permissionId', permission_id_value)
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function internal_security.audit_role_permission_change() from public, anon, authenticated;
create trigger audit_departments
after insert or update or delete on public.departments
for each row execute function internal_security.audit_hr_change('department');
create trigger audit_management_roles
after insert or update or delete on public.management_roles
for each row execute function internal_security.audit_hr_change('management_role');
create trigger audit_department_management
after insert or update or delete on public.department_management
for each row execute function internal_security.audit_hr_change('department_management');
create trigger audit_employee_organizations
after insert or update or delete on public.employee_organizations
for each row execute function internal_security.audit_hr_change('employee_organization');
create trigger audit_role_permissions
after insert or delete on public.role_permissions
for each row execute function internal_security.audit_role_permission_change();

revoke insert, update, delete on public.permissions from authenticated;
revoke delete on public.departments from authenticated;
revoke delete on public.management_roles from authenticated;
revoke delete on public.department_management from authenticated;
revoke delete on public.employee_organizations from authenticated;
grant select, insert, update on public.management_roles to authenticated;
grant select, insert, delete on public.role_permissions to authenticated;
grant select, insert, update on public.department_management to authenticated;
grant select, insert, update on public.employee_organizations to authenticated;
