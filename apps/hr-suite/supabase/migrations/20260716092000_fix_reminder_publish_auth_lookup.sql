create or replace function public.publish_reminder(requested_reminder_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  reminder_row public.reminders;
  recipient_count integer;
begin
  select * into reminder_row from public.reminders where id = requested_reminder_id for update;
  if reminder_row.id is null then raise exception 'REMINDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_permission(reminder_row.tenant_id, reminder_row.administration_id, 'reminder:write') then
    raise exception 'REMINDER_FORBIDDEN' using errcode = '42501';
  end if;
  if reminder_row.status <> 'DRAFT' then raise exception 'REMINDER_NOT_DRAFT' using errcode = 'P0001'; end if;
  if reminder_row.remind_at <= timezone('utc', now()) then raise exception 'REMINDER_IN_PAST' using errcode = '22023'; end if;
  if reminder_row.target_type in ('DEPARTMENTS', 'EMPLOYEES') and not exists (
    select 1 from public.reminder_targets target where target.reminder_id = reminder_row.id
  ) then
    raise exception 'REMINDER_TARGETS_REQUIRED' using errcode = '22023';
  end if;

  if reminder_row.target_type = 'EVERYONE' then
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select reminder_row.tenant_id, reminder_row.id, employee.auth_user_id, employee.id, reminder_row.remind_at
    from public.employees employee
    where employee.auth_user_id is not null
      and employee.tenant_id = reminder_row.tenant_id
      and employee.deleted_at is null
      and employee.is_active
      and (
        reminder_row.administration_id is null
        or exists (
          select 1 from public.employee_organizations organization
          where organization.employee_id = employee.id
            and organization.administration_id = reminder_row.administration_id
            and organization.effective_from <= reminder_row.remind_at::date
            and (organization.effective_to is null or organization.effective_to >= reminder_row.remind_at::date)
        )
      );
  elsif reminder_row.target_type = 'DEPARTMENTS' then
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select distinct reminder_row.tenant_id, reminder_row.id, employee.auth_user_id, employee.id, reminder_row.remind_at
    from public.reminder_targets target
    join public.employee_organizations organization on organization.department_id = target.department_id and organization.effective_from <= reminder_row.remind_at::date and (organization.effective_to is null or organization.effective_to >= reminder_row.remind_at::date)
    join public.employees employee on employee.id = organization.employee_id and employee.auth_user_id is not null and employee.is_active and employee.deleted_at is null
    where target.reminder_id = reminder_row.id;
  else
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select reminder_row.tenant_id, reminder_row.id, employee.auth_user_id, employee.id, reminder_row.remind_at
    from public.reminder_targets target
    join public.employees employee on employee.id = target.employee_id and employee.auth_user_id is not null and employee.is_active and employee.deleted_at is null
    where target.reminder_id = reminder_row.id;
  end if;

  get diagnostics recipient_count = row_count;
  if recipient_count = 0 then raise exception 'REMINDER_NO_RECIPIENTS' using errcode = 'P0001'; end if;
  update public.reminders set status = 'PUBLISHED', published_at = timezone('utc', now()) where id = reminder_row.id;
  return recipient_count;
end;
$$;

revoke all on function public.publish_reminder(uuid) from public, anon;
grant execute on function public.publish_reminder(uuid) to authenticated;
