-- Beperk Salary Insights tot de bestaande HR-admin- of managerscope.
-- can_manage_employee() is breder ontworpen voor algemene RLS en geeft bij een
-- permission op de HR-groep ook tenantbrede toegang. Salary Insights mag die
-- eerste tak niet gebruiken voor managers.
create or replace function internal_security.can_view_salary_insights_employee(
  target_employee_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive actor_employees as (
    select employee.id as employee_id
    from public.user_hr_group_access access
    join public.hr_groups group_row
      on group_row.tenant_id = access.tenant_id
     and group_row.id = access.hr_group_id
     and group_row.is_active
    join public.employees employee
      on employee.auth_user_id = access.user_id
     and employee.tenant_id = access.tenant_id
     and employee.hr_group_id = access.hr_group_id
     and employee.deleted_at is null
    where access.user_id = (select auth.uid())
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active
  ),
  target_placements as (
    select organization.tenant_id,
           organization.hr_group_id,
           organization.department_id,
           organization.direct_manager_id
    from public.employee_organizations organization
    where organization.employee_id = target_employee_id
      and organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
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
  )
  select exists (
    select 1
    from public.user_hr_group_access access
    join public.management_roles role
      on role.id = access.management_role_id
     and role.code in ('TENANT_ADMIN', 'HR_ADMIN')
     and role.is_active
     and role.deleted_at is null
     and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
    join public.hr_groups group_row
      on group_row.tenant_id = access.tenant_id
     and group_row.id = access.hr_group_id
     and group_row.is_active
    where access.user_id = (select auth.uid())
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_hr_group_id
      and access.is_active
  )
  or exists (
    select 1
    from target_placements placement
    join actor_employees actor
      on actor.employee_id = placement.direct_manager_id
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
  )
  or exists (
    select 1
    from public.department_management assignment
    join actor_employees actor
      on actor.employee_id = assignment.employee_id
    join public.role_permissions role_permission
      on role_permission.management_role_id = assignment.management_role_id
    join public.permissions permission
      on permission.id = role_permission.permission_id
     and permission.code = 'salary:read'
    join target_department_tree tree
      on tree.department_id = assignment.department_id
     and tree.tenant_id = assignment.tenant_id
     and tree.hr_group_id = assignment.hr_group_id
    where assignment.tenant_id = requested_tenant_id
      and assignment.hr_group_id = requested_hr_group_id
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
  );
$$;

revoke all on function internal_security.can_view_salary_insights_employee(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.get_salary_insights_projection(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_as_of date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.hr_group_id = requested_hr_group_id
      and employee.deleted_at is null
      and internal_security.can_view_salary_insights_employee(employee.id, requested_tenant_id, requested_hr_group_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'employeeId', employee.id,
        'employeeNumber', employee.employee_number,
        'employeeName', concat_ws(' ', employee.first_name, employee.birth_name_prefix, employee.birth_name),
        'employmentId', employment.id,
        'employmentNumber', employment.employment_number,
        'administrationId', employment.administration_id,
        'administrationName', administration.name,
        'administrationNumber', administration.administration_number,
        'departmentId', placement.department_id,
        'departmentName', department.name,
        'managerId', placement.direct_manager_id,
        'managerName', concat_ws(' ', manager.first_name, manager.birth_name_prefix, manager.birth_name),
        'functionName', placement.job_title,
        'functionGroupId', job.job_group_id,
        'functionGroupName', job_group.name,
        'seniorityId', job.seniority_id,
        'seniorityName', seniority.name,
        'locationId', placement.location_id,
        'locationName', location.name,
        'laborConditionSetId', contract.labor_condition_set_id,
        'laborConditionSetName', labor_condition.name,
        'employmentType', employment.employment_type,
        'fte', schedule.part_time_factor,
        'fulltimeSalary', case
          when salary.salary_route = 'SCALE_WITH_STEPS' and resolved_step.fulltime_amount is not null then resolved_step.fulltime_amount
          else salary.fulltime_amount
        end,
        'actualSalary', salary.parttime_amount,
        'salaryRoute', salary.salary_route,
        'salaryStructureId', salary.salary_structure_id,
        'salaryStructureName', structure.name,
        'salaryStructureCode', structure.code,
        'salaryStructureActive', structure.is_active,
        'revisionId', revision.id,
        'revisionEffectiveFrom', revision.effective_from,
        'revisionNumber', revision.revision_number,
        'salaryBandId', salary.salary_band_id,
        'salaryBandCode', coalesce(band_value.code, band.identity_key),
        'salaryBandName', coalesce(band_value.name, band.identity_key),
        'bandMinimum', band_value.minimum_amount,
        'bandMidpoint', band_value.midpoint_amount,
        'bandMaximum', band_value.maximum_amount,
        'salaryScaleId', salary.salary_scale_id,
        'salaryScaleCode', coalesce(scale_value.code, scale.code),
        'salaryScaleName', coalesce(scale_value.name, scale.name),
        'salaryStepCode', coalesce(resolved_step.step_code, salary.salary_step_code),
        'salaryStepName', resolved_step.step_name,
        'hasPublishedRevision', revision.id is not null,
        'hasResolvedBand', band_value.id is not null,
        'hasResolvedScaleStep', resolved_step.id is not null,
        'structureDisabled', structure.id is not null and not structure.is_active
      )
      order by employee.first_name, employee.birth_name, employee.id
    ),
    '[]'::jsonb
  )
  into result
  from public.employments employment
  join public.employees employee
    on employee.tenant_id = employment.tenant_id
   and employee.hr_group_id = employment.hr_group_id
   and employee.id = employment.employee_id
   and employee.deleted_at is null
  join public.administrations administration
    on administration.tenant_id = employment.tenant_id
   and administration.hr_group_id = employment.hr_group_id
   and administration.id = employment.administration_id
  left join lateral (
    select salary.*
    from public.employment_salaries salary
    where salary.tenant_id = employment.tenant_id
      and salary.hr_group_id = employment.hr_group_id
      and salary.employment_id = employment.id
      and salary.valid_from <= requested_as_of
      and (salary.valid_until is null or salary.valid_until > requested_as_of)
    order by salary.valid_from desc, salary.id desc
    limit 1
  ) salary on true
  left join lateral (
    select organization.*
    from public.employee_organizations organization
    where organization.tenant_id = employment.tenant_id
      and organization.hr_group_id = employment.hr_group_id
      and organization.employee_id = employment.employee_id
      and (organization.employment_id = employment.id or organization.employment_id is null)
      and organization.effective_from <= requested_as_of
      and (organization.effective_to is null or organization.effective_to >= requested_as_of)
    order by (organization.employment_id = employment.id) desc, organization.effective_from desc, organization.id desc
    limit 1
  ) placement on true
  left join public.departments department
    on department.tenant_id = employment.tenant_id
   and department.hr_group_id = employment.hr_group_id
   and department.id = placement.department_id
  left join public.employees manager
    on manager.tenant_id = employment.tenant_id
   and manager.hr_group_id = employment.hr_group_id
   and manager.id = placement.direct_manager_id
   and manager.deleted_at is null
  left join public.jobs job
    on job.tenant_id = employment.tenant_id
   and job.hr_group_id = employment.hr_group_id
   and job.id = placement.job_id
  left join public.job_groups job_group
    on job_group.tenant_id = employment.tenant_id
   and job_group.hr_group_id = employment.hr_group_id
   and job_group.id = job.job_group_id
  left join public.talent_seniorities seniority
    on seniority.tenant_id = employment.tenant_id
   and seniority.id = job.seniority_id
  left join public.administration_locations location
    on location.tenant_id = employment.tenant_id
   and location.hr_group_id = employment.hr_group_id
   and location.id = placement.location_id
  left join lateral (
    select schedule.*
    from public.employment_schedules schedule
    where schedule.tenant_id = employment.tenant_id
      and schedule.administration_id = employment.administration_id
      and schedule.employee_id = employment.employee_id
      and schedule.employment_id = employment.id
      and schedule.valid_from <= requested_as_of
      and (schedule.valid_until is null or schedule.valid_until > requested_as_of)
    order by schedule.valid_from desc, schedule.id desc
    limit 1
  ) schedule on true
  left join lateral (
    select employment_contract.*
    from public.employment_contracts employment_contract
    where employment_contract.tenant_id = employment.tenant_id
      and employment_contract.hr_group_id = employment.hr_group_id
      and employment_contract.employment_id = employment.id
      and employment_contract.starts_on <= requested_as_of
      and (employment_contract.ends_on is null or employment_contract.ends_on >= requested_as_of)
    order by employment_contract.starts_on desc, employment_contract.sequence_number desc, employment_contract.id desc
    limit 1
  ) contract on true
  left join public.labor_condition_sets labor_condition
    on labor_condition.tenant_id = employment.tenant_id
   and labor_condition.hr_group_id = employment.hr_group_id
   and labor_condition.id = contract.labor_condition_set_id
  left join public.salary_structures structure
    on structure.tenant_id = employment.tenant_id
   and structure.hr_group_id = employment.hr_group_id
   and structure.id = salary.salary_structure_id
  left join public.salary_bands band
    on band.tenant_id = employment.tenant_id
   and band.hr_group_id = employment.hr_group_id
   and band.id = salary.salary_band_id
  left join public.salary_scales scale
    on scale.tenant_id = employment.tenant_id
   and scale.hr_group_id = employment.hr_group_id
   and scale.id = salary.salary_scale_id
  left join lateral (
    select revision.*
    from public.salary_structure_revisions revision
    where revision.tenant_id = employment.tenant_id
      and revision.hr_group_id = employment.hr_group_id
      and revision.salary_structure_id = salary.salary_structure_id
      and revision.status = 'PUBLISHED'
      and revision.effective_from <= requested_as_of
    order by revision.effective_from desc, revision.revision_number desc, revision.id desc
    limit 1
  ) revision on true
  left join lateral (
    select value.*
    from public.salary_band_values value
    where value.tenant_id = employment.tenant_id
      and value.hr_group_id = employment.hr_group_id
      and value.salary_structure_revision_id = revision.id
      and value.salary_band_id = salary.salary_band_id
    limit 1
  ) band_value on true
  left join lateral (
    select value.*
    from public.salary_scale_revision_values value
    where value.tenant_id = employment.tenant_id
      and value.hr_group_id = employment.hr_group_id
      and value.salary_structure_revision_id = revision.id
      and value.salary_scale_id = salary.salary_scale_id
    limit 1
  ) scale_value on true
  left join lateral (
    select step.*
    from public.salary_scale_steps step
    where step.tenant_id = employment.tenant_id
      and step.hr_group_id = employment.hr_group_id
      and step.salary_structure_revision_id = revision.id
      and step.salary_scale_id = salary.salary_scale_id
      and (
        upper(step.step_code) = upper(coalesce(salary.salary_step_code, ''))
        or step.id = salary.salary_scale_step_id
      )
    order by (step.id = salary.salary_scale_step_id) desc, step.sequence_number
    limit 1
  ) resolved_step on true
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
    and employment.starts_on <= requested_as_of
    and (employment.ends_on is null or employment.ends_on >= requested_as_of)
    and internal_security.can_view_salary_insights_employee(employment.employee_id, requested_tenant_id, requested_hr_group_id);

  return result;
end;
$$;

revoke all on function public.get_salary_insights_projection(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.get_salary_insights_projection(uuid, uuid, date) to authenticated;
