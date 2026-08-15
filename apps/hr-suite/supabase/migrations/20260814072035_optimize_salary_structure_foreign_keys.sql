create index salary_structures_created_by_idx
  on public.salary_structures (created_by_user_id)
  where created_by_user_id is not null;
create index salary_structures_updated_by_idx
  on public.salary_structures (updated_by_user_id)
  where updated_by_user_id is not null;

create index salary_structure_revisions_created_by_idx
  on public.salary_structure_revisions (created_by_user_id)
  where created_by_user_id is not null;
create index salary_structure_revisions_updated_by_idx
  on public.salary_structure_revisions (updated_by_user_id)
  where updated_by_user_id is not null;
create index salary_structure_revisions_published_by_idx
  on public.salary_structure_revisions (published_by_user_id)
  where published_by_user_id is not null;

create index salary_scale_revision_values_scale_idx
  on public.salary_scale_revision_values (tenant_id, hr_group_id, salary_scale_id);
create index salary_band_values_band_idx
  on public.salary_band_values (tenant_id, hr_group_id, salary_band_id);

create index labor_condition_salary_structures_created_by_idx
  on public.labor_condition_salary_structures (created_by_user_id)
  where created_by_user_id is not null;
create index salary_structure_migration_conflicts_resolved_by_idx
  on public.salary_structure_migration_conflicts (resolved_by_user_id)
  where resolved_by_user_id is not null;
