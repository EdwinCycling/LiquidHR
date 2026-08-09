begin;

revoke all on table public.process_definitions,
  public.process_definition_drafts,
  public.process_versions,
  public.form_definitions,
  public.form_definition_drafts,
  public.form_versions,
  public.process_instances,
  public.process_employee_subjects,
  public.process_employment_subjects,
  public.process_step_instances,
  public.process_work_items,
  public.process_work_item_candidates,
  public.process_events
from authenticated;

grant select on table public.process_definitions,
  public.process_definition_drafts,
  public.process_versions,
  public.form_definitions,
  public.form_definition_drafts,
  public.form_versions,
  public.process_instances,
  public.process_employee_subjects,
  public.process_employment_subjects,
  public.process_step_instances,
  public.process_work_items,
  public.process_work_item_candidates,
  public.process_events
to authenticated;

commit;
