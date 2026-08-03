delete from public.role_permissions role_permission
using public.management_roles role, public.permissions permission
where role_permission.management_role_id = role.id
  and role_permission.permission_id = permission.id
  and role.tenant_id is null
  and role.code = 'DIRECT_MANAGER'
  and permission.code = 'talent:read';

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
        and organization.effective_to is null
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
        and organization.effective_to is null
    )
  )
);

drop policy if exists job_revisions_read_tenant on public.job_revisions;
create policy job_revisions_read_tenant on public.job_revisions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'job-catalog:read'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1 from public.jobs job
      join public.employee_organizations organization
        on organization.tenant_id = job.tenant_id and organization.job_id = job.id
      where job.tenant_id = job_revisions.tenant_id
        and job.id = job_revisions.job_id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_to is null
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
        and organization.effective_to is null
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
    and exists (
      select 1
      from public.job_profiles profile
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
      where profile.tenant_id = job_profile_versions.tenant_id
        and profile.id = job_profile_versions.job_profile_id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_to is null
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
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_to is null
    )
  )
);
