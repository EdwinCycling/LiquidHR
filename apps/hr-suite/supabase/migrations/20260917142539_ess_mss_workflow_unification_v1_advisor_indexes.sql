begin;

-- Keep the composite foreign keys indexable in their declared column order.
create index if not exists process_leave_subjects_instance_idx
  on public.process_leave_subjects (tenant_id, hr_group_id, process_instance_id);

create index if not exists process_leave_subjects_request_scope_idx
  on public.process_leave_subjects (tenant_id, hr_group_id, administration_id, leave_request_id);

create index if not exists process_recipe_activations_recipe_idx
  on public.process_recipe_activations (process_recipe_id);

commit;

