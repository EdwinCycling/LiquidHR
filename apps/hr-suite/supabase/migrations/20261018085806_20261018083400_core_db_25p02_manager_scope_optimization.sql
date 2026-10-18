begin;

-- Keep the manager-read boundary exact while evaluating it once in a definer
-- function. The previous policies recursively expanded RLS on profile,
-- version, requirement, and organization rows for every catalog item.
create or replace function internal_security.current_user_can_read_talent_manager_scope(
  requested_tenant_id uuid,
  requested_job_id uuid,
  requested_profile_version_id uuid,
  requested_capability_id uuid,
  requested_level_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with scoped_manager_organizations as (
    select organization.tenant_id, organization.hr_group_id, organization.job_id
    from public.employee_organizations organization
    where organization.tenant_id = requested_tenant_id
      and organization.direct_manager_id = internal_security.current_employee_id()
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to > current_date)
      and (
        (
          organization.employee_id = internal_security.current_employee_id(
            organization.tenant_id,
            organization.hr_group_id
          )
          and internal_security.current_employee_has_permission('self:employee:read')
        )
        or internal_security.can_manage_employee(organization.employee_id, 'employee:read')
        or internal_security.current_user_has_hr_group_permission(
          organization.tenant_id,
          organization.hr_group_id,
          'organization-chart:read'
        )
        or internal_security.current_user_has_hr_group_permission(
          organization.tenant_id,
          organization.hr_group_id,
          'organization-placement:read'
        )
      )
  )
  select (select auth.uid()) is not null
    and pg_catalog.num_nonnulls(
      requested_job_id,
      requested_profile_version_id,
      requested_capability_id,
      requested_level_id
    ) = 1
    and internal_security.current_user_has_permission(
      requested_tenant_id,
      null,
      'talent:manager-read'
    )
    and case
      when requested_job_id is not null then exists (
        select 1
        from scoped_manager_organizations scope_row
        where scope_row.tenant_id = requested_tenant_id
          and scope_row.job_id = requested_job_id
      )
      when requested_profile_version_id is not null then exists (
        select 1
        from public.job_profile_versions profile_version
        join public.job_profiles profile
          on profile.tenant_id = profile_version.tenant_id
         and profile.id = profile_version.job_profile_id
        join scoped_manager_organizations scope_row
          on scope_row.tenant_id = profile.tenant_id
         and scope_row.job_id = profile.job_id
        where profile_version.tenant_id = requested_tenant_id
          and profile_version.id = requested_profile_version_id
          and profile_version.status = 'ACTIVE'
          and profile_version.valid_from <= current_date
          and (profile_version.valid_until is null or profile_version.valid_until > current_date)
      )
      when requested_capability_id is not null then exists (
        select 1
        from public.job_profile_capability_requirements requirement
        join public.job_profile_versions profile_version
          on profile_version.tenant_id = requirement.tenant_id
         and profile_version.id = requirement.profile_version_id
        join public.job_profiles profile
          on profile.tenant_id = profile_version.tenant_id
         and profile.id = profile_version.job_profile_id
        join scoped_manager_organizations scope_row
          on scope_row.tenant_id = profile.tenant_id
         and scope_row.job_id = profile.job_id
        where requirement.tenant_id = requested_tenant_id
          and requirement.capability_id = requested_capability_id
          and profile_version.status = 'ACTIVE'
          and profile_version.valid_from <= current_date
          and (profile_version.valid_until is null or profile_version.valid_until > current_date)
      )
      when requested_level_id is not null then exists (
        select 1
        from public.job_profile_capability_requirements requirement
        join public.job_profile_versions profile_version
          on profile_version.tenant_id = requirement.tenant_id
         and profile_version.id = requirement.profile_version_id
        join public.job_profiles profile
          on profile.tenant_id = profile_version.tenant_id
         and profile.id = profile_version.job_profile_id
        join scoped_manager_organizations scope_row
          on scope_row.tenant_id = profile.tenant_id
         and scope_row.job_id = profile.job_id
        where requirement.tenant_id = requested_tenant_id
          and requirement.target_level_id = requested_level_id
          and profile_version.status = 'ACTIVE'
          and profile_version.valid_from <= current_date
          and (profile_version.valid_until is null or profile_version.valid_until > current_date)
      )
      else false
    end;
$function$;

revoke all on function internal_security.current_user_can_read_talent_manager_scope(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function internal_security.current_user_can_read_talent_manager_scope(uuid, uuid, uuid, uuid, uuid)
  to authenticated;

drop policy if exists job_profiles_talent_read on public.job_profiles;
create policy job_profiles_talent_read on public.job_profiles for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (select internal_security.current_user_can_read_talent_manager_scope(tenant_id, job_id, null, null, null))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
);

drop policy if exists job_profile_versions_talent_read on public.job_profile_versions;
create policy job_profile_versions_talent_read on public.job_profile_versions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (select internal_security.current_user_can_read_talent_manager_scope(tenant_id, null, id, null, null))
  or (
    status = 'ACTIVE'
    and valid_from <= current_date
    and (valid_until is null or valid_until > current_date)
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-comparison:read'))
  )
);

drop policy if exists job_profile_capability_requirements_talent_read on public.job_profile_capability_requirements;
create policy job_profile_capability_requirements_talent_read
on public.job_profile_capability_requirements for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (select internal_security.current_user_can_read_talent_manager_scope(tenant_id, null, profile_version_id, null, null))
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
  or (select internal_security.current_user_can_read_talent_manager_scope(tenant_id, null, null, id, null))
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
  or (select internal_security.current_user_can_read_talent_manager_scope(tenant_id, null, null, null, id))
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

commit;
