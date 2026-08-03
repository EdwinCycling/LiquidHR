begin;

create table public.talent_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_employee_id uuid not null,
  event_type text not null check (event_type in ('GOAL_OPEN', 'ASSESSMENT_PENDING', 'IMPORT_COMPLETED', 'QUALIFICATION_EXPIRING', 'CHECKIN_DUE')),
  title text not null check (length(btrim(title)) between 1 and 160),
  summary text not null check (length(btrim(summary)) between 1 and 500),
  source_entity_id uuid,
  status text not null default 'OPEN' check (status in ('OPEN', 'READ', 'DONE', 'DISMISSED')),
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  handled_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  foreign key (tenant_id, recipient_employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  check ((status = 'OPEN' and read_at is null and handled_at is null)
    or (status = 'READ' and read_at is not null and handled_at is null)
    or (status in ('DONE', 'DISMISSED') and handled_at is not null))
);

create unique index talent_notifications_dedupe_idx
  on public.talent_notifications (tenant_id, event_type, source_entity_id, recipient_employee_id)
  where source_entity_id is not null;
create index talent_notifications_recipient_idx
  on public.talent_notifications (recipient_user_id, status, created_at desc);
create index talent_notifications_tenant_idx
  on public.talent_notifications (tenant_id, event_type, created_at desc);

create table public.talent_goal_check_ins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  goal_id uuid not null,
  employee_id uuid not null,
  entry_type text not null check (entry_type in ('EMPLOYEE_REFLECTION', 'MANAGER_OBSERVATION', 'FOLLOW_UP')),
  author_user_id uuid not null references auth.users(id) on delete restrict,
  author_employee_id uuid,
  body text not null check (length(btrim(body)) between 1 and 4000),
  follow_up_title text check (follow_up_title is null or length(btrim(follow_up_title)) between 1 and 160),
  follow_up_due_on date,
  status text not null default 'OPEN' check (status in ('OPEN', 'COMPLETED', 'CANCELLED')),
  version integer not null default 1 check (version > 0),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  foreign key (tenant_id, goal_id)
    references public.talent_development_goals(tenant_id, id) on delete cascade,
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id) on delete cascade,
  check ((entry_type = 'FOLLOW_UP' and follow_up_title is not null)
    or entry_type <> 'FOLLOW_UP'),
  check ((status = 'COMPLETED' and completed_at is not null)
    or status <> 'COMPLETED')
);

create index talent_goal_check_ins_goal_idx
  on public.talent_goal_check_ins (tenant_id, goal_id, created_at desc);
create index talent_goal_check_ins_employee_idx
  on public.talent_goal_check_ins (tenant_id, employee_id, entry_type, created_at desc);
create index talent_goal_check_ins_due_idx
  on public.talent_goal_check_ins (tenant_id, follow_up_due_on, status)
  where follow_up_due_on is not null;

create or replace function internal_security.validate_talent_goal_check_in()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_employee_id uuid;
begin
  select goal.employee_id into goal_employee_id
  from public.talent_development_goals goal
  where goal.tenant_id = new.tenant_id
    and goal.id = new.goal_id;
  if goal_employee_id is null then
    raise exception 'TALENT_GOAL_NOT_FOUND';
  end if;
  new.employee_id := goal_employee_id;
  new.body := btrim(new.body);
  new.follow_up_title := nullif(btrim(new.follow_up_title), '');
  if new.author_user_id is distinct from (select auth.uid()) then
    raise exception 'TALENT_CHECKIN_AUTHOR_IMMUTABLE';
  end if;
  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id
      or new.goal_id is distinct from old.goal_id
      or new.employee_id is distinct from old.employee_id
      or new.entry_type is distinct from old.entry_type
      or new.author_user_id is distinct from old.author_user_id
      or new.author_employee_id is distinct from old.author_employee_id
      or new.created_at is distinct from old.created_at then
      raise exception 'TALENT_CHECKIN_IDENTITY_IMMUTABLE';
    end if;
    if new.version <> old.version + 1 then
      raise exception 'TALENT_CHECKIN_VERSION_CONFLICT';
    end if;
  end if;
  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_goal_check_in() from public, anon, authenticated;
create trigger validate_talent_goal_check_in
before insert or update on public.talent_goal_check_ins
for each row execute function internal_security.validate_talent_goal_check_in();
create trigger set_talent_goal_check_ins_updated_at
before update on public.talent_goal_check_ins
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.audit_talent_goal_check_in()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_data jsonb;
  after_data jsonb;
begin
  before_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  after_data := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    'talent_goal_check_in',
    coalesce(new.id, old.id),
    auth.uid(),
    case when tg_op = 'INSERT' then 'CREATE' when tg_op = 'DELETE' then 'DELETE' else 'UPDATE' end,
    jsonb_build_object(
      'before', before_data - array['body'],
      'after', after_data - array['body'],
      'source_channel', 'WEB'
    )
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_goal_check_in() from public, anon, authenticated;
create trigger audit_talent_goal_check_ins
after insert or update or delete on public.talent_goal_check_ins
for each row execute function internal_security.audit_talent_goal_check_in();

create or replace function internal_security.audit_talent_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    new.tenant_id,
    'talent_notification',
    new.id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end,
    jsonb_build_object(
      'event_type', new.event_type,
      'status', new.status,
      'recipient_employee_id', new.recipient_employee_id,
      'source_entity_id', new.source_entity_id,
      'source_channel', 'WEB'
    )
  );
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_notification() from public, anon, authenticated;
create trigger audit_talent_notifications
after insert or update on public.talent_notifications
for each row execute function internal_security.audit_talent_notification();

alter table public.talent_notifications enable row level security;
alter table public.talent_goal_check_ins enable row level security;

create policy talent_notifications_select
on public.talent_notifications for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
);
create policy talent_notifications_insert
on public.talent_notifications for insert to authenticated
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    recipient_employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (select internal_security.can_manage_employee(recipient_employee_id, 'talent-goal:write'))
);
create policy talent_notifications_update
on public.talent_notifications for update to authenticated
using (
  recipient_user_id = (select auth.uid())
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
)
with check (
  recipient_user_id = (select auth.uid())
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
);

create policy talent_goal_check_ins_select
on public.talent_goal_check_ins for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    entry_type = 'EMPLOYEE_REFLECTION'
    and employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:read'))
  )
  or (
    entry_type <> 'EMPLOYEE_REFLECTION'
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:read'))
  )
);
create policy talent_goal_check_ins_insert
on public.talent_goal_check_ins for insert to authenticated
with check (
  (
    entry_type = 'EMPLOYEE_REFLECTION'
    and employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    entry_type <> 'EMPLOYEE_REFLECTION'
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
  )
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
);
create policy talent_goal_check_ins_update
on public.talent_goal_check_ins for update to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    entry_type = 'EMPLOYEE_REFLECTION'
    and employee_id = (select internal_security.current_employee_id())
    and status = 'OPEN'
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    entry_type <> 'EMPLOYEE_REFLECTION'
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
  )
)
with check (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent-goal:manage'))
  or (
    entry_type = 'EMPLOYEE_REFLECTION'
    and employee_id = (select internal_security.current_employee_id())
    and (select internal_security.current_user_has_permission(tenant_id, null, 'self:talent-goal:write'))
  )
  or (
    entry_type <> 'EMPLOYEE_REFLECTION'
    and (select internal_security.can_manage_employee(employee_id, 'talent-goal:write'))
  )
);

create or replace function public.create_talent_notification(
  requested_tenant_id uuid,
  requested_recipient_employee_id uuid,
  requested_event_type text,
  requested_title text,
  requested_summary text,
  requested_source_entity_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  recipient_user uuid;
  notification_id uuid;
begin
  if requested_event_type not in ('GOAL_OPEN', 'ASSESSMENT_PENDING', 'IMPORT_COMPLETED', 'QUALIFICATION_EXPIRING', 'CHECKIN_DUE') then
    raise exception 'TALENT_NOTIFICATION_EVENT_INVALID';
  end if;
  if not internal_security.has_tenant_access(requested_tenant_id) then
    raise exception 'TALENT_NOTIFICATION_FORBIDDEN' using errcode = '42501';
  end if;
  select employee.auth_user_id into recipient_user
  from public.employees employee
  where employee.tenant_id = requested_tenant_id
    and employee.id = requested_recipient_employee_id
    and employee.deleted_at is null
    and employee.is_active;
  if recipient_user is null then
    raise exception 'TALENT_NOTIFICATION_RECIPIENT_NOT_FOUND';
  end if;
  insert into public.talent_notifications (
    tenant_id, recipient_user_id, recipient_employee_id, event_type, title, summary, source_entity_id
  ) values (
    requested_tenant_id, recipient_user, requested_recipient_employee_id, requested_event_type,
    btrim(requested_title), btrim(requested_summary), requested_source_entity_id
  )
  on conflict (tenant_id, event_type, source_entity_id, recipient_employee_id)
    where source_entity_id is not null
  do update set updated_at = timezone('utc', now())
  returning id into notification_id;
  return notification_id;
end;
$$;

revoke all on function public.create_talent_notification(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.create_talent_notification(uuid, uuid, text, text, text, uuid) to authenticated;
revoke all on table public.talent_notifications from public, anon;
grant select, insert, update on table public.talent_notifications to authenticated;
revoke all on table public.talent_goal_check_ins from public, anon;
grant select, insert, update on table public.talent_goal_check_ins to authenticated;

commit;
