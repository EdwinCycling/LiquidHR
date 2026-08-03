begin;

-- Laat PostgreSQL de dure manager-scopejoin alleen uitvoeren wanneer de actor
-- daadwerkelijk manager-read heeft. Selfservice-queries mogen die join nooit
-- per capability evalueren.
drop policy if exists talent_capabilities_talent_read on public.talent_capabilities;
create policy talent_capabilities_talent_read on public.talent_capabilities for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or case
    when (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read')) then exists (
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
    else false
  end
  or (
    status = 'ACTIVE'
    and (
      (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
      or (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
    )
  )
);

drop policy if exists talent_levels_talent_read on public.talent_levels;
create policy talent_levels_talent_read on public.talent_levels for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or case
    when (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read')) then exists (
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
    else false
  end
  or (
    exists (
      select 1
      from public.talent_level_models model
      where model.tenant_id = talent_levels.tenant_id
        and model.id = talent_levels.level_model_id
        and model.status = 'ACTIVE'
    )
    and (
      (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
      or (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
    )
  )
);

drop policy if exists talent_level_models_talent_read on public.talent_level_models;
create policy talent_level_models_talent_read on public.talent_level_models for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    status = 'ACTIVE'
    and (
      (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-record:read'))
      or (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
    )
  )
);

commit;
