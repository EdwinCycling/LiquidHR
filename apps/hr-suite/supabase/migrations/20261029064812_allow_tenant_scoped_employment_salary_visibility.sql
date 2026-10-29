create or replace function internal_security.can_view_employment_salary(
  target_employee_id uuid,
  target_administration_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive target_placements as (
    select organization.tenant_id,
           organization.hr_group_id,
           organization.administration_id,
           organization.department_id,
           organization.direct_manager_id
    from public.employee_organizations organization
    where organization.employee_id = target_employee_id
      and organization.administration_id = target_administration_id
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
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from target_placements placement
        join public.administrations administration
          on administration.id = placement.administration_id
         and administration.tenant_id = placement.tenant_id
         and administration.hr_group_id = placement.hr_group_id
         and administration.is_active
        join public.user_access access
          on access.tenant_id = placement.tenant_id
         and access.user_id = (select auth.uid())
         and access.is_active
        join public.management_roles role
          on role.id = access.management_role_id
         and role.code in ('HR_ADMIN', 'TENANT_ADMIN')
         and (role.tenant_id is null or role.tenant_id = placement.tenant_id)
         and role.is_active
         and role.deleted_at is null
        join public.role_permissions role_permission
          on role_permission.management_role_id = role.id
        join public.permissions permission
          on permission.id = role_permission.permission_id
         and permission.code = 'salary:read'
        where (
          access.scope_type = 'TENANT'
          and access.hr_group_id is null
          and internal_security.has_hr_group_access(placement.tenant_id, placement.hr_group_id)
        )
        or (
          access.scope_type = 'ADMINISTRATION'
          and access.hr_group_id = placement.hr_group_id
          and access.administration_id = placement.administration_id
        )
      )
      or exists (
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
         and permission.code = 'salary:read'
        where internal_security.has_hr_group_access(placement.tenant_id, placement.hr_group_id)
          and internal_security.has_administration_access(placement.tenant_id, placement.administration_id)
      )
      or exists (
        select 1
        from target_placements placement
        join target_department_tree tree
          on tree.tenant_id = placement.tenant_id
         and tree.hr_group_id = placement.hr_group_id
        join public.department_management assignment
          on assignment.department_id = tree.department_id
         and assignment.tenant_id = tree.tenant_id
         and assignment.hr_group_id = tree.hr_group_id
        join actors actor
          on actor.id = assignment.employee_id
         and actor.tenant_id = assignment.tenant_id
         and actor.hr_group_id = assignment.hr_group_id
        join public.role_permissions role_permission
          on role_permission.management_role_id = assignment.management_role_id
        join public.permissions permission
          on permission.id = role_permission.permission_id
         and permission.code = 'salary:read'
        where assignment.effective_from <= current_date
          and (assignment.effective_to is null or assignment.effective_to >= current_date)
          and internal_security.has_hr_group_access(placement.tenant_id, placement.hr_group_id)
          and internal_security.has_administration_access(placement.tenant_id, placement.administration_id)
      )
    );
$$;
