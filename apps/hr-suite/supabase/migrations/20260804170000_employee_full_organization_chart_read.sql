-- Employees may read the complete non-sensitive organization chart.
-- The chart route still scopes every query to the active administration.

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code = 'organization-chart:read'
where role.code = 'EMPLOYEE'
  and role.tenant_id is null
  and role.deleted_at is null
on conflict do nothing;

drop policy if exists employees_select_scoped on public.employees;
create policy employees_select_scoped
on public.employees for select to authenticated
using (
  (
    id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or internal_security.can_manage_employee(id, 'employee:read')
  or (select internal_security.current_user_has_permission(tenant_id, null, 'organization-chart:read'))
);

drop policy if exists employee_organizations_select_scoped on public.employee_organizations;
create policy employee_organizations_select_scoped
on public.employee_organizations for select to authenticated
using (
  (
    employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_employee_has_permission('self:employee:read'))
  )
  or internal_security.can_manage_employee(employee_id, 'employee:read')
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-chart:read'))
);

drop policy if exists departments_select_scoped on public.departments;
drop policy if exists departments_select_tenant on public.departments;
create policy departments_select_tenant
on public.departments for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'department:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'organization-chart:read'))
);

drop policy if exists department_management_select_scoped on public.department_management;
create policy department_management_select_scoped
on public.department_management for select to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'department:read'))
    or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-chart:read'))
  )
);

drop policy if exists custom_field_definitions_read_scoped on public.custom_field_definitions;
create policy custom_field_definitions_read_scoped
on public.custom_field_definitions for select to authenticated
using (
  (select internal_security.has_administration_access(tenant_id, administration_id))
  and (
    (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-field-values:read'))
    or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'custom-fields:write'))
    or (
      (select internal_security.current_employee_has_permission('self:custom-field-values:read'))
      and exists (
        select 1
        from public.employee_administration_assignments assignment
        where assignment.tenant_id = custom_field_definitions.tenant_id
          and assignment.administration_id = custom_field_definitions.administration_id
          and assignment.employee_id = (select internal_security.current_employee_id())
      )
    )
    or (
      show_in_organization_chart_filter
      and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-chart:read'))
    )
  )
);

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
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_field_definitions definition
    where definition.id = requested_definition_id
      and definition.tenant_id = requested_tenant_id
      and definition.administration_id = requested_administration_id
      and definition.is_active
      and definition.deleted_at is null
      and internal_security.employee_is_in_administration(
        requested_tenant_id, requested_administration_id, requested_employee_id
      )
      and (
        (
          requested_employee_id = internal_security.current_employee_id()
          and definition.employee_self_access <> 'HIDDEN'
          and internal_security.current_employee_has_permission('self:custom-field-values:read')
        )
        or (
          definition.hr_access <> 'HIDDEN'
          and internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'employee:write')
          and internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'custom-field-values:read')
        )
        or (
          definition.manager_access <> 'HIDDEN'
          and internal_security.can_manage_employee(requested_employee_id, 'employee:read')
          and internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'custom-field-values:read')
        )
        or (
          definition.show_in_organization_chart_filter
          and internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, 'organization-chart:read')
        )
      )
  );
$$;

drop policy if exists jobs_read_tenant on public.jobs;
create policy jobs_read_tenant
on public.jobs for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1 from public.employee_organizations organization
      where organization.tenant_id = jobs.tenant_id
        and organization.job_id = jobs.id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
  or (select internal_security.current_user_has_permission(tenant_id, null, 'organization-chart:read'))
);

drop policy if exists job_groups_read_tenant on public.job_groups;
create policy job_groups_read_tenant
on public.job_groups for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1
      from public.jobs job
      join public.employee_organizations organization
        on organization.tenant_id = job.tenant_id and organization.job_id = job.id
      where job.tenant_id = job_groups.tenant_id
        and job.job_group_id = job_groups.id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
  or (select internal_security.current_user_has_permission(tenant_id, null, 'organization-chart:read'))
);

drop policy if exists job_revisions_read_tenant on public.job_revisions;
create policy job_revisions_read_tenant
on public.job_revisions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1
      from public.employee_organizations organization
      where organization.tenant_id = job_revisions.tenant_id
        and organization.job_id = job_revisions.job_id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
  or (select internal_security.current_user_has_permission(tenant_id, null, 'organization-chart:read'))
);
