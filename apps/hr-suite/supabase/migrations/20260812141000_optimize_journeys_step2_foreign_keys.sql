-- Dek alle samengestelde runtime-FK's af die de remote Supabase-advisor signaleert.
create index journeys_template_scope_fk_idx
  on public.journeys (tenant_id, hr_group_id, template_id);
create index journeys_template_version_scope_fk_idx
  on public.journeys (tenant_id, hr_group_id, template_version_id);
create index journeys_employment_scope_fk_idx
  on public.journeys (tenant_id, hr_group_id, employment_id);
create index journey_moments_phase_scope_fk_idx
  on public.journey_moments (tenant_id, hr_group_id, journey_id, phase_id);
create index journey_topics_moment_scope_fk_idx
  on public.journey_topics (tenant_id, hr_group_id, journey_id, moment_id);
create index journey_topic_assignments_participant_scope_fk_idx
  on public.journey_topic_assignments (tenant_id, hr_group_id, journey_id, participant_id);
create index journey_reminder_links_participant_scope_fk_idx
  on public.journey_reminder_links (tenant_id, hr_group_id, journey_id, participant_id);
