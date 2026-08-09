begin;

create index if not exists process_form_response_revisions_changed_by_user_idx
  on public.process_form_response_revisions (changed_by_user_id);
create index if not exists process_form_responses_form_version_idx
  on public.process_form_responses (tenant_id, hr_group_id, form_version_id)
  where form_version_id is not null;
create index if not exists process_form_responses_last_saved_by_user_idx
  on public.process_form_responses (last_saved_by_user_id);
create index if not exists process_form_responses_step_fk_idx
  on public.process_form_responses (tenant_id, hr_group_id, process_instance_id, step_instance_id);
create index if not exists process_form_responses_version_fk_idx
  on public.process_form_responses (tenant_id, hr_group_id, process_instance_id, process_version_id);

commit;
