create or replace function internal_security.current_user_is_reminder_recipient(requested_reminder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.reminder_recipients recipient
      where recipient.reminder_id = requested_reminder_id
        and recipient.user_id = (select auth.uid())
    );
$$;

revoke all on function internal_security.current_user_is_reminder_recipient(uuid) from public, anon, authenticated;
grant execute on function internal_security.current_user_is_reminder_recipient(uuid) to authenticated;

drop policy if exists reminders_select_self_or_hr on public.reminders;
create policy reminders_select_self_or_hr on public.reminders for select to authenticated
using (
  created_by_user_id = (select auth.uid())
  or (select internal_security.current_user_is_reminder_recipient(reminders.id))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:read'))
);
