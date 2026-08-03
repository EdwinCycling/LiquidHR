-- The company-data slice already added employee_organizations.location_id.
-- This migration exposes that field as its own employment detail timeline.

drop policy if exists administration_company_data_read on public.administration_company_data;
create policy administration_company_data_read
on public.administration_company_data
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-placement:read'))
);

drop policy if exists administration_locations_read on public.administration_locations;
create policy administration_locations_read
on public.administration_locations
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-placement:read'))
);

create or replace function internal_security.guard_employee_organization_location()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  company_row public.administration_company_data%rowtype;
begin
  if new.location_id is null then
    return new;
  end if;

  select company.* into company_row
  from public.administration_company_data company
  where company.tenant_id = new.tenant_id
    and company.administration_id = new.administration_id;

  if company_row.id is null then
    raise exception 'COMPANY_DATA_NOT_FOUND' using errcode = 'P0002';
  end if;
  if company_row.single_location then
    raise exception 'SINGLE_LOCATION_MODE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.administration_locations location
    where location.id = new.location_id
      and location.tenant_id = new.tenant_id
      and location.administration_id = new.administration_id
      and location.is_active
  ) then
    raise exception 'LOCATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_employee_organization_location on public.employee_organizations;
create trigger guard_employee_organization_location
before insert or update of tenant_id, administration_id, location_id
on public.employee_organizations
for each row execute function internal_security.guard_employee_organization_location();

create or replace function public.manage_employment_company_location(
  requested_employment_id uuid,
  requested_placement_id uuid,
  requested_effective_on date,
  requested_location_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  company_row public.administration_company_data%rowtype;
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

  select company.* into company_row
  from public.administration_company_data company
  where company.tenant_id = employment_row.tenant_id
    and company.administration_id = employment_row.administration_id;
  if company_row.id is null then raise exception 'COMPANY_DATA_NOT_FOUND'; end if;
  if company_row.single_location then raise exception 'SINGLE_LOCATION_MODE'; end if;
  if not exists (
    select 1
    from public.administration_locations location
    where location.id = requested_location_id
      and location.tenant_id = employment_row.tenant_id
      and location.administration_id = employment_row.administration_id
      and location.is_active
  ) then raise exception 'LOCATION_NOT_FOUND'; end if;

  if requested_placement_id is not null then
    update public.employee_organizations
    set location_id = requested_location_id
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
     ) then raise exception 'LOCATION_EFFECTIVE_DATE_INVALID'; end if;

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
  if placement_row.id is null then raise exception 'LOCATION_CHAIN_GAP'; end if;

  update public.employee_organizations
  set effective_to = requested_effective_on - 1
  where id = placement_row.id;

  insert into public.employee_organizations (
    tenant_id, administration_id, employee_id, employment_id,
    department_id, job_id, job_title, direct_manager_id,
    direct_manager_deputy_id, cost_bearer, location_id,
    effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id,
    placement_row.department_id, placement_row.job_id, placement_row.job_title,
    placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    placement_row.cost_bearer, requested_location_id,
    requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function internal_security.guard_employee_organization_location() from public, anon, authenticated;
revoke all on function public.manage_employment_company_location(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.manage_employment_company_location(uuid, uuid, date, uuid) to authenticated;

create or replace function public.manage_employment_organization_timeline(
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
      and department.is_active
  ) then raise exception 'DEPARTMENT_NOT_FOUND'; end if;

  select revision.name into job_name
  from public.jobs job
  join public.job_revisions revision on revision.job_id = job.id and revision.tenant_id = job.tenant_id
  where job.id = requested_job_id
    and job.tenant_id = employment_row.tenant_id
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
    direct_manager_deputy_id, cost_bearer, location_id,
    effective_from, effective_to
  ) values (
    employment_row.tenant_id, employment_row.administration_id,
    employment_row.employee_id, employment_row.id,
    requested_department_id, requested_job_id, job_name,
    placement_row.direct_manager_id, placement_row.direct_manager_deputy_id,
    placement_row.cost_bearer, placement_row.location_id,
    requested_effective_on, placement_row.effective_to
  ) returning id into resulting_id;

  return resulting_id;
end;
$$;

revoke all on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) from public, anon;
grant execute on function public.manage_employment_organization_timeline(uuid, uuid, date, uuid, uuid) to authenticated;
