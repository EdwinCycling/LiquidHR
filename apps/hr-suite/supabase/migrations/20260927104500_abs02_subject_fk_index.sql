begin;

create index if not exists focus_act_as_sessions_subject_scope_idx
  on public.focus_act_as_sessions (tenant_id, hr_group_id, subject_employee_id);

commit;
