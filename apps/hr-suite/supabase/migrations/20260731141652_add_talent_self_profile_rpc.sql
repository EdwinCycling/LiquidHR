create or replace function public.get_my_talent_profile(requested_tenant_id uuid)
returns table (
  tenant_id uuid,
  job_profile_id uuid,
  job_id uuid,
  job_code text,
  job_is_active boolean,
  job_group_id uuid,
  job_group_code text,
  job_group_name text,
  job_family_id uuid,
  job_family_code text,
  job_family_name text,
  seniority_id uuid,
  seniority_code text,
  seniority_name text,
  profile_version_id uuid,
  version_number integer,
  status text,
  valid_from date,
  valid_until date,
  purpose text,
  summary text,
  organizational_context text,
  tasks jsonb,
  responsibilities jsonb,
  result_areas jsonb
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    job_profile.tenant_id,
    job_profile.id,
    job.id,
    job.code,
    job.is_active,
    job_group.id,
    job_group.code,
    job_group.name,
    job_family.id,
    job_family.code,
    job_family.name,
    seniority.id,
    seniority.code,
    seniority.name,
    profile_version.id,
    profile_version.version_number,
    profile_version.status,
    profile_version.valid_from,
    profile_version.valid_until,
    profile_version.purpose,
    profile_version.summary,
    profile_version.organizational_context,
    profile_version.tasks,
    profile_version.responsibilities,
    profile_version.result_areas
  from public.employees employee
  join public.employments employment
    on employment.tenant_id = employee.tenant_id
   and employment.employee_id = employee.id
   and employment.is_primary
   and employment.deleted_at is null
  join public.employee_organizations organization
    on organization.tenant_id = employment.tenant_id
   and organization.employee_id = employment.employee_id
   and organization.employment_id = employment.id
   and organization.effective_to is null
  join public.jobs job
    on job.tenant_id = organization.tenant_id
   and job.id = organization.job_id
  join public.job_groups job_group
    on job_group.tenant_id = job.tenant_id
   and job_group.id = job.job_group_id
  left join public.job_families job_family
    on job_family.tenant_id = job_group.tenant_id
   and job_family.id = job_group.job_family_id
  left join public.talent_seniorities seniority
    on seniority.tenant_id = job.tenant_id
   and seniority.id = job.seniority_id
  left join public.job_profiles job_profile
    on job_profile.tenant_id = job.tenant_id
   and job_profile.job_id = job.id
  left join public.job_profile_versions profile_version
    on profile_version.tenant_id = job_profile.tenant_id
   and profile_version.job_profile_id = job_profile.id
   and profile_version.status = 'ACTIVE'
  where employee.auth_user_id = auth.uid()
    and employee.tenant_id = requested_tenant_id
    and employee.deleted_at is null
    and internal_security.current_user_has_permission(requested_tenant_id, null, 'self:talent:read');
$$;

revoke all on function public.get_my_talent_profile(uuid) from public, anon;
grant execute on function public.get_my_talent_profile(uuid) to authenticated;
