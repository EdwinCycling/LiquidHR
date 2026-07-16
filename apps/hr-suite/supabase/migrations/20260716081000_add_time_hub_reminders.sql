create type public.clock_mode as enum ('ANALOG', 'DIGITAL', 'HIDDEN');
create type public.analog_clock_style as enum ('CLASSIC', 'MINIMAL', 'LIQUID');
create type public.reminder_type as enum ('PERSONAL', 'HR');
create type public.reminder_target_type as enum ('SELF', 'EVERYONE', 'DEPARTMENTS', 'EMPLOYEES');
create type public.reminder_status as enum ('DRAFT', 'PUBLISHED', 'CANCELLED');
create type public.reminder_recipient_status as enum ('PENDING', 'COMPLETED', 'DISMISSED');

alter table public.user_preferences
  add column clock_mode public.clock_mode not null default 'ANALOG',
  add column analog_clock_style public.analog_clock_style not null default 'LIQUID';

insert into public.permissions (code, name, category, description)
values
  ('reminder:read', 'HR-reminders bekijken', 'Tijdhub', 'Bekijkt door HR geplande reminders binnen de geldige scope.'),
  ('reminder:write', 'HR-reminders beheren', 'Tijdhub', 'Maakt, publiceert en annuleert HR-reminders binnen de geldige scope.')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('reminder:read', 'reminder:write')
on conflict do nothing;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  created_by_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  reminder_type public.reminder_type not null,
  target_type public.reminder_target_type not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  remind_at timestamptz not null,
  status public.reminder_status not null default 'DRAFT',
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reminders_administration_same_tenant_fkey
    foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id)
    on delete cascade,
  constraint reminders_type_target_consistent check (
    (reminder_type = 'PERSONAL' and target_type = 'SELF')
    or (reminder_type = 'HR' and target_type <> 'SELF')
  ),
  constraint reminders_status_dates_consistent check (
    (status = 'DRAFT' and published_at is null and cancelled_at is null)
    or (status = 'PUBLISHED' and published_at is not null and cancelled_at is null)
    or (status = 'CANCELLED' and cancelled_at is not null)
  )
);

create table public.reminder_targets (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reminder_targets_exactly_one_target check ((department_id is not null)::integer + (employee_id is not null)::integer = 1),
  unique (reminder_id, department_id),
  unique (reminder_id, employee_id)
);

create table public.reminder_recipients (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  status public.reminder_recipient_status not null default 'PENDING',
  effective_remind_at timestamptz not null,
  completed_at timestamptz,
  dismissed_at timestamptz,
  last_popup_at timestamptz,
  snoozed_from timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (reminder_id, user_id)
);

create index reminder_recipients_upcoming_idx
  on public.reminder_recipients (user_id, effective_remind_at, status);
create index reminder_recipients_reminder_idx
  on public.reminder_recipients (reminder_id, status);
create index reminder_targets_department_idx on public.reminder_targets (department_id);
create index reminder_targets_employee_idx on public.reminder_targets (employee_id);

create trigger set_reminders_updated_at before update on public.reminders
for each row execute function internal_security.set_updated_at();
create trigger set_reminder_recipients_updated_at before update on public.reminder_recipients
for each row execute function internal_security.set_updated_at();
create trigger audit_reminders after insert or update or delete on public.reminders
for each row execute function internal_security.audit_hr_change('reminder');
create trigger audit_reminder_recipients after insert or update or delete on public.reminder_recipients
for each row execute function internal_security.audit_hr_change('reminder_recipient');

alter table public.reminders enable row level security;
alter table public.reminder_targets enable row level security;
alter table public.reminder_recipients enable row level security;

create policy reminders_select_self_or_hr on public.reminders for select to authenticated
using (
  created_by_user_id = (select auth.uid())
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:read'))
);
create policy reminders_insert_self_or_hr on public.reminders for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (
    (reminder_type = 'PERSONAL' and target_type = 'SELF')
    or (reminder_type = 'HR' and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write')))
  )
);
create policy reminders_update_hr on public.reminders for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write')));
create policy reminders_delete_hr on public.reminders for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write')));

create policy reminder_targets_select_creator_or_hr on public.reminder_targets for select to authenticated
using (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_id
    and (reminder.created_by_user_id = (select auth.uid())
      or (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:read')))
));
create policy reminder_targets_write_creator_or_hr on public.reminder_targets for all to authenticated
using (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_id
    and (reminder.created_by_user_id = (select auth.uid())
      or (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write')))
))
with check (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_id
    and (reminder.created_by_user_id = (select auth.uid())
      or (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write')))
));

create policy reminder_recipients_select_self on public.reminder_recipients for select to authenticated
using (user_id = (select auth.uid()));
create policy reminder_recipients_insert_hr on public.reminder_recipients for insert to authenticated
with check (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_id
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
));
create policy reminder_recipients_update_self on public.reminder_recipients for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy reminder_recipients_delete_hr on public.reminder_recipients for delete to authenticated
using (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_id
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
));

grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.reminder_targets to authenticated;
grant select, insert, update, delete on public.reminder_recipients to authenticated;

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

  if reminder_row.target_type = 'EVERYONE' then
    insert into public.reminder_recipients (reminder_id, user_id, effective_remind_at)
    select reminder_row.id, u.id, reminder_row.remind_at
    from auth.users u
    join public.employees e on e.auth_user_id = u.id and e.tenant_id = reminder_row.tenant_id and e.deleted_at is null and e.is_active
    where reminder_row.administration_id is null
      or exists (select 1 from public.employee_organizations eo where eo.employee_id = e.id and eo.administration_id = reminder_row.administration_id and eo.effective_from <= reminder_row.remind_at::date and (eo.effective_to is null or eo.effective_to >= reminder_row.remind_at::date));
  elsif reminder_row.target_type = 'DEPARTMENTS' then
    insert into public.reminder_recipients (reminder_id, user_id, employee_id, effective_remind_at)
    select distinct reminder_row.id, e.auth_user_id, e.id, reminder_row.remind_at
    from public.reminder_targets target
    join public.employee_organizations eo on eo.department_id = target.department_id and eo.effective_from <= reminder_row.remind_at::date and (eo.effective_to is null or eo.effective_to >= reminder_row.remind_at::date)
    join public.employees e on e.id = eo.employee_id and e.auth_user_id is not null and e.is_active and e.deleted_at is null
    where target.reminder_id = reminder_row.id;
  else
    insert into public.reminder_recipients (reminder_id, user_id, employee_id, effective_remind_at)
    select reminder_row.id, e.auth_user_id, e.id, reminder_row.remind_at
    from public.reminder_targets target
    join public.employees e on e.id = target.employee_id and e.auth_user_id is not null and e.is_active and e.deleted_at is null
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
