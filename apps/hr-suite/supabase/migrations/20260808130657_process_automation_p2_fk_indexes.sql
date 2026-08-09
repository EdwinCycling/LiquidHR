begin;

create index if not exists process_definitions_administration_fk_idx
  on public.process_definitions (tenant_id, hr_group_id, administration_id);
create index if not exists process_definitions_created_by_user_idx
  on public.process_definitions (created_by_user_id);
create index if not exists process_definitions_updated_by_user_idx
  on public.process_definitions (updated_by_user_id);
create index if not exists process_definition_drafts_created_by_user_idx
  on public.process_definition_drafts (created_by_user_id);
create index if not exists process_definition_drafts_updated_by_user_idx
  on public.process_definition_drafts (updated_by_user_id);
create index if not exists process_versions_published_by_user_idx
  on public.process_versions (published_by_user_id);

create index if not exists form_definitions_administration_fk_idx
  on public.form_definitions (tenant_id, hr_group_id, administration_id);
create index if not exists form_definitions_created_by_user_idx
  on public.form_definitions (created_by_user_id);
create index if not exists form_definitions_updated_by_user_idx
  on public.form_definitions (updated_by_user_id);
create index if not exists form_definition_drafts_created_by_user_idx
  on public.form_definition_drafts (created_by_user_id);
create index if not exists form_definition_drafts_updated_by_user_idx
  on public.form_definition_drafts (updated_by_user_id);
create index if not exists form_versions_published_by_user_idx
  on public.form_versions (published_by_user_id);

create index if not exists process_instances_definition_fk_idx
  on public.process_instances (tenant_id, hr_group_id, process_definition_id);
create index if not exists process_instances_initiator_employee_fk_idx
  on public.process_instances (tenant_id, hr_group_id, initiator_employee_id);
create index if not exists process_instances_initiator_user_idx
  on public.process_instances (initiator_user_id);
create index if not exists process_instances_pinned_version_fk_idx
  on public.process_instances (tenant_id, hr_group_id, process_definition_id, process_version_id);
create index if not exists process_employee_subjects_employee_fk_idx
  on public.process_employee_subjects (tenant_id, hr_group_id, employee_id);
create index if not exists process_employment_subjects_instance_fk_idx
  on public.process_employment_subjects (tenant_id, hr_group_id, administration_id, process_instance_id);
create index if not exists process_employment_subjects_employment_fk_idx
  on public.process_employment_subjects (tenant_id, hr_group_id, administration_id, employment_id);
create index if not exists process_step_instances_instance_fk_idx
  on public.process_step_instances (tenant_id, hr_group_id, process_instance_id, process_version_id);

create index if not exists process_work_items_claimed_by_user_idx
  on public.process_work_items (claimed_by_user_id);
create index if not exists process_work_items_instance_fk_idx
  on public.process_work_items (tenant_id, hr_group_id, process_instance_id);
create index if not exists process_work_items_step_instance_fk_idx
  on public.process_work_items (tenant_id, hr_group_id, process_instance_id, step_instance_id);
create index if not exists process_work_items_version_fk_idx
  on public.process_work_items (tenant_id, hr_group_id, process_instance_id, process_version_id);
create index if not exists process_work_item_candidates_candidate_user_idx
  on public.process_work_item_candidates (candidate_user_id);
create index if not exists process_work_item_candidates_management_role_idx
  on public.process_work_item_candidates (management_role_id);
create index if not exists process_events_actor_employee_fk_idx
  on public.process_events (tenant_id, hr_group_id, actor_employee_id);
create index if not exists process_events_actor_user_idx
  on public.process_events (actor_user_id);
create index if not exists process_events_work_item_fk_idx
  on public.process_events (tenant_id, hr_group_id, work_item_id);

commit;
