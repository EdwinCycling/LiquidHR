begin;

alter table public.audit_logs
  drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL', 'EXPORT', 'START', 'STOP'));

create policy audit_logs_insert_focus_act_as
on public.audit_logs
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and entity_name = 'focus_act_as_session'
  and entity_id = subject_employee_id
  and subject_employee_id is not null
  and action in ('START', 'STOP')
  and changes ->> 'mode' = 'FOCUS_ESS'
  and jsonb_typeof(changes -> 'expiresAt') = 'number'
  and internal_security.current_user_has_hr_group_permission(
    tenant_id,
    (
      select employee.hr_group_id
      from public.employees employee
      where employee.id = audit_logs.subject_employee_id
        and employee.tenant_id = audit_logs.tenant_id
        and employee.deleted_at is null
    ),
    'focus:act-as-employee'
  )
);

commit;
