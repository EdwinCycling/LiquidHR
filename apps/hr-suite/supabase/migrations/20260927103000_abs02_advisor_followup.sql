begin;

-- Keep the new foreign keys index-backed for session/task maintenance and
-- audit cleanup paths.
create index if not exists absence_tasks_completed_by_user_idx
  on public.absence_tasks (completed_by_user_id);

create index if not exists focus_act_as_sessions_actor_user_idx
  on public.focus_act_as_sessions (actor_user_id);

create index if not exists focus_act_as_sessions_subject_employee_idx
  on public.focus_act_as_sessions (subject_employee_id);

-- Avoid per-row auth.uid() init-plan evaluation in the ACT-AS policies.
alter policy focus_act_as_sessions_select
on public.focus_act_as_sessions
using (
  actor_user_id = (select auth.uid())
  and internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'focus:act-as-employee')
);

alter policy focus_act_as_sessions_insert
on public.focus_act_as_sessions
with check (
  actor_user_id = (select auth.uid())
  and internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'focus:act-as-employee')
  and exists (
    select 1 from public.employees employee
    where employee.tenant_id = focus_act_as_sessions.tenant_id
      and employee.hr_group_id = focus_act_as_sessions.hr_group_id
      and employee.id = focus_act_as_sessions.subject_employee_id
      and employee.is_active
      and not employee.is_archived
      and employee.deleted_at is null
  )
);

alter policy focus_act_as_sessions_stop
on public.focus_act_as_sessions
using (
  actor_user_id = (select auth.uid())
  and ended_at is null
  and internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'focus:act-as-employee')
)
with check (actor_user_id = (select auth.uid()) and ended_at is not null);

commit;
