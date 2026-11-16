begin;

-- The canonical employee self-report kernel creates its HR reminder and target
-- in one security-definer transaction and publishes the reminder immediately.
-- Interactive reminder creation still uses DRAFT before publication. Keep the
-- scope checks for both trusted lifecycle states.
create or replace function internal_security.guard_reminder_target()
returns trigger
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  parent public.reminders;
begin
  select reminder.* into parent
  from public.reminders reminder
  where reminder.id = new.reminder_id;

  if parent.id is null
    or parent.tenant_id <> new.tenant_id
    or parent.administration_id is distinct from new.administration_id
    or parent.reminder_type <> 'HR'
    or parent.status not in ('DRAFT', 'PUBLISHED')
    or (parent.target_type = 'DEPARTMENTS' and new.department_id is null)
    or (parent.target_type = 'EMPLOYEES' and new.employee_id is null)
    or parent.target_type not in ('DEPARTMENTS', 'EMPLOYEES') then
    raise exception 'REMINDER_TARGET_SCOPE_INVALID' using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
