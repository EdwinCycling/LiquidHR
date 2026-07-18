drop policy reminder_targets_write_hr on public.reminder_targets;

create policy reminder_targets_insert_hr on public.reminder_targets
for insert to authenticated
with check (exists (
  select 1
  from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and reminder.reminder_type = 'HR'
    and reminder.status = 'DRAFT'
    and reminder.tenant_id = reminder_targets.tenant_id
    and reminder.administration_id is not distinct from reminder_targets.administration_id
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
));

create policy reminder_targets_update_hr on public.reminder_targets
for update to authenticated
using (exists (
  select 1
  from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and reminder.reminder_type = 'HR'
    and reminder.status = 'DRAFT'
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
))
with check (exists (
  select 1
  from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and reminder.reminder_type = 'HR'
    and reminder.status = 'DRAFT'
    and reminder.tenant_id = reminder_targets.tenant_id
    and reminder.administration_id is not distinct from reminder_targets.administration_id
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
));

create policy reminder_targets_delete_hr on public.reminder_targets
for delete to authenticated
using (exists (
  select 1
  from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and reminder.reminder_type = 'HR'
    and reminder.status = 'DRAFT'
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
));
