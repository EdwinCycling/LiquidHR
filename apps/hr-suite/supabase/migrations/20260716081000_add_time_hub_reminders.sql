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
  constraint reminders_tenant_id_id_key unique (tenant_id, id),
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
  tenant_id uuid not null,
  administration_id uuid,
  reminder_id uuid not null,
  department_id uuid,
  employee_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reminder_targets_exactly_one_target check ((department_id is not null)::integer + (employee_id is not null)::integer = 1),
  constraint reminder_targets_reminder_same_tenant_fkey
    foreign key (tenant_id, reminder_id) references public.reminders(tenant_id, id) on delete cascade,
  constraint reminder_targets_department_same_scope_fkey
    foreign key (tenant_id, administration_id, department_id)
    references public.departments(tenant_id, administration_id, id) on delete cascade,
  constraint reminder_targets_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  constraint reminder_targets_scope_matches_type check (
    (department_id is not null and administration_id is not null)
    or employee_id is not null
  ),
  unique (reminder_id, department_id),
  unique (reminder_id, employee_id)
);

create table public.reminder_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  reminder_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid,
  status public.reminder_recipient_status not null default 'PENDING',
  effective_remind_at timestamptz not null,
  completed_at timestamptz,
  dismissed_at timestamptz,
  last_popup_at timestamptz,
  snoozed_from timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reminder_recipients_reminder_same_tenant_fkey
    foreign key (tenant_id, reminder_id) references public.reminders(tenant_id, id) on delete cascade,
  constraint reminder_recipients_employee_same_tenant_fkey
    foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete restrict,
  constraint reminder_recipients_status_dates_consistent check (
    (status = 'PENDING' and completed_at is null and dismissed_at is null)
    or (status = 'COMPLETED' and completed_at is not null and dismissed_at is null)
    or (status = 'DISMISSED' and dismissed_at is not null and completed_at is null)
  ),
  unique (reminder_id, user_id)
);

create index reminder_recipients_upcoming_idx
  on public.reminder_recipients (user_id, effective_remind_at, status);
create index reminder_recipients_reminder_idx
  on public.reminder_recipients (reminder_id, status);
create index reminder_targets_department_idx on public.reminder_targets (department_id);
create index reminder_targets_employee_idx on public.reminder_targets (employee_id);

create function internal_security.guard_reminder_update()
returns trigger
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.administration_id is distinct from old.administration_id
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.reminder_type is distinct from old.reminder_type
    or new.target_type is distinct from old.target_type
    or new.created_at is distinct from old.created_at then
    raise exception 'REMINDER_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;

  if old.reminder_type = 'PERSONAL' then
    if old.created_by_user_id <> (select auth.uid()) then
      raise exception 'REMINDER_FORBIDDEN' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
      or new.published_at is distinct from old.published_at
      or new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'PERSONAL_REMINDER_STATUS_IMMUTABLE' using errcode = '23514';
    end if;
  end if;

  if new.remind_at <= timezone('utc', now()) and new.remind_at is distinct from old.remind_at then
    raise exception 'REMINDER_IN_PAST' using errcode = '22023';
  end if;

  return new;
end;
$$;

create function internal_security.guard_reminder_target()
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
    or parent.status <> 'DRAFT'
    or (parent.target_type = 'DEPARTMENTS' and new.department_id is null)
    or (parent.target_type = 'EMPLOYEES' and new.employee_id is null)
    or parent.target_type not in ('DEPARTMENTS', 'EMPLOYEES') then
    raise exception 'REMINDER_TARGET_SCOPE_INVALID' using errcode = '23514';
  end if;

  return new;
end;
$$;

create function internal_security.guard_reminder_recipient_update()
returns trigger
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.reminder_id is distinct from old.reminder_id
    or new.user_id is distinct from old.user_id
    or new.employee_id is distinct from old.employee_id
    or new.created_at is distinct from old.created_at then
    raise exception 'REMINDER_RECIPIENT_IDENTITY_IMMUTABLE' using errcode = '23514';
  end if;

  if old.user_id <> (select auth.uid()) then
    raise exception 'REMINDER_RECIPIENT_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function internal_security.guard_reminder_update() from public, anon, authenticated;
revoke all on function internal_security.guard_reminder_target() from public, anon, authenticated;
revoke all on function internal_security.guard_reminder_recipient_update() from public, anon, authenticated;

create function internal_security.current_user_is_reminder_recipient(requested_reminder_id uuid)
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

create trigger guard_reminder_update before update on public.reminders
for each row execute function internal_security.guard_reminder_update();
create trigger guard_reminder_target before insert or update on public.reminder_targets
for each row execute function internal_security.guard_reminder_target();
create trigger guard_reminder_recipient_update before update on public.reminder_recipients
for each row execute function internal_security.guard_reminder_recipient_update();
create trigger set_reminders_updated_at before update on public.reminders
for each row execute function internal_security.set_updated_at();
create trigger set_reminder_recipients_updated_at before update on public.reminder_recipients
for each row execute function internal_security.set_updated_at();
create trigger audit_reminders after insert or update or delete on public.reminders
for each row execute function internal_security.audit_hr_change('reminder');
create trigger audit_reminder_targets after insert or update or delete on public.reminder_targets
for each row execute function internal_security.audit_hr_change('reminder_target');
create trigger audit_reminder_recipients after insert or update or delete on public.reminder_recipients
for each row execute function internal_security.audit_hr_change('reminder_recipient');

alter table public.reminders enable row level security;
alter table public.reminder_targets enable row level security;
alter table public.reminder_recipients enable row level security;

create policy reminders_select_self_or_hr on public.reminders for select to authenticated
using (
  created_by_user_id = (select auth.uid())
  or (select internal_security.current_user_is_reminder_recipient(reminders.id))
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
create policy reminders_update_owner_or_hr on public.reminders for update to authenticated
using (
  (reminder_type = 'PERSONAL' and created_by_user_id = (select auth.uid()))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write'))
)
with check (
  (reminder_type = 'PERSONAL' and target_type = 'SELF' and created_by_user_id = (select auth.uid()))
  or (reminder_type = 'HR' and (select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write')))
);
create policy reminders_delete_owner_or_hr on public.reminders for delete to authenticated
using (
  (reminder_type = 'PERSONAL' and created_by_user_id = (select auth.uid()))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'reminder:write'))
);

create policy reminder_targets_select_creator_or_hr on public.reminder_targets for select to authenticated
using (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and (reminder.created_by_user_id = (select auth.uid())
      or (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:read')))
));
create policy reminder_targets_write_hr on public.reminder_targets for all to authenticated
using (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and reminder.reminder_type = 'HR'
    and reminder.status = 'DRAFT'
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
))
with check (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_targets.reminder_id
    and reminder.reminder_type = 'HR'
    and reminder.status = 'DRAFT'
    and reminder.tenant_id = reminder_targets.tenant_id
    and reminder.administration_id is not distinct from reminder_targets.administration_id
    and (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
));

create policy reminder_recipients_select_self on public.reminder_recipients for select to authenticated
using (user_id = (select auth.uid()));
create policy reminder_recipients_insert_hr on public.reminder_recipients for insert to authenticated
with check (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_recipients.reminder_id
    and reminder.tenant_id = reminder_recipients.tenant_id
    and (
      (reminder.reminder_type = 'PERSONAL' and reminder.created_by_user_id = (select auth.uid()) and reminder_recipients.user_id = (select auth.uid()))
      or (select internal_security.current_user_has_permission(reminder.tenant_id, reminder.administration_id, 'reminder:write'))
    )
));
create policy reminder_recipients_update_self on public.reminder_recipients for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy reminder_recipients_delete_hr on public.reminder_recipients for delete to authenticated
using (exists (
  select 1 from public.reminders reminder
  where reminder.id = reminder_recipients.reminder_id
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
  if reminder_row.target_type in ('DEPARTMENTS', 'EMPLOYEES') and not exists (
    select 1 from public.reminder_targets target where target.reminder_id = reminder_row.id
  ) then
    raise exception 'REMINDER_TARGETS_REQUIRED' using errcode = '22023';
  end if;

  if reminder_row.target_type = 'EVERYONE' then
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select reminder_row.tenant_id, reminder_row.id, e.auth_user_id, e.id, reminder_row.remind_at
    from public.employees e
    where e.auth_user_id is not null
      and e.tenant_id = reminder_row.tenant_id
      and e.deleted_at is null
      and e.is_active
      and (reminder_row.administration_id is null
       or exists (select 1 from public.employee_organizations eo where eo.employee_id = e.id and eo.administration_id = reminder_row.administration_id and eo.effective_from <= reminder_row.remind_at::date and (eo.effective_to is null or eo.effective_to >= reminder_row.remind_at::date)));
  elsif reminder_row.target_type = 'DEPARTMENTS' then
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select distinct reminder_row.tenant_id, reminder_row.id, e.auth_user_id, e.id, reminder_row.remind_at
    from public.reminder_targets target
    join public.employee_organizations eo on eo.department_id = target.department_id and eo.effective_from <= reminder_row.remind_at::date and (eo.effective_to is null or eo.effective_to >= reminder_row.remind_at::date)
    join public.employees e on e.id = eo.employee_id and e.auth_user_id is not null and e.is_active and e.deleted_at is null
    where target.reminder_id = reminder_row.id;
  else
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at)
    select reminder_row.tenant_id, reminder_row.id, e.auth_user_id, e.id, reminder_row.remind_at
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

create or replace function public.create_personal_reminder(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_title text,
  requested_description text,
  requested_remind_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  created_reminder_id uuid;
  actor_employee_id uuid;
begin
  if requested_remind_at <= timezone('utc', now()) then
    raise exception 'REMINDER_IN_PAST' using errcode = '22023';
  end if;
  if not internal_security.has_tenant_access(requested_tenant_id)
    or (requested_administration_id is not null and not internal_security.has_administration_access(requested_tenant_id, requested_administration_id)) then
    raise exception 'REMINDER_FORBIDDEN' using errcode = '42501';
  end if;

  select employee.id into actor_employee_id
  from public.employees employee
  where employee.tenant_id = requested_tenant_id
    and employee.auth_user_id = (select auth.uid())
    and employee.deleted_at is null
  limit 1;

  insert into public.reminders (
    tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
    title, description, remind_at, status, published_at
  ) values (
    requested_tenant_id, requested_administration_id, (select auth.uid()), 'PERSONAL', 'SELF',
    btrim(requested_title), nullif(btrim(requested_description), ''), requested_remind_at, 'PUBLISHED', timezone('utc', now())
  ) returning id into created_reminder_id;

  insert into public.reminder_recipients (
    tenant_id, reminder_id, user_id, employee_id, effective_remind_at
  ) values (
    requested_tenant_id, created_reminder_id, (select auth.uid()), actor_employee_id, requested_remind_at
  );

  return created_reminder_id;
end;
$$;

revoke all on function public.create_personal_reminder(uuid, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.create_personal_reminder(uuid, uuid, text, text, timestamptz) to authenticated;

create or replace function public.update_personal_reminder(
  requested_reminder_id uuid,
  requested_title text,
  requested_description text,
  requested_remind_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
begin
  if requested_remind_at <= timezone('utc', now()) then
    raise exception 'REMINDER_IN_PAST' using errcode = '22023';
  end if;

  update public.reminders
  set title = btrim(requested_title),
      description = nullif(btrim(requested_description), ''),
      remind_at = requested_remind_at
  where id = requested_reminder_id
    and reminder_type = 'PERSONAL'
    and created_by_user_id = (select auth.uid());

  if not found then
    raise exception 'REMINDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.reminder_recipients
  set effective_remind_at = requested_remind_at,
      snoozed_from = null
  where reminder_id = requested_reminder_id
    and user_id = (select auth.uid())
    and status = 'PENDING';
end;
$$;

revoke all on function public.update_personal_reminder(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.update_personal_reminder(uuid, text, text, timestamptz) to authenticated;

create or replace function public.create_hr_reminder(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_title text,
  requested_description text,
  requested_remind_at timestamptz,
  requested_target_type public.reminder_target_type,
  requested_target_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  created_reminder_id uuid;
  inserted_target_count integer;
  expected_target_count integer := coalesce(cardinality(requested_target_ids), 0);
begin
  if not internal_security.current_user_has_permission(
    requested_tenant_id, requested_administration_id, 'reminder:write'
  ) then
    raise exception 'REMINDER_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_remind_at <= timezone('utc', now()) then
    raise exception 'REMINDER_IN_PAST' using errcode = '22023';
  end if;
  if requested_target_type not in ('EVERYONE', 'DEPARTMENTS', 'EMPLOYEES')
    or (requested_target_type = 'EVERYONE' and expected_target_count <> 0)
    or (requested_target_type in ('DEPARTMENTS', 'EMPLOYEES') and expected_target_count = 0) then
    raise exception 'REMINDER_TARGET_SCOPE_INVALID' using errcode = '22023';
  end if;

  insert into public.reminders (
    tenant_id, administration_id, created_by_user_id, reminder_type, target_type,
    title, description, remind_at, status
  ) values (
    requested_tenant_id, requested_administration_id, (select auth.uid()), 'HR', requested_target_type,
    btrim(requested_title), nullif(btrim(requested_description), ''), requested_remind_at, 'DRAFT'
  ) returning id into created_reminder_id;

  if requested_target_type = 'DEPARTMENTS' then
    insert into public.reminder_targets (
      tenant_id, administration_id, reminder_id, department_id
    )
    select requested_tenant_id, requested_administration_id, created_reminder_id, department.id
    from public.departments department
    where department.tenant_id = requested_tenant_id
      and department.administration_id = requested_administration_id
      and department.id = any(requested_target_ids);
    get diagnostics inserted_target_count = row_count;
  elsif requested_target_type = 'EMPLOYEES' then
    insert into public.reminder_targets (
      tenant_id, administration_id, reminder_id, employee_id
    )
    select requested_tenant_id, requested_administration_id, created_reminder_id, employee.id
    from public.employees employee
    where employee.tenant_id = requested_tenant_id
      and employee.deleted_at is null
      and employee.id = any(requested_target_ids);
    get diagnostics inserted_target_count = row_count;
  else
    inserted_target_count := 0;
  end if;

  if inserted_target_count <> expected_target_count then
    raise exception 'REMINDER_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  return created_reminder_id;
end;
$$;

revoke all on function public.create_hr_reminder(uuid, uuid, text, text, timestamptz, public.reminder_target_type, uuid[]) from public, anon;
grant execute on function public.create_hr_reminder(uuid, uuid, text, text, timestamptz, public.reminder_target_type, uuid[]) to authenticated;

create or replace function public.update_reminder_recipient(
  requested_recipient_id uuid,
  requested_action text,
  requested_remind_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
begin
  if requested_action = 'SNOOZE' then
    if requested_remind_at is null or requested_remind_at <= timezone('utc', now()) then
      raise exception 'REMINDER_IN_PAST' using errcode = '22023';
    end if;
    update public.reminder_recipients
    set status = 'PENDING', snoozed_from = effective_remind_at,
        effective_remind_at = requested_remind_at, completed_at = null, dismissed_at = null
    where id = requested_recipient_id and user_id = (select auth.uid());
  elsif requested_action = 'COMPLETE' then
    update public.reminder_recipients
    set status = 'COMPLETED', completed_at = timezone('utc', now()), dismissed_at = null
    where id = requested_recipient_id and user_id = (select auth.uid());
  elsif requested_action = 'DISMISS' then
    update public.reminder_recipients
    set status = 'DISMISSED', dismissed_at = timezone('utc', now()), completed_at = null
    where id = requested_recipient_id and user_id = (select auth.uid());
  else
    raise exception 'REMINDER_ACTION_INVALID' using errcode = '22023';
  end if;

  if not found then raise exception 'REMINDER_RECIPIENT_NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.update_reminder_recipient(uuid, text, timestamptz) from public, anon;
grant execute on function public.update_reminder_recipient(uuid, text, timestamptz) to authenticated;
