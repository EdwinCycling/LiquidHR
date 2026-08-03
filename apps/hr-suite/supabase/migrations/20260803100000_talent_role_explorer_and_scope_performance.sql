begin;

-- P3 spiderwebs mogen voor medewerkers uitsluitend actieve functiecatalogusdata
-- lezen. Persoonlijke capabilityrecords blijven via hun bestaande self-policy
-- uitsluitend aan de ingelogde medewerker gekoppeld.
insert into public.permissions (code, name, description, category)
values
  ('self:talent-comparison:read', 'Eigen Talentfunctie verkennen', 'Vergelijkt het eigen actuele Talentprofiel met een actieve functieversie.', 'Talent')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and role.code = 'EMPLOYEE'
  and permission.code = 'self:talent-comparison:read'
on conflict do nothing;

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
  or (
    is_active
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
  )
);

drop policy if exists job_groups_read_tenant on public.job_groups;
create policy job_groups_read_tenant on public.job_groups for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1 from public.jobs job
      join public.employee_organizations organization
        on organization.tenant_id = job.tenant_id and organization.job_id = job.id
      where job.tenant_id = job_groups.tenant_id
        and job.job_group_id = job_groups.id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
  or (
    is_active
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
  )
);

drop policy if exists job_families_talent_read on public.job_families;
create policy job_families_talent_read on public.job_families for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    status = 'ACTIVE'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
  )
);

drop policy if exists talent_seniorities_talent_read on public.talent_seniorities;
create policy talent_seniorities_talent_read on public.talent_seniorities for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    status = 'ACTIVE'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
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
  or (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
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
  or (
    status = 'ACTIVE'
    and valid_from <= current_date
    and (valid_until is null or valid_until > current_date)
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
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
  or (
    exists (
      select 1
      from public.job_profile_versions profile_version
      where profile_version.tenant_id = job_profile_capability_requirements.tenant_id
        and profile_version.id = job_profile_capability_requirements.profile_version_id
        and profile_version.status = 'ACTIVE'
        and profile_version.valid_from <= current_date
        and (profile_version.valid_until is null or profile_version.valid_until > current_date)
    )
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
  )
);

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
        on profile_version.tenant_id = requirement.tenant_id and profile_version.id = requirement.profile_version_id
      join public.job_profiles profile
        on profile.tenant_id = profile_version.tenant_id and profile.id = profile_version.job_profile_id
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
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
  or (
    status = 'ACTIVE'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
  )
  or (
    status = 'ACTIVE'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
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
        on profile_version.tenant_id = requirement.tenant_id and profile_version.id = requirement.profile_version_id
      join public.job_profiles profile
        on profile.tenant_id = profile_version.tenant_id and profile.id = profile_version.job_profile_id
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
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
  or (
    exists (
      select 1
      from public.talent_level_models model
      where model.tenant_id = talent_levels.tenant_id
        and model.id = talent_levels.level_model_id
        and model.status = 'ACTIVE'
    )
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
  )
);

-- Deze indexen ondersteunen de RLS-scopejoins en de actieve catalogusselecties.
create index if not exists employee_organizations_tenant_job_manager_effective_idx
  on public.employee_organizations (tenant_id, job_id, direct_manager_id, effective_from, effective_to);
create index if not exists job_profile_versions_tenant_profile_status_dates_idx
  on public.job_profile_versions (tenant_id, job_profile_id, status, valid_from, valid_until);
create index if not exists job_profile_requirements_tenant_capability_profile_idx
  on public.job_profile_capability_requirements (tenant_id, capability_id, profile_version_id);
create index if not exists talent_capabilities_tenant_status_type_name_idx
  on public.talent_capabilities (tenant_id, status, capability_type, name);

commit;
