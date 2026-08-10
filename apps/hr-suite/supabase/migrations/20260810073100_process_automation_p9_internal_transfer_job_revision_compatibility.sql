-- P9: maak de interne-transfer-preview portable op PostgreSQL UUID-kolommen.
-- PostgreSQL levert geen min(uuid); de preview had daardoor live een 42883-fout.
-- Een actief job-record zonder revision blijft geldig; alleen de naam is dan niet beschikbaar.

create or replace function internal_security.internal_transfer_projection(requested_work_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  fields jsonb := '{}'::jsonb;
  target_department_id uuid;
  target_job_id uuid;
  effective_on date;
  target_department_code text;
  target_department_name text;
  target_job_code text;
  target_job_name text;
  current_department_code text;
  current_department_name text;
  current_job_code text;
  current_job_name text;
  current_manager_name text;
  target_manager_name text;
  target_manager_id uuid;
  target_manager_count integer := 0;
  blockers jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  status text;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.id = item_row.process_instance_id
    and instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'organization-placement:write'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select coalesce(response.current_values, '{}'::jsonb) || coalesce(response.new_values, '{}'::jsonb)
    into fields
  from public.process_form_responses response
  where response.tenant_id = instance_row.tenant_id
    and response.hr_group_id = instance_row.hr_group_id
    and response.process_instance_id = instance_row.id
  order by response.revision desc
  limit 1;

  begin
    if coalesce(fields ->> 'effective-on', '') ~ '^\\d{4}-\\d{2}-\\d{2}$' then
      effective_on := (fields ->> 'effective-on')::date;
    else
      effective_on := instance_row.business_effective_date;
    end if;
  exception when others then
    effective_on := null;
  end;
  target_department_id := case
    when coalesce(fields ->> 'target-department', fields -> 'target-department' ->> 'id') ~ '^[0-9a-fA-F-]{36}$'
    then coalesce(fields ->> 'target-department', fields -> 'target-department' ->> 'id')::uuid
    else null end;
  target_job_id := case
    when coalesce(fields ->> 'target-job', fields -> 'target-job' ->> 'id') ~ '^[0-9a-fA-F-]{36}$'
    then coalesce(fields ->> 'target-job', fields -> 'target-job' ->> 'id')::uuid
    else null end;

  select employment.* into employment_row
  from public.process_employment_subjects subject
  join public.employments employment
    on employment.tenant_id = subject.tenant_id
   and employment.hr_group_id = subject.hr_group_id
   and employment.id = subject.employment_id
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id
  limit 1;
  if employment_row.id is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','SUBJECT_EMPLOYMENT_NOT_FOUND')); end if;
  if effective_on is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','INVALID_BUSINESS_DATE')); end if;

  if employment_row.id is not null and effective_on is not null then
    select placement.* into placement_row
    from public.employee_organizations placement
    where placement.tenant_id = employment_row.tenant_id
      and placement.hr_group_id = employment_row.hr_group_id
      and placement.employment_id = employment_row.id
      and placement.effective_from <= effective_on
      and (placement.effective_to is null or placement.effective_to >= effective_on)
    order by placement.effective_from desc
    limit 1;
    if placement_row.id is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','PLACEMENT_CHAIN_GAP')); end if;
    if effective_on <= employment_row.starts_on or (employment_row.ends_on is not null and effective_on > employment_row.ends_on) then
      blockers := blockers || jsonb_build_array(jsonb_build_object('code','PLACEMENT_EFFECTIVE_DATE_INVALID'));
    end if;
  end if;

  if placement_row.id is not null then
    select department.code, department.name into current_department_code, current_department_name
    from public.departments department where department.id = placement_row.department_id;
    select job.code, revision.name into current_job_code, current_job_name
    from public.jobs job
    left join lateral (
      select value.name from public.job_revisions value
      where value.job_id = job.id and value.valid_from <= coalesce(effective_on, current_date)
        and (value.valid_until is null or value.valid_until > coalesce(effective_on, current_date))
      order by value.valid_from desc limit 1
    ) revision on true
    where job.id = placement_row.job_id;
    select employee.first_name || ' ' || employee.birth_name into current_manager_name
    from public.employees employee where employee.id = placement_row.direct_manager_id;
  end if;

  if target_department_id is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','TARGET_DEPARTMENT_REQUIRED'));
  else
    select department.code, department.name into target_department_code, target_department_name
    from public.departments department
    where department.id = target_department_id
      and department.tenant_id = instance_row.tenant_id
      and department.hr_group_id = instance_row.hr_group_id
      and department.is_active;
    if target_department_code is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','DEPARTMENT_NOT_FOUND')); end if;
    if placement_row.id is not null and target_department_id = placement_row.department_id then blockers := blockers || jsonb_build_array(jsonb_build_object('code','TARGET_DEPARTMENT_UNCHANGED')); end if;
  end if;

  if target_job_id is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','TARGET_JOB_REQUIRED'));
  else
    select job.code, revision.name into target_job_code, target_job_name
    from public.jobs job
    left join lateral (
      select value.name from public.job_revisions value
      where value.job_id = job.id and value.valid_from <= coalesce(effective_on, current_date)
        and (value.valid_until is null or value.valid_until > coalesce(effective_on, current_date))
      order by value.valid_from desc limit 1
    ) revision on true
    where job.id = target_job_id
      and job.tenant_id = instance_row.tenant_id
      and job.hr_group_id = instance_row.hr_group_id
      and job.is_active;
    if target_job_code is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','JOB_NOT_FOUND')); end if;
    if placement_row.id is not null and target_job_id = placement_row.job_id then warnings := warnings || jsonb_build_array(jsonb_build_object('code','SALARY_UNCHANGED')); end if;
  end if;

  if placement_row.direct_manager_id is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','NO_SOURCE_MANAGER'));
  end if;
  if target_department_id is not null then
    select count(*)::integer, (array_agg(management.employee_id order by management.employee_id::text))[1] into target_manager_count, target_manager_id
    from public.department_management management
    join public.management_roles role on role.id = management.management_role_id and role.code = 'DIRECT_MANAGER' and role.is_active
    join public.employees employee on employee.id = management.employee_id and employee.is_active and employee.is_archived = false and employee.deleted_at is null
    where management.tenant_id = instance_row.tenant_id
      and management.hr_group_id = instance_row.hr_group_id
      and management.department_id = target_department_id
      and management.effective_from <= coalesce(effective_on, current_date)
      and (management.effective_to is null or management.effective_to >= coalesce(effective_on, current_date));
    if target_manager_count = 0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','NO_ASSIGNEE')); end if;
    if target_manager_count > 1 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','AMBIGUOUS_ASSIGNEE','candidateCount',target_manager_count)); end if;
    select employee.first_name || ' ' || employee.birth_name into target_manager_name from public.employees employee where employee.id = target_manager_id;
  end if;

  status := case when jsonb_array_length(blockers) > 0 then 'BLOCKING' when jsonb_array_length(warnings) > 0 then 'WARNING' else 'SUCCESS' end;
  return jsonb_build_object(
    'adapterKey','INTERNAL_TRANSFER_ORGANIZATION',
    'processInstanceId',instance_row.id,
    'workItemId',item_row.id,
    'status',status,
    'writesPerformed',false,
    'effectiveOn',effective_on,
    'employee',jsonb_build_object('id',employment_row.employee_id,'employmentId',employment_row.id),
    'current',jsonb_build_object('placementId',placement_row.id,'departmentId',placement_row.department_id,'departmentCode',current_department_code,'departmentName',current_department_name,'jobId',placement_row.job_id,'jobCode',current_job_code,'jobName',current_job_name,'managerId',placement_row.direct_manager_id,'managerName',current_manager_name),
    'proposed',jsonb_build_object('departmentId',target_department_id,'departmentCode',target_department_code,'departmentName',target_department_name,'jobId',target_job_id,'jobCode',target_job_code,'jobName',target_job_name,'managerId',target_manager_id,'managerName',target_manager_name),
    'blockers',blockers,
    'warnings',warnings,
    'reason',coalesce(fields ->> 'reason','')
  );
end;
$$;
