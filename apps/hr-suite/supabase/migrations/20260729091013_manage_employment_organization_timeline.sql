create function public.manage_employment_organization_timeline(
  requested_employment_id uuid,
  requested_placement_id uuid,
  requested_effective_on date,
  requested_department_id uuid,
  requested_job_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  job_name text;
  resulting_id uuid;
begin
  select employment.* into employment_row
  from public.employments employment
  where employment.id = requested_employment_id
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then raise exception 'EMPLOYMENT_NOT_FOUND'; end if;
  if not internal_security.current_user_has_permission(
    employment_row.tenant_id, employment_row.administration_id,
    'organization-placement:write'
  ) then raise exception 'FORBIDDEN'; end if;

  if not exists (
    select 1 from public.departments department
    where department.id = requested_department_id
      and department.tenant_id = employment_row.tenant_id
      and department.administration_id = employment_row.administration_id
      and department.is_active
  ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;

  select revision.name into job_name
  from public.jobs job
  join public.job_revisions revision on revision.job_id = job.id
  where job.id = requested_job_id
    and job.tenant_id = employment_row.tenant_id
    and job.administration_id = employment_row.administration_id
    and job.is_active
    and revision.valid_from <= requested_effective_on
    and (revision.valid_until is null or revision.valid_until > requested_effective_on)
  order by revision.valid_from desc
  limit 1;
  if job_name is null then raise exception 'JOB_NOT_FOUND'; end if;

  if requested_placement_id is not null then
    update public.employee_organizations
    set department_id = requested_department_id,
        job_id = requested_job_id,
        job_title = job_name
    where id = requested_placement_id
      and employment_id = requested_employment_id
    returning id into resulting_id;
    if resulting_id is null then raise exception 'PLACEMENT_NOT_FOUND'; end if;
    return resulting_id;
  end if;

  if requested_effective_on <= employment_row.starts_on
     or (
       employment_row.ends_on is not null
       and requested_effective_on > employment_row.ends_on
     ) then raise exception 'PLACEMENT_EFFECTIVE_DATE_INVALID'; end if;

  select placement.* into placement_row
  from public.employee_organizations placement
  where placement.employment_id = requested_employment_id
    and placement.effective_from < requested_effective_on
    and (
      placement.effective_to is null
      or placement.effective_to >= requested_effective_on
    )
  order by placement.effective_from desc
  limit 1
  for update;
  if placement_row.id is null then raise exception 'PLACEMENT_CHAIN_GAP'; end if;

  update public.employee_organizations
  set effective_to = requested_effective_on - 1
  where id = placement_row.id;

  insert into public.employee_organizations (
    tenant_id, administration_id, employee_id, employment_id,
    department_id, job_id, job_title, direct_manager_id,
    direct_manager_deputy_id, effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id,
    requested_department_id, requested_job_id, job_name,
    placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function public.manage_employment_organization_timeline(
  uuid, uuid, date, uuid, uuid
) from public, anon;
grant execute on function public.manage_employment_organization_timeline(
  uuid, uuid, date, uuid, uuid
) to authenticated;
