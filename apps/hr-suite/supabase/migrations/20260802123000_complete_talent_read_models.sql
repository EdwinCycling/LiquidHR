begin;

-- Maak de drie lokale auth-fixtures bruikbaar voor de volledige Talent-slice.
-- De natuurlijke demo-sleutels blijven leidend; er worden geen gegenereerde ids vastgelegd.
with test_assignments(employee_number, job_code) as (
  values
    ('DEMO-028', 'TEST-MANAGER'),
    ('DEMO-032', 'TEST-PLANNER'),
    ('DEMO-035', 'TEST-CUSTOMER')
)
update public.employee_organizations organization
set job_id = job.id,
    job_title = case test_assignment.job_code
      when 'TEST-MANAGER' then 'Manager operations'
      when 'TEST-PLANNER' then 'Planner operations'
      when 'TEST-CUSTOMER' then 'Klantadviseur'
      else organization.job_title
    end,
    updated_at = timezone('utc', now())
from public.employees employee
join public.tenants tenant on tenant.id = employee.tenant_id
join test_assignments test_assignment on test_assignment.employee_number = employee.employee_number
join public.jobs job on job.tenant_id = employee.tenant_id and job.code = test_assignment.job_code
where tenant.name = 'Liquid HR Demo Holding'
  and organization.tenant_id = employee.tenant_id
  and organization.employee_id = employee.id
  and organization.employment_id in (
    select employment.id
    from public.employments employment
    where employment.tenant_id = employee.tenant_id
      and employment.employee_id = employee.id
      and employment.is_primary
      and employment.deleted_at is null
  )
  and organization.effective_from <= current_date
  and (organization.effective_to is null or organization.effective_to > current_date);

-- Een medewerker ziet alleen de actuele primaire functie en de actuele actieve profielversie.
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
set search_path = ''
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
   and employment.starts_on <= current_date
   and (employment.ends_on is null or employment.ends_on >= current_date)
  join public.employee_organizations organization
    on organization.tenant_id = employment.tenant_id
   and organization.employee_id = employment.employee_id
   and organization.employment_id = employment.id
   and organization.effective_from <= current_date
   and (organization.effective_to is null or organization.effective_to > current_date)
  join public.jobs job
    on job.tenant_id = organization.tenant_id
   and job.id = organization.job_id
   and job.is_active
  join public.job_groups job_group
    on job_group.tenant_id = job.tenant_id
   and job_group.id = job.job_group_id
   and job_group.is_active
  left join public.job_families job_family
    on job_family.tenant_id = job_group.tenant_id
   and job_family.id = job_group.job_family_id
  left join public.talent_seniorities seniority
    on seniority.tenant_id = job.tenant_id
   and seniority.id = job.seniority_id
  join public.job_profiles job_profile
    on job_profile.tenant_id = job.tenant_id
   and job_profile.job_id = job.id
  join public.job_profile_versions profile_version
    on profile_version.tenant_id = job_profile.tenant_id
   and profile_version.job_profile_id = job_profile.id
   and profile_version.status = 'ACTIVE'
   and profile_version.valid_from <= current_date
   and (profile_version.valid_until is null or profile_version.valid_until > current_date)
  where employee.auth_user_id = auth.uid()
    and employee.tenant_id = requested_tenant_id
    and employee.deleted_at is null
    and employee.is_active
    and internal_security.current_user_has_permission(requested_tenant_id, null, 'self:talent:read')
  order by organization.effective_from desc, profile_version.valid_from desc
  limit 1;
$$;

revoke all on function public.get_my_talent_profile(uuid) from public, anon;
grant execute on function public.get_my_talent_profile(uuid) to authenticated;

-- Vereisten worden alleen teruggegeven als de gevraagde versie de actuele functie
-- van de ingelogde medewerker is. De functie accepteert dus geen willekeurige
-- medewerker- of tenantdata als leesroute.
create or replace function public.get_my_talent_profile_requirements(
  requested_tenant_id uuid,
  requested_profile_version_id uuid
)
returns table (
  id uuid,
  profile_version_id uuid,
  capability_id uuid,
  requirement_type text,
  target_level_id uuid,
  language_level text,
  certificate_details jsonb,
  rationale text,
  sort_order integer,
  capability_code text,
  capability_name text,
  capability_type text,
  target_level_code text,
  target_level_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    requirement.id,
    requirement.profile_version_id,
    requirement.capability_id,
    requirement.requirement_type,
    requirement.target_level_id,
    requirement.language_level,
    requirement.certificate_details,
    requirement.rationale,
    requirement.sort_order,
    capability.code,
    capability.name,
    capability.capability_type,
    level.code,
    level.name
  from public.job_profile_capability_requirements requirement
  join public.talent_capabilities capability
    on capability.tenant_id = requirement.tenant_id
   and capability.id = requirement.capability_id
   and capability.status = 'ACTIVE'
  left join public.talent_levels level
    on level.tenant_id = requirement.tenant_id
   and level.id = requirement.target_level_id
  where requirement.tenant_id = requested_tenant_id
    and requirement.profile_version_id = requested_profile_version_id
    and internal_security.current_user_has_permission(requested_tenant_id, null, 'self:talent:read')
    and exists (
      select 1
      from public.employees employee
      join public.employments employment
        on employment.tenant_id = employee.tenant_id
       and employment.employee_id = employee.id
       and employment.is_primary
       and employment.deleted_at is null
       and employment.starts_on <= current_date
       and (employment.ends_on is null or employment.ends_on >= current_date)
      join public.employee_organizations organization
        on organization.tenant_id = employment.tenant_id
       and organization.employee_id = employment.employee_id
       and organization.employment_id = employment.id
       and organization.effective_from <= current_date
       and (organization.effective_to is null or organization.effective_to > current_date)
      join public.jobs job
        on job.tenant_id = organization.tenant_id
       and job.id = organization.job_id
       and job.is_active
      join public.job_profiles profile
        on profile.tenant_id = job.tenant_id
       and profile.job_id = job.id
      join public.job_profile_versions profile_version
        on profile_version.tenant_id = profile.tenant_id
       and profile_version.job_profile_id = profile.id
       and profile_version.id = requirement.profile_version_id
       and profile_version.status = 'ACTIVE'
       and profile_version.valid_from <= current_date
       and (profile_version.valid_until is null or profile_version.valid_until > current_date)
      where employee.auth_user_id = auth.uid()
        and employee.tenant_id = requested_tenant_id
        and employee.deleted_at is null
        and employee.is_active
    )
  order by requirement.sort_order, capability.name;
$$;

revoke all on function public.get_my_talent_profile_requirements(uuid, uuid) from public, anon;
grant execute on function public.get_my_talent_profile_requirements(uuid, uuid) to authenticated;

-- Managers mogen alleen capability- en niveaugegevens zien die aan een actuele
-- profielversie in hun eigen directe scope gekoppeld zijn.
drop policy if exists talent_capabilities_talent_read on public.talent_capabilities;
create policy talent_capabilities_talent_read on public.talent_capabilities for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1
      from public.job_profile_capability_requirements requirement
      join public.job_profile_versions profile_version
        on profile_version.tenant_id = requirement.tenant_id
       and profile_version.id = requirement.profile_version_id
      join public.job_profiles profile
        on profile.tenant_id = profile_version.tenant_id
       and profile.id = profile_version.job_profile_id
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id
       and organization.job_id = profile.job_id
      where requirement.tenant_id = talent_capabilities.tenant_id
        and requirement.capability_id = talent_capabilities.id
        and profile_version.status = 'ACTIVE'
        and profile_version.valid_from <= current_date
        and (profile_version.valid_until is null or profile_version.valid_until > current_date)
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

drop policy if exists talent_levels_talent_read on public.talent_levels;
create policy talent_levels_talent_read on public.talent_levels for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1
      from public.job_profile_capability_requirements requirement
      join public.job_profile_versions profile_version
        on profile_version.tenant_id = requirement.tenant_id
       and profile_version.id = requirement.profile_version_id
      join public.job_profiles profile
        on profile.tenant_id = profile_version.tenant_id
       and profile.id = profile_version.job_profile_id
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id
       and organization.job_id = profile.job_id
      where requirement.tenant_id = talent_levels.tenant_id
        and requirement.target_level_id = talent_levels.id
        and profile_version.status = 'ACTIVE'
        and profile_version.valid_from <= current_date
        and (profile_version.valid_until is null or profile_version.valid_until > current_date)
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

-- De manager-scope policies houden rekening met zowel start- als einddatum.
drop policy if exists jobs_read_tenant on public.jobs;
create policy jobs_read_tenant on public.jobs for select to authenticated
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
);

drop policy if exists job_groups_read_tenant on public.job_groups;
create policy job_groups_read_tenant on public.job_groups for select to authenticated
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
);

drop policy if exists job_profiles_talent_read on public.job_profiles;
create policy job_profiles_talent_read on public.job_profiles for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1 from public.employee_organizations organization
      where organization.tenant_id = job_profiles.tenant_id
        and organization.job_id = job_profiles.job_id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

drop policy if exists job_profile_versions_talent_read on public.job_profile_versions;
create policy job_profile_versions_talent_read on public.job_profile_versions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and status = 'ACTIVE'
    and valid_from <= current_date
    and (valid_until is null or valid_until > current_date)
    and exists (
      select 1
      from public.job_profiles profile
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
      where profile.tenant_id = job_profile_versions.tenant_id
        and profile.id = job_profile_versions.job_profile_id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

drop policy if exists job_profile_capability_requirements_talent_read on public.job_profile_capability_requirements;
create policy job_profile_capability_requirements_talent_read on public.job_profile_capability_requirements for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1
      from public.job_profile_versions profile_version
      join public.job_profiles profile
        on profile.tenant_id = profile_version.tenant_id and profile.id = profile_version.job_profile_id
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
      where profile_version.tenant_id = job_profile_capability_requirements.tenant_id
        and profile_version.id = job_profile_capability_requirements.profile_version_id
        and profile_version.status = 'ACTIVE'
        and profile_version.valid_from <= current_date
        and (profile_version.valid_until is null or profile_version.valid_until > current_date)
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

commit;
