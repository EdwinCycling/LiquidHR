begin;

insert into public.permissions (code, name, category, description)
values
  ('self:bank-account:read', 'Eigen bankrekening bekijken', 'Persoonlijk', 'Bekijkt de eigen gemaskeerde bankrekeninggegevens.'),
  ('self:bank-account:write', 'Eigen bankrekening wijzigen', 'Persoonlijk', 'Wijzigt de eigen bankrekeninggegevens tijdens de preboarding.' )
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission
  on permission.code in ('self:bank-account:read', 'self:bank-account:write')
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
on conflict do nothing;

-- Preboarding is derived from the canonical employment timeline. It is not a
-- tenant-configurable role and it cannot be extended by role administration.
-- The tenant and HR-group arguments are mandatory in the authorization path:
-- the same auth user may be linked to employees in more than one tenant.
drop function if exists internal_security.current_employee_is_preboarding();

create or replace function internal_security.current_employee_is_preboarding(
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
    where employee.auth_user_id = (select auth.uid())
      and employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
      and employee.is_active
      and not employee.is_archived
      and exists (
        select 1
        from public.employments future_employment
        where future_employment.employee_id = employee.id
          and future_employment.tenant_id = employee.tenant_id
          and future_employment.hr_group_id = employee.hr_group_id
          and future_employment.record_status = 'CONFIRMED'
          and future_employment.deleted_at is null
          and future_employment.starts_on > current_date
      )
      and not exists (
        select 1
        from public.employments current_employment
        where current_employment.employee_id = employee.id
          and current_employment.tenant_id = employee.tenant_id
          and current_employment.hr_group_id = employee.hr_group_id
          and current_employment.record_status = 'CONFIRMED'
          and current_employment.deleted_at is null
          and current_employment.starts_on <= current_date
          and (
            current_employment.ends_on is null
            or current_employment.ends_on >= current_date
          )
      )
  );
$$;

-- Keep the legacy no-argument employee selector deterministic for historical
-- policies. An active employment always wins over a future-only link, so a
-- preboarding link in another tenant cannot change the active employee
-- context used by those policies. New authorization paths must use the
-- tenant/HR-group overload below instead.
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
  order by
    case
      when exists (
        select 1
        from public.employments employment
        where employment.employee_id = employee.id
          and employment.tenant_id = employee.tenant_id
          and employment.hr_group_id = employee.hr_group_id
          and employment.record_status = 'CONFIRMED'
          and employment.deleted_at is null
          and employment.starts_on <= current_date
          and (employment.ends_on is null or employment.ends_on >= current_date)
      ) then 0
      when exists (
        select 1
        from public.employments employment
        where employment.employee_id = employee.id
          and employment.tenant_id = employee.tenant_id
          and employment.hr_group_id = employee.hr_group_id
          and employment.record_status = 'CONFIRMED'
          and employment.deleted_at is null
          and employment.starts_on > current_date
      ) then 1
      else 2
    end,
    employee.is_archived,
    employee.created_at,
    employee.id
  limit 1;
$$;

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
  );
$$;

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
    from public.employees employee
    where employee.id = internal_security.current_employee_id()
      and internal_security.current_employee_has_permission(
        employee.tenant_id,
        employee.hr_group_id,
        requested_permission_code
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
    and (
      not exists (
        select 1
        from public.employees employee
        left join public.administrations administration
          on administration.tenant_id = requested_tenant_id
         and administration.id = requested_administration_id
        where employee.auth_user_id = (select auth.uid())
          and employee.tenant_id = requested_tenant_id
          and employee.deleted_at is null
          and (
            requested_administration_id is null
            or employee.hr_group_id = administration.hr_group_id
          )
          and internal_security.current_employee_is_preboarding(
            requested_tenant_id,
            employee.hr_group_id
          )
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

create or replace function internal_security.current_user_has_hr_group_permission(
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
  select (select auth.uid()) is not null
    and not internal_security.current_employee_is_preboarding(
      requested_tenant_id,
      requested_hr_group_id
    )
    and exists (
      select 1
      from public.user_hr_group_access access
      join public.management_roles role
        on role.id = access.management_role_id
      join public.role_permissions role_permission
        on role_permission.management_role_id = role.id
      join public.permissions permission
        on permission.id = role_permission.permission_id
      join public.hr_groups group_row
        on group_row.tenant_id = access.tenant_id
       and group_row.id = access.hr_group_id
       and group_row.is_active
      where access.user_id = (select auth.uid())
        and access.tenant_id = requested_tenant_id
        and access.hr_group_id = requested_hr_group_id
        and access.is_active
        and permission.code = requested_permission_code
        and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
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
  select coalesce((
    select (
      (
        internal_security.current_employee_is_preboarding(
          target_scope.tenant_id,
          target_scope.hr_group_id
        )
        and target_employee_id = internal_security.current_employee_id(
          target_scope.tenant_id,
          target_scope.hr_group_id
        )
        and requested_permission_code in ('bank-account:read', 'bank-account:write')
        and internal_security.current_employee_has_permission(
          target_scope.tenant_id,
          target_scope.hr_group_id,
          'self:' || requested_permission_code
        )
      )
      or (
        not internal_security.current_employee_is_preboarding(
          target_scope.tenant_id,
          target_scope.hr_group_id
        )
      and (
      exists (
        select 1
        from public.employee_organizations organization
        where organization.employee_id = target_employee_id
          and organization.tenant_id = target_scope.tenant_id
          and organization.hr_group_id = target_scope.hr_group_id
          and organization.effective_from <= current_date
          and (organization.effective_to is null or organization.effective_to >= current_date)
          and internal_security.current_user_has_hr_group_permission(
            organization.tenant_id,
            organization.hr_group_id,
            requested_permission_code
          )
      )
      or exists (
        with recursive target_placements as (
          select organization.tenant_id,
                 organization.hr_group_id,
                 organization.department_id,
                 organization.direct_manager_id
          from public.employee_organizations organization
          where organization.employee_id = target_employee_id
            and organization.tenant_id = target_scope.tenant_id
            and organization.hr_group_id = target_scope.hr_group_id
            and organization.effective_from <= current_date
            and (organization.effective_to is null or organization.effective_to >= current_date)
        ),
        target_department_tree as (
          select department.id as department_id,
                 department.parent_id,
                 placement.tenant_id,
                 placement.hr_group_id
          from target_placements placement
          join public.departments department
            on department.id = placement.department_id
           and department.tenant_id = placement.tenant_id
           and department.hr_group_id = placement.hr_group_id

          union

          select parent.id,
                 parent.parent_id,
                 tree.tenant_id,
                 tree.hr_group_id
          from public.departments parent
          join target_department_tree tree
            on tree.parent_id = parent.id
           and parent.tenant_id = tree.tenant_id
           and parent.hr_group_id = tree.hr_group_id
        ),
        actors as (
          select employee.id, employee.tenant_id, employee.hr_group_id
          from public.employees employee
          where employee.auth_user_id = (select auth.uid())
            and employee.deleted_at is null
        )
        select 1
        from target_placements placement
        join actors actor
          on actor.id = placement.direct_manager_id
         and actor.tenant_id = placement.tenant_id
         and actor.hr_group_id = placement.hr_group_id
        join public.management_roles role
          on role.code = 'DIRECT_MANAGER'
         and role.tenant_id is null
         and role.is_active
         and role.deleted_at is null
        join public.role_permissions role_permission
          on role_permission.management_role_id = role.id
        join public.permissions permission
          on permission.id = role_permission.permission_id
         and permission.code = requested_permission_code
        where internal_security.has_hr_group_access(placement.tenant_id, placement.hr_group_id)
      )
      or exists (
        with recursive target_placements as (
          select organization.tenant_id,
                 organization.hr_group_id,
                 organization.department_id
          from public.employee_organizations organization
          where organization.employee_id = target_employee_id
            and organization.tenant_id = target_scope.tenant_id
            and organization.hr_group_id = target_scope.hr_group_id
            and organization.effective_from <= current_date
            and (organization.effective_to is null or organization.effective_to >= current_date)
        ),
        target_department_tree as (
          select department.id as department_id,
                 department.parent_id,
                 placement.tenant_id,
                 placement.hr_group_id
          from target_placements placement
          join public.departments department
            on department.id = placement.department_id
           and department.tenant_id = placement.tenant_id
           and department.hr_group_id = placement.hr_group_id

          union

          select parent.id,
                 parent.parent_id,
                 tree.tenant_id,
                 tree.hr_group_id
          from public.departments parent
          join target_department_tree tree
            on tree.parent_id = parent.id
           and parent.tenant_id = tree.tenant_id
           and parent.hr_group_id = tree.hr_group_id
        ),
        actors as (
          select employee.id, employee.tenant_id, employee.hr_group_id
          from public.employees employee
          where employee.auth_user_id = (select auth.uid())
            and employee.deleted_at is null
        )
        select 1
        from public.department_management assignment
        join actors actor
          on actor.id = assignment.employee_id
         and actor.tenant_id = assignment.tenant_id
         and actor.hr_group_id = assignment.hr_group_id
        join public.role_permissions role_permission
          on role_permission.management_role_id = assignment.management_role_id
        join public.permissions permission
          on permission.id = role_permission.permission_id
         and permission.code = requested_permission_code
        join target_department_tree tree
          on tree.department_id = assignment.department_id
         and tree.tenant_id = assignment.tenant_id
         and tree.hr_group_id = assignment.hr_group_id
        where assignment.effective_from <= current_date
          and (assignment.effective_to is null or assignment.effective_to >= current_date)
          and internal_security.has_hr_group_access(tree.tenant_id, tree.hr_group_id)
      )
    )
    )
    )
    from public.employees target_scope
    where target_scope.id = target_employee_id
      and target_scope.deleted_at is null
  ), false);
$$;

-- These helpers are used by employee addresses and relations. They receive
-- the target employee's HR group from the row itself, so the self branch is
-- never evaluated against another tenant's preboarding state.
create or replace function internal_security.employee_subresource_can_read(
  requested_tenant_id uuid,
  requested_employee_id uuid
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
    where employee.id = requested_employee_id
      and employee.tenant_id = requested_tenant_id
      and (
        (
          requested_employee_id = internal_security.current_employee_id(
            employee.tenant_id,
            employee.hr_group_id
          )
          and internal_security.current_employee_has_permission(
            employee.tenant_id,
            employee.hr_group_id,
            'self:employee:read'
          )
        )
        or internal_security.can_manage_employee(requested_employee_id, 'employee:read')
        or internal_security.current_user_has_hr_group_permission(
          employee.tenant_id,
          employee.hr_group_id,
          'employee:read'
        )
      )
  );
$$;

create or replace function internal_security.employee_subresource_can_write(
  requested_tenant_id uuid,
  requested_employee_id uuid,
  self_permission text
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
    where employee.id = requested_employee_id
      and employee.tenant_id = requested_tenant_id
      and (
        (
          requested_employee_id = internal_security.current_employee_id(
            employee.tenant_id,
            employee.hr_group_id
          )
          and internal_security.current_employee_has_permission(
            employee.tenant_id,
            employee.hr_group_id,
            self_permission
          )
        )
        or internal_security.current_user_has_hr_group_permission(
          employee.tenant_id,
          employee.hr_group_id,
          'employee:write'
        )
        or internal_security.can_manage_employee(requested_employee_id, 'employee:write')
      )
  );
$$;

-- Custom-field access has the same row-scoped boundary. The historical
-- parameter name is retained for function compatibility; it is the HR-group
-- id in the finalized schema.
create or replace function internal_security.custom_field_value_can_read(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.hr_group_id = requested_administration_id
      and definition.is_active
      and definition.deleted_at is null
      and exists (
        select 1
        from public.employees employee
        where employee.tenant_id = requested_tenant_id
          and employee.hr_group_id = requested_administration_id
          and employee.id = requested_employee_id
          and employee.deleted_at is null
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id(
            requested_tenant_id,
            requested_administration_id
          )
          and definition.employee_self_access <> 'HIDDEN'
          and internal_security.current_employee_has_permission(
            requested_tenant_id,
            requested_administration_id,
            'self:custom-field-values:read'
          )
        )
        or (
          definition.hr_access <> 'HIDDEN'
          and internal_security.current_user_has_hr_group_permission(
            requested_tenant_id,
            requested_administration_id,
            'employee:write'
          )
          and internal_security.current_user_has_hr_group_permission(
            requested_tenant_id,
            requested_administration_id,
            'custom-field-values:read'
          )
        )
        or (
          definition.manager_access <> 'HIDDEN'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_hr_group_permission(
            requested_tenant_id,
            requested_administration_id,
            'custom-field-values:read'
          )
        )
      )
  );
$$;

create or replace function internal_security.custom_field_value_can_write(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.hr_group_id = requested_administration_id
      and definition.is_active
      and definition.deleted_at is null
      and exists (
        select 1
        from public.employees employee
        where employee.tenant_id = requested_tenant_id
          and employee.hr_group_id = requested_administration_id
          and employee.id = requested_employee_id
          and employee.deleted_at is null
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id(
            requested_tenant_id,
            requested_administration_id
          )
          and definition.employee_self_access = 'WRITE'
          and internal_security.current_employee_has_permission(
            requested_tenant_id,
            requested_administration_id,
            'self:custom-field-values:write'
          )
        )
        or (
          definition.hr_access = 'WRITE'
          and internal_security.current_user_has_hr_group_permission(
            requested_tenant_id,
            requested_administration_id,
            'employee:write'
          )
          and internal_security.current_user_has_hr_group_permission(
            requested_tenant_id,
            requested_administration_id,
            'custom-field-values:write'
          )
        )
        or (
          definition.manager_access = 'WRITE'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_hr_group_permission(
            requested_tenant_id,
            requested_administration_id,
            'custom-field-values:write'
          )
        )
      )
  );
$$;

-- Replace the final HR-group policies whose self branches still referenced
-- the legacy global helper. Their management branches remain unchanged.
drop policy if exists employees_select_group on public.employees;
create policy employees_select_group
on public.employees for select to authenticated
using (
  (
    id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission(
      tenant_id, hr_group_id, 'self:employee:read'
    ))
  )
  or (select internal_security.can_manage_employee(id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
);

drop policy if exists employees_update_group on public.employees;
create policy employees_update_group
on public.employees for update to authenticated
using (
  (
    id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission(
      tenant_id, hr_group_id, 'self:employee:write'
    ))
  )
  or (select internal_security.can_manage_employee(id, 'employee:write'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:write'))
)
with check (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (
      id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
      and (select internal_security.current_employee_has_permission(
        tenant_id, hr_group_id, 'self:employee:write'
      ))
    )
    or (select internal_security.can_manage_employee(id, 'employee:write'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'employee:write'))
  )
);

drop policy if exists employments_select_group on public.employments;
create policy employments_select_group
on public.employments for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission(
      tenant_id, hr_group_id, 'self:contract:read'
    ))
  )
  or (select internal_security.can_manage_employee(employee_id, 'contract:read'))
  or (
    record_status = 'CONFIRMED'
    and deleted_at is null
    and (select internal_security.can_manage_employee(employee_id, 'absence:write'))
  )
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'contract:read'))
);

drop policy if exists employee_organizations_select_group on public.employee_organizations;
create policy employee_organizations_select_group
on public.employee_organizations for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id(tenant_id, hr_group_id))
    and (select internal_security.current_employee_has_permission(
      tenant_id, hr_group_id, 'self:employee:read'
    ))
  )
  or (select internal_security.can_manage_employee(employee_id, 'employee:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-chart:read'))
  or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'organization-placement:read'))
);

drop policy if exists custom_field_definitions_read_group_scoped on public.custom_field_definitions;
create policy custom_field_definitions_read_group_scoped
on public.custom_field_definitions for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write'))
    or (
      (select internal_security.current_employee_id(tenant_id, hr_group_id)) is not null
      and (select internal_security.current_employee_has_permission(
        tenant_id, hr_group_id, 'self:custom-field-values:read'
      ))
    )
  )
);

drop policy if exists custom_field_select_options_read_group_scoped on public.custom_field_select_options;
create policy custom_field_select_options_read_group_scoped
on public.custom_field_select_options for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'custom-fields:write'))
    or (
      (select internal_security.current_employee_id(tenant_id, hr_group_id)) is not null
      and (select internal_security.current_employee_has_permission(
        tenant_id, hr_group_id, 'self:custom-field-values:read'
      ))
    )
  )
);

revoke all on function internal_security.current_employee_is_preboarding(uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.current_employee_is_preboarding(uuid, uuid) to authenticated;

-- Keep accepted administration access compatible with the later mandatory
-- user_access HR-group boundary. This is derived from the existing
-- administration, never supplied by the browser.
create or replace function public.accept_user_invitation(
  invitation_token text,
  accepted_user_id uuid,
  accepted_email text
)
returns table (tenant_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  verified_email text;
  invitation_hr_group_id uuid;
begin
  if accepted_user_id is null or nullif(btrim(accepted_email), '') is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select lower(auth_user.email)
  into verified_email
  from auth.users auth_user
  where auth_user.id = accepted_user_id
    and auth_user.email_confirmed_at is not null;

  if verified_email is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED';
  end if;
  if verified_email <> lower(btrim(accepted_email)) then
    raise exception 'VERIFIED_EMAIL_MISMATCH';
  end if;

  select invitation_row.*
  into invitation
  from public.user_invitations invitation_row
  where invitation_row.token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
  for update;

  if not found or invitation.status <> 'PENDING' then
    raise exception 'INVITATION_INVALID';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;
  if invitation.email <> verified_email then
    raise exception 'INVITATION_EMAIL_MISMATCH';
  end if;

  if invitation.employee_id is not null then
    if exists (
      select 1
      from public.employees employee
      where employee.id = invitation.employee_id
        and employee.tenant_id = invitation.tenant_id
        and employee.auth_user_id is not null
        and employee.auth_user_id <> accepted_user_id
    ) then
      raise exception 'EMPLOYEE_ALREADY_LINKED';
    end if;

    update public.employees employee
    set auth_user_id = accepted_user_id
    where employee.id = invitation.employee_id
      and employee.tenant_id = invitation.tenant_id
      and (employee.auth_user_id is null or employee.auth_user_id = accepted_user_id);
    if not found then
      raise exception 'INVITATION_EMPLOYEE_INVALID';
    end if;
  end if;

  if invitation.scope_type = 'ADMINISTRATION' then
    select administration.hr_group_id
    into invitation_hr_group_id
    from public.administrations administration
    where administration.tenant_id = invitation.tenant_id
      and administration.id = invitation.administration_id
      and administration.is_active;
    if invitation_hr_group_id is null then
      raise exception 'INVITATION_ADMINISTRATION_INVALID';
    end if;
  end if;

  insert into public.user_access (
    user_id,
    tenant_id,
    management_role_id,
    scope_type,
    administration_id,
    hr_group_id
  )
  values (
    accepted_user_id,
    invitation.tenant_id,
    invitation.management_role_id,
    invitation.scope_type,
    invitation.administration_id,
    invitation_hr_group_id
  )
  on conflict do nothing;

  update public.user_invitations invitation_row
  set status = 'ACCEPTED',
      accepted_by_user_id = accepted_user_id,
      accepted_at = timezone('utc', now())
  where invitation_row.id = invitation.id;

  return query select invitation.tenant_id, invitation.employee_id;
end;
$$;

revoke all on function internal_security.current_employee_has_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function internal_security.current_employee_has_permission(uuid, uuid, text) to authenticated;
revoke all on function internal_security.current_employee_has_permission(text) from public, anon, authenticated;
grant execute on function internal_security.current_employee_has_permission(text) to authenticated;
revoke all on function internal_security.current_user_has_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function internal_security.current_user_has_permission(uuid, uuid, text) to authenticated;
revoke all on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function internal_security.current_user_has_hr_group_permission(uuid, uuid, text) to authenticated;
revoke all on function internal_security.can_manage_employee(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text) to authenticated;
revoke all on function public.accept_user_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_user_invitation(text, uuid, text) to service_role;

commit;
