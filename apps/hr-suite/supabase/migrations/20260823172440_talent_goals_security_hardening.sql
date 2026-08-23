begin;

-- Terminal goal history remains readable through the existing SELECT policies.
-- Only content mutations are blocked: open check-ins may be listed/read after a
-- goal becomes COMPLETED, CANCELLED or ARCHIVED, but may not be updated.

create or replace function internal_security.validate_talent_development_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.title := pg_catalog.btrim(new.title);
  new.description := nullif(pg_catalog.btrim(new.description), '');

  if tg_op = 'UPDATE' then
    if new.version <> old.version + 1 then
      raise exception 'TALENT_GOAL_VERSION_CONFLICT';
    end if;
    if new.tenant_id is distinct from old.tenant_id
      or new.employee_id is distinct from old.employee_id
      or new.source_type is distinct from old.source_type
      or new.created_by_user_id is distinct from old.created_by_user_id
      or new.created_at is distinct from old.created_at then
      raise exception 'TALENT_GOAL_IDENTITY_IMMUTABLE';
    end if;
    if old.status = 'ARCHIVED' then
      raise exception 'TALENT_GOAL_ARCHIVED_LOCKED';
    end if;
    if old.status = 'COMPLETED' and new.status not in ('COMPLETED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_COMPLETED_LOCKED';
    end if;
    if old.status = 'CANCELLED' and new.status not in ('CANCELLED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_CANCELLED_LOCKED';
    end if;
    if old.status = 'DRAFT' and new.status not in ('DRAFT', 'ACTIVE', 'CANCELLED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_TRANSITION_INVALID';
    end if;
    if old.status = 'ACTIVE' and new.status not in ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED') then
      raise exception 'TALENT_GOAL_TRANSITION_INVALID';
    end if;
  end if;

  -- Preserve an existing historical completion timestamp, but never accept a
  -- caller value when the transition itself makes the goal completed.
  if tg_op = 'UPDATE' and old.status = 'COMPLETED' then
    new.completed_at := old.completed_at;
  elsif new.status = 'COMPLETED' then
    new.completed_at := pg_catalog.timezone('utc', pg_catalog.now());
  else
    new.completed_at := null;
  end if;

  -- The same rule applies to archive timestamps. Archiving a completed goal
  -- does not rewrite its historical completed_at value.
  if tg_op = 'UPDATE' and old.status = 'ARCHIVED' then
    new.archived_at := old.archived_at;
  elsif new.status = 'ARCHIVED' then
    new.archived_at := pg_catalog.timezone('utc', pg_catalog.now());
  else
    new.archived_at := null;
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_talent_development_goal() from public, anon, authenticated;

create or replace function internal_security.audit_talent_development_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    before_data := pg_catalog.to_jsonb(old);
    after_data := '{}'::jsonb;
    audit_action := 'DELETE';
  else
    before_data := case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else '{}'::jsonb end;
    after_data := pg_catalog.to_jsonb(new);
    audit_action := case
      when tg_op = 'INSERT' then 'CREATE'
      when new.status = 'ARCHIVED' and (tg_op = 'INSERT' or old.status <> 'ARCHIVED') then 'ARCHIVE'
      else 'UPDATE'
    end;
  end if;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    'talent_development_goal',
    coalesce(new.id, old.id),
    auth.uid(),
    audit_action,
    pg_catalog.jsonb_build_object(
      'before', before_data - array['description'],
      'after', after_data - array['description'],
      'source_channel', 'WEB'
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_development_goal() from public, anon, authenticated;

create or replace function internal_security.validate_talent_goal_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  goal_employee_id uuid;
  goal_status text;
begin
  select goal.employee_id, goal.status
    into goal_employee_id, goal_status
  from public.talent_development_goals goal
  where goal.tenant_id = new.tenant_id
    and goal.id = new.goal_id;

  if goal_employee_id is null then
    raise exception 'TALENT_GOAL_NOT_FOUND';
  end if;
  if tg_op = 'INSERT' and goal_status <> 'ACTIVE' then
    raise exception 'TALENT_CHECKIN_GOAL_NOT_ACTIVE';
  end if;
  if tg_op = 'UPDATE' and old.status = 'OPEN' and goal_status <> 'ACTIVE' then
    raise exception 'TALENT_CHECKIN_GOAL_TERMINAL_LOCKED';
  end if;

  new.employee_id := goal_employee_id;
  new.body := pg_catalog.btrim(new.body);
  new.follow_up_title := nullif(pg_catalog.btrim(new.follow_up_title), '');

  if tg_op = 'INSERT' and new.author_user_id is distinct from (select auth.uid()) then
    raise exception 'TALENT_CHECKIN_AUTHOR_IMMUTABLE';
  end if;

  if new.entry_type <> 'FOLLOW_UP'
    and (new.follow_up_title is not null or new.follow_up_due_on is not null) then
    raise exception 'TALENT_CHECKIN_FOLLOW_UP_NOT_ALLOWED';
  end if;
  if new.entry_type = 'FOLLOW_UP' and new.follow_up_title is null then
    raise exception 'TALENT_CHECKIN_FOLLOW_UP_TITLE_REQUIRED';
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
    if old.status <> 'OPEN' then
      raise exception 'TALENT_CHECKIN_STATUS_LOCKED';
    end if;
  end if;

  -- Updates keep the historical completion timestamp; a new completion always
  -- uses the database clock and ignores any caller-supplied value.
  if tg_op = 'UPDATE' and old.completed_at is not null then
    new.completed_at := old.completed_at;
  elsif new.status = 'COMPLETED' then
    new.completed_at := pg_catalog.timezone('utc', pg_catalog.now());
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function internal_security.validate_talent_goal_check_in() from public, anon, authenticated;

create or replace function internal_security.audit_talent_goal_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
begin
  before_data := case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else '{}'::jsonb end;
  after_data := case when tg_op = 'DELETE' then '{}'::jsonb else pg_catalog.to_jsonb(new) end;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    'talent_goal_check_in',
    coalesce(new.id, old.id),
    auth.uid(),
    case when tg_op = 'INSERT' then 'CREATE' when tg_op = 'DELETE' then 'DELETE' else 'UPDATE' end,
    pg_catalog.jsonb_build_object(
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

create or replace function internal_security.audit_talent_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    new.tenant_id,
    'talent_notification',
    new.id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end,
    pg_catalog.jsonb_build_object(
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

drop policy if exists talent_goal_check_ins_update on public.talent_goal_check_ins;
create policy talent_goal_check_ins_update
on public.talent_goal_check_ins for update to authenticated
using (
  status = 'OPEN'
  and exists (
    select 1
    from public.talent_development_goals goal
    where goal.tenant_id = talent_goal_check_ins.tenant_id
      and goal.id = talent_goal_check_ins.goal_id
      and goal.status = 'ACTIVE'
  )
  and (
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
  )
)
with check (
  exists (
    select 1
    from public.talent_development_goals goal
    where goal.tenant_id = talent_goal_check_ins.tenant_id
      and goal.id = talent_goal_check_ins.goal_id
      and goal.status = 'ACTIVE'
  )
  and (
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
  )
);

commit;
