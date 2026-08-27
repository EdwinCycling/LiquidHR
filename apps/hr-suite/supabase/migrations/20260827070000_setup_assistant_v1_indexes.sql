begin;

create index setup_guide_settings_created_by_idx
  on public.setup_guide_settings (created_by);

create index setup_guide_settings_updated_by_idx
  on public.setup_guide_settings (updated_by);

create index setup_step_completion_completed_by_idx
  on public.setup_step_completion (completed_by);

create index setup_step_completion_updated_by_idx
  on public.setup_step_completion (updated_by);

commit;
