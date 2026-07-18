drop policy reminder_recipients_select_self on public.reminder_recipients;
create policy reminder_recipients_select_self_or_hr on public.reminder_recipients for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.reminders reminder
    where reminder.id=reminder_recipients.reminder_id
      and (select internal_security.current_user_has_permission(reminder.tenant_id,reminder.administration_id,'reminder:read'))
  )
);
