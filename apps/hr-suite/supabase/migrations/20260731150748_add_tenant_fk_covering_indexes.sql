create index if not exists departments_tenant_parent_idx
  on public.departments (tenant_id, parent_id)
  where parent_id is not null;

create index if not exists job_groups_tenant_job_family_idx
  on public.job_groups (tenant_id, job_family_id)
  where job_family_id is not null;

create index if not exists jobs_tenant_job_group_idx
  on public.jobs (tenant_id, job_group_id);

create index if not exists jobs_tenant_seniority_idx
  on public.jobs (tenant_id, seniority_id)
  where seniority_id is not null;

create index if not exists talent_capabilities_tenant_category_idx
  on public.talent_capabilities (tenant_id, category_id)
  where category_id is not null;

create index if not exists talent_capability_level_content_tenant_level_idx
  on public.talent_capability_level_content (tenant_id, talent_level_id);

create index if not exists job_profile_requirements_tenant_capability_idx
  on public.job_profile_capability_requirements (tenant_id, capability_id);

create index if not exists job_profile_requirements_tenant_target_level_idx
  on public.job_profile_capability_requirements (tenant_id, target_level_id)
  where target_level_id is not null;
