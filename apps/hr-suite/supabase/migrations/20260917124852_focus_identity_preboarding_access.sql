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
create or replace function internal_security.current_employee_is_preboarding()
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
      and (
        not internal_security.current_employee_is_preboarding()
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
      not internal_security.current_employee_is_preboarding()
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
    and not internal_security.current_employee_is_preboarding()
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
  select (
    (
      internal_security.current_employee_is_preboarding()
      and target_employee_id = internal_security.current_employee_id()
      and requested_permission_code in ('bank-account:read', 'bank-account:write')
      and internal_security.current_employee_has_permission('self:' || requested_permission_code)
    )
    or (
      not internal_security.current_employee_is_preboarding()
      and (
      exists (
        select 1
        from public.employee_organizations organization
        where organization.employee_id = target_employee_id
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
  );
$$;

revoke all on function internal_security.current_employee_is_preboarding() from public, anon, authenticated;
grant execute on function internal_security.current_employee_is_preboarding() to authenticated;

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
