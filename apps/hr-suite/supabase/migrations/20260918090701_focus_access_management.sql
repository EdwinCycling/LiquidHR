begin;

-- Existing groups keep the current Full portal experience. New groups use a
-- compact Employee Focus by default while managers retain Full access unless
-- the HR group explicitly chooses Focus-only for managers too.
alter table public.hr_groups
  add column if not exists employee_portal_mode text default 'FOCUS_ONLY',
  add column if not exists manager_portal_mode text default 'FOCUS_AND_FULL';

-- All groups that exist before this migration retain the current Full portal
-- behavior. The column defaults apply only to groups created afterwards.
update public.hr_groups
set employee_portal_mode = 'FOCUS_AND_FULL',
    manager_portal_mode = 'FOCUS_AND_FULL';

alter table public.hr_groups
  alter column employee_portal_mode set default 'FOCUS_ONLY',
  alter column employee_portal_mode set not null,
  alter column manager_portal_mode set default 'FOCUS_AND_FULL',
  alter column manager_portal_mode set not null,
  drop constraint if exists hr_groups_employee_portal_mode_check,
  drop constraint if exists hr_groups_manager_portal_mode_check,
  add constraint hr_groups_employee_portal_mode_check
    check (employee_portal_mode in ('FOCUS_ONLY', 'FOCUS_AND_FULL')),
  add constraint hr_groups_manager_portal_mode_check
    check (manager_portal_mode in ('FOCUS_ONLY', 'FOCUS_AND_FULL'));

comment on column public.hr_groups.employee_portal_mode is
  'Portal policy for employees in this HR group: Focus-only or Focus plus Full.';
comment on column public.hr_groups.manager_portal_mode is
  'Portal policy for managers in this HR group: Focus-only or Focus plus Full.';

-- Employee ESS access is deliberately separate from invitations and from
-- user_access. Blocking an employee therefore cannot remove an HR-admin or
-- manager role, delete Auth, or change another tenant's access.
create table if not exists public.employee_ess_access (
  employee_id uuid primary key,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  status text not null default 'ACTIVE',
  blocked_at timestamptz,
  blocked_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_ess_access_status_check
    check (status in ('ACTIVE', 'BLOCKED')),
  constraint employee_ess_access_blocked_at_check
    check ((status = 'ACTIVE' and blocked_at is null) or (status = 'BLOCKED' and blocked_at is not null)),
  constraint employee_ess_access_employee_scope_fkey
    foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
    on delete cascade,
  constraint employee_ess_access_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict
);

create index if not exists employee_ess_access_scope_idx
  on public.employee_ess_access (tenant_id, hr_group_id, status);

drop trigger if exists set_employee_ess_access_updated_at on public.employee_ess_access;
create trigger set_employee_ess_access_updated_at
before update on public.employee_ess_access
for each row execute function internal_security.set_updated_at();

insert into public.employee_ess_access (employee_id, tenant_id, hr_group_id)
select employee.id, employee.tenant_id, employee.hr_group_id
from public.employees employee
where employee.deleted_at is null
on conflict (employee_id) do nothing;

create or replace function internal_security.seed_employee_ess_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.employee_ess_access (employee_id, tenant_id, hr_group_id)
  values (new.id, new.tenant_id, new.hr_group_id)
  on conflict (employee_id) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_employee_ess_access_after_insert on public.employees;
create trigger seed_employee_ess_access_after_insert
after insert on public.employees
for each row execute function internal_security.seed_employee_ess_access();

revoke all on function internal_security.seed_employee_ess_access() from public, anon, authenticated;

alter table public.employee_ess_access enable row level security;
revoke all on public.employee_ess_access from public, anon, authenticated;
grant select on public.employee_ess_access to authenticated;

drop policy if exists employee_ess_access_select_scoped on public.employee_ess_access;
create policy employee_ess_access_select_scoped
on public.employee_ess_access for select to authenticated
using (
  employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'user:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'user:invite'))
);

create or replace function internal_security.current_employee_ess_access_is_blocked(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees employee
    join public.employee_ess_access ess_access
      on ess_access.employee_id = employee.id
     and ess_access.tenant_id = employee.tenant_id
     and ess_access.hr_group_id = employee.hr_group_id
    where employee.auth_user_id = (select auth.uid())
      and employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
      and ess_access.status = 'BLOCKED'
  );
$$;

revoke all on function internal_security.current_employee_ess_access_is_blocked(uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.current_employee_ess_access_is_blocked(uuid, uuid) to authenticated;

-- Keep the canonical employee permission resolver tenant/HR-group scoped and
-- fail closed for a blocked employee. self:employee:read is handled by the
-- employees policy below solely so the Focus shell can render the blocked
-- state; application permission checks still deny every ESS operation.
create or replace function internal_security.current_employee_has_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
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
      and (
        requested_permission_code = 'self:employee:read'
        or (
          not internal_security.current_employee_ess_access_is_blocked(
            requested_tenant_id,
            requested_hr_group_id
          )
          and (
            not internal_security.current_employee_is_preboarding(
              requested_tenant_id,
              requested_hr_group_id
            )
            or requested_permission_code in (
              'self:employee:read',
              'self:employee:write',
              'self:address:write',
              'self:relation:write',
              'self:bank-account:read',
              'self:bank-account:write',
              'self:contract:read',
              'self:custom-field-values:read',
              'self:custom-field-values:write',
              'self:journey:read',
              'self:journey:write',
              'self:document:read',
              'self:document-signing:read',
              'self:document-signing:write'
            )
          )
        )
      )
  );
$$;

-- The self employee row remains readable when blocked so the server can
-- render a deterministic blocked state. All employee subresources still use
-- current_employee_has_permission and therefore remain denied.
drop policy if exists employees_select_group on public.employees;
create policy employees_select_group
on public.employees for select to authenticated
using (
  (
    id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (
      (select internal_security.current_employee_has_permission(
        tenant_id, hr_group_id, 'self:employee:read'
      ))
      or exists (
        select 1
        from public.employee_ess_access ess_access
        where ess_access.employee_id = employees.id
          and ess_access.tenant_id = employees.tenant_id
          and ess_access.hr_group_id = employees.hr_group_id
          and ess_access.status = 'BLOCKED'
      )
    )
  )
  or (select internal_security.can_manage_employee(id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);

-- This RPC is the only authenticated write path for Employee ESS blocking.
-- It resolves the target's tenant and HR group from the row and records the
-- transition in the canonical audit log.
create or replace function public.set_employee_ess_access(
  target_employee_id uuid,
  requested_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.employees%rowtype;
  previous_status text;
begin
  if requested_status not in ('ACTIVE', 'BLOCKED') then
    raise exception 'EMPLOYEE_ESS_ACCESS_STATUS_INVALID' using errcode = 'P0001';
  end if;

  select employee.*
  into target
  from public.employees employee
  where employee.id = target_employee_id
    and employee.deleted_at is null
    and employee.is_active
    and not employee.is_archived;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if target.auth_user_id is null then
    raise exception 'EMPLOYEE_NOT_ACTIVATED' using errcode = 'P0001';
  end if;

  if not internal_security.current_user_has_hr_group_permission(
    target.tenant_id,
    target.hr_group_id,
    'user:invite'
  ) then
    raise exception 'EMPLOYEE_ESS_ACCESS_FORBIDDEN' using errcode = '42501';
  end if;

  select ess_access.status
  into previous_status
  from public.employee_ess_access ess_access
  where ess_access.employee_id = target.id
  for update;

  insert into public.employee_ess_access (
    employee_id,
    tenant_id,
    hr_group_id,
    status,
    blocked_at,
    blocked_by_user_id
  )
  values (
    target.id,
    target.tenant_id,
    target.hr_group_id,
    requested_status,
    case when requested_status = 'BLOCKED' then timezone('utc', now()) else null end,
    case when requested_status = 'BLOCKED' then (select auth.uid()) else null end
  )
  on conflict (employee_id) do update
  set status = excluded.status,
      blocked_at = excluded.blocked_at,
      blocked_by_user_id = excluded.blocked_by_user_id,
      updated_at = timezone('utc', now());

  insert into public.audit_logs (
    tenant_id,
    entity_name,
    entity_id,
    actor_user_id,
    action,
    changes,
    subject_employee_id
  )
  values (
    target.tenant_id,
    'employee_ess_access',
    target.id,
    (select auth.uid()),
    'UPDATE',
    jsonb_build_object('before_status', coalesce(previous_status, 'ACTIVE'), 'after_status', requested_status),
    target.id
  );

  return requested_status;
end;
$$;

revoke all on function public.set_employee_ess_access(uuid, text) from public, anon;
grant execute on function public.set_employee_ess_access(uuid, text) to authenticated;

commit;

