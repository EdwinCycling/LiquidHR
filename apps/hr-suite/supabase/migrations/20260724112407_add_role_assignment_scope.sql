-- Dienstverband blijft de enige schrijfroute voor employee_organizations.
-- Deze tabel houdt uitsluitend de technische projectie voor scope en organogram bij.
alter table public.management_roles
  add column is_organization_scoped boolean not null default false;

alter table public.management_roles disable trigger guard_management_role_before_write;
alter table public.management_roles disable trigger audit_management_roles;
update public.management_roles
set is_organization_scoped = code = 'DIRECT_MANAGER'
where tenant_id is null and code in ('TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE');
alter table public.management_roles enable trigger guard_management_role_before_write;
alter table public.management_roles enable trigger audit_management_roles;

alter table public.department_management
  alter column department_id drop not null,
  drop constraint department_management_department_scope_fkey,
  drop constraint department_management_no_duplicate_period;

alter table public.department_management
  add constraint department_management_scoped_assignment_no_overlap
  exclude using gist (
    tenant_id with =, administration_id with =, department_id with =,
    employee_id with =, management_role_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (department_id is not null),
  add constraint department_management_tenant_assignment_no_overlap
  exclude using gist (
    tenant_id with =, administration_id with =, employee_id with =,
    management_role_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  ) where (department_id is null);

create or replace function internal_security.guard_role_assignment_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  assigned_role public.management_roles%rowtype;
begin
  select * into assigned_role
  from public.management_roles
  where id = new.management_role_id;

  if not found or assigned_role.is_active = false or assigned_role.deleted_at is not null then
    raise exception 'ROLE_ASSIGNMENT_ROLE_INVALID' using errcode = '23514';
  end if;
  if assigned_role.tenant_id is not null and assigned_role.tenant_id <> new.tenant_id then
    raise exception 'ROLE_ASSIGNMENT_TENANT_MISMATCH' using errcode = '23514';
  end if;
  if assigned_role.tenant_id is null and assigned_role.code in ('TENANT_ADMIN', 'EMPLOYEE') then
    raise exception 'ROLE_ASSIGNMENT_SYSTEM_ROLE_IMPLICIT' using errcode = '23514';
  end if;
  if assigned_role.is_organization_scoped <> (new.department_id is not null) then
    raise exception 'ROLE_ASSIGNMENT_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.guard_role_assignment_scope() from public, anon, authenticated;
create trigger guard_role_assignment_scope_before_write
before insert or update on public.department_management
for each row execute function internal_security.guard_role_assignment_scope();
