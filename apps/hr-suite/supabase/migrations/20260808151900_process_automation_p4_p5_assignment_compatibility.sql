-- P4 assignment compatibility: PostgreSQL has no min(uuid) aggregate.
-- Preserve explicit ambiguity handling and deterministic context resolution.

create or replace function internal_security.process_subject_context(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject_employee_id uuid;
  subject_employment_id uuid;
  subject_department_id uuid;
  effective_date date;
  department_count integer;
begin
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = requested_tenant_id
    and subject.hr_group_id = requested_hr_group_id
    and subject.process_instance_id = requested_process_instance_id;
  select subject.employment_id into subject_employment_id
  from public.process_employment_subjects subject
  where subject.tenant_id = requested_tenant_id
    and subject.hr_group_id = requested_hr_group_id
    and subject.process_instance_id = requested_process_instance_id;
  select instance.business_effective_date into effective_date
  from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id;
  if subject_employee_id is not null then
    select count(*), (array_agg(organization.department_id order by organization.department_id::text))[1]
      into department_count, subject_department_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.hr_group_id = requested_hr_group_id
      and organization.employee_id = subject_employee_id
      and organization.effective_from <= coalesce(effective_date, current_date)
      and (organization.effective_to is null or organization.effective_to >= coalesce(effective_date, current_date));
    if department_count > 1 then raise exception 'AMBIGUOUS_SUBJECT_DEPARTMENT' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object(
    'employeeId', subject_employee_id,
    'employmentId', subject_employment_id,
    'departmentId', subject_department_id,
    'effectiveDate', effective_date
  );
end;
$$;

revoke all on function internal_security.process_subject_context(uuid, uuid, uuid) from public, anon, authenticated;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(function_row.oid)
    into function_definition
  from pg_proc function_row
  join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
  where function_schema.nspname = 'internal_security'
    and function_row.proname = 'resolve_process_assignment'
  limit 1;
  if function_definition is null then raise exception 'P4_ASSIGNMENT_FUNCTION_MISSING'; end if;
  function_definition := replace(
    function_definition,
    'min(organization.direct_manager_id)',
    '(array_agg(organization.direct_manager_id order by organization.direct_manager_id::text))[1]'
  );
  function_definition := replace(
    function_definition,
    'min(organization.department_id)',
    '(array_agg(organization.department_id order by organization.department_id::text))[1]'
  );
  execute function_definition;
end;
$$;
