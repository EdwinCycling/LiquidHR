-- Een managementrelatie geeft alleen toegang als de actor ook expliciet toegang
-- heeft tot de administratie waarin de doelmedewerker op dat moment is geplaatst.
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
    where internal_security.has_administration_access(
      placement.tenant_id,
      placement.administration_id
    )
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
      and internal_security.has_administration_access(
        tree.tenant_id,
        tree.administration_id
      )
  );
$$;

revoke all on function internal_security.can_manage_employee(uuid, text)
from public, anon, authenticated;
grant execute on function internal_security.can_manage_employee(uuid, text)
to authenticated;
