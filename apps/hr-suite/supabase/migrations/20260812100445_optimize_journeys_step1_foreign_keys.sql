-- Dekt alle foreign keys uit de Journeys-configuratieslice af zonder gedrag te wijzigen.

create index journey_template_moments_phase_fk_idx
  on public.journey_template_moments (tenant_id, hr_group_id, template_version_id, phase_id);

create index journey_template_roles_resolver_employee_fk_idx
  on public.journey_template_roles (tenant_id, hr_group_id, resolver_employee_id)
  where resolver_employee_id is not null;

create index journey_template_topics_owner_role_fk_idx
  on public.journey_template_topics (tenant_id, hr_group_id, template_version_id, owner_role_id);

create index journey_template_versions_created_by_fk_idx
  on public.journey_template_versions (created_by_user_id);

create index journey_template_versions_published_by_fk_idx
  on public.journey_template_versions (published_by_user_id)
  where published_by_user_id is not null;

create index journey_template_versions_updated_by_fk_idx
  on public.journey_template_versions (updated_by_user_id);

create index journey_templates_created_by_fk_idx
  on public.journey_templates (created_by_user_id);

create index journey_templates_current_version_fk_idx
  on public.journey_templates (tenant_id, hr_group_id, current_published_version_id)
  where current_published_version_id is not null;

create index journey_templates_updated_by_fk_idx
  on public.journey_templates (updated_by_user_id);
