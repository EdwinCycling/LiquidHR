begin;

alter table public.talent_goal_check_ins
  add constraint talent_goal_check_ins_follow_up_due_on_check
  check (follow_up_due_on is null or entry_type = 'FOLLOW_UP');

create or replace function internal_security.validate_talent_development_goal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.title := btrim(new.title);
  new.description := nullif(btrim(new.description), '');
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
    if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
      raise exception 'TALENT_GOAL_COMPLETED_AT_IMMUTABLE';
    end if;
    if old.archived_at is not null and new.archived_at is distinct from old.archived_at then
      raise exception 'TALENT_GOAL_ARCHIVED_AT_IMMUTABLE';
    end if;
  end if;
  if new.status <> 'COMPLETED' and new.completed_at is not null then
    raise exception 'TALENT_GOAL_COMPLETED_AT_INVALID';
  end if;
  if new.status <> 'ARCHIVED' and new.archived_at is not null then
    raise exception 'TALENT_GOAL_ARCHIVED_AT_INVALID';
  end if;
  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
  end if;
  if new.status = 'ARCHIVED' and (tg_op = 'INSERT' or old.status is distinct from 'ARCHIVED') then
    new.archived_at := coalesce(new.archived_at, timezone('utc', now()));
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_development_goal() from public, anon, authenticated;

create or replace function internal_security.validate_talent_goal_check_in()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_employee_id uuid;
  goal_status text;
begin
  select goal.employee_id, goal.status into goal_employee_id, goal_status
  from public.talent_development_goals goal
  where goal.tenant_id = new.tenant_id
    and goal.id = new.goal_id;
  if goal_employee_id is null then
    raise exception 'TALENT_GOAL_NOT_FOUND';
  end if;
  if tg_op = 'INSERT' and goal_status <> 'ACTIVE' then
    raise exception 'TALENT_CHECKIN_GOAL_NOT_ACTIVE';
  end if;
  new.employee_id := goal_employee_id;
  new.body := btrim(new.body);
  new.follow_up_title := nullif(btrim(new.follow_up_title), '');
  if new.author_user_id is distinct from (select auth.uid()) then
    raise exception 'TALENT_CHECKIN_AUTHOR_IMMUTABLE';
  end if;
  if new.entry_type <> 'FOLLOW_UP' and (new.follow_up_title is not null or new.follow_up_due_on is not null) then
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
    if old.status = 'COMPLETED' and new.status <> 'COMPLETED' then
      raise exception 'TALENT_CHECKIN_COMPLETED_LOCKED';
    end if;
    if old.status = 'CANCELLED' and new.status <> 'CANCELLED' then
      raise exception 'TALENT_CHECKIN_CANCELLED_LOCKED';
    end if;
    if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
      raise exception 'TALENT_CHECKIN_COMPLETED_AT_IMMUTABLE';
    end if;
  end if;
  if new.status <> 'COMPLETED' and new.completed_at is not null then
    raise exception 'TALENT_CHECKIN_COMPLETED_AT_INVALID';
  end if;
  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status is distinct from 'COMPLETED') then
    new.completed_at := coalesce(new.completed_at, timezone('utc', now()));
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_talent_goal_check_in() from public, anon, authenticated;

drop policy if exists talent_goal_check_ins_update on public.talent_goal_check_ins;
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
    and status = 'OPEN'
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

commit;
