begin;

alter table public.audit_logs
  drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
    check (action in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL', 'EXPORT', 'START', 'STOP', 'READ', 'STATUS_TRANSITION', 'SOFT_DELETE'));

alter table public.continuous_appraisal_items
  add column deleted_at timestamptz,
  add column deleted_by_user_id uuid;

alter table public.continuous_appraisal_items
  drop constraint continuous_appraisal_items_item_status_check,
  add constraint continuous_appraisal_items_item_status_check
    check (item_status in ('PLANNED', 'OPEN', 'WAITING', 'ACTIVE', 'DONE', 'NOT_RELEVANT', 'CANCELLED', 'ARCHIVED'));

create index continuous_appraisal_items_visible_employee_date_idx
  on public.continuous_appraisal_items (tenant_id, employee_id, occurred_on desc, created_at desc)
  where deleted_at is null;

create or replace function internal_security.validate_continuous_appraisal_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null or new.deleted_by_user_id is not null or new.item_status = 'NOT_RELEVANT' then
      raise exception 'CONTINUOUS_APPRAISAL_STATUS_TRANSITION_INVALID';
    end if;
    if new.item_type = 'SYSTEM_EVENT' then
      return new;
    end if;
    if new.created_by_employee_id <> internal_security.current_employee_id()
      and not internal_security.current_user_has_permission(new.tenant_id, null, 'continuous-appraisal:manage') then
      raise exception 'CONTINUOUS_APPRAISAL_CREATOR_INVALID';
    end if;
    if new.item_type = 'FEEDBACK'
      and not (
        internal_security.current_user_has_permission(new.tenant_id, null, 'continuous-appraisal:manage')
        or internal_security.can_manage_employee(new.employee_id, 'continuous-appraisal:write')
      ) then
      raise exception 'CONTINUOUS_APPRAISAL_FEEDBACK_MANAGER_ONLY';
    end if;
    return new;
  end if;

  if new.tenant_id <> old.tenant_id
    or new.employee_id <> old.employee_id
    or new.created_by_employee_id <> old.created_by_employee_id
    or new.item_type <> old.item_type
    or new.occurred_on <> old.occurred_on then
    raise exception 'CONTINUOUS_APPRAISAL_IDENTITY_IMMUTABLE';
  end if;

  if new.item_status is distinct from old.item_status
    and current_setting('app.continuous_appraisal_status_transition', true) is distinct from 'on' then
    raise exception 'CONTINUOUS_APPRAISAL_STATUS_TRANSITION_INVALID';
  end if;
  if (new.deleted_at is distinct from old.deleted_at or new.deleted_by_user_id is distinct from old.deleted_by_user_id)
    and current_setting('app.continuous_appraisal_soft_delete', true) is distinct from 'on' then
    raise exception 'CONTINUOUS_APPRAISAL_SOFT_DELETE_INVALID';
  end if;

  if old.occurred_on < current_date and (
    new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.due_on is distinct from old.due_on
    or new.next_meeting_on is distinct from old.next_meeting_on
    or new.priority is distinct from old.priority
    or new.owner_employee_id is distinct from old.owner_employee_id
    or new.owner_label is distinct from old.owner_label
  ) then
    raise exception 'CONTINUOUS_APPRAISAL_PAST_IMMUTABLE';
  end if;

  if new.version <> old.version + 1 then
    raise exception 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT';
  end if;
  return new;
end;
$$;

revoke all on function internal_security.validate_continuous_appraisal_item() from public, anon, authenticated;

create or replace function internal_security.audit_continuous_appraisal_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_value uuid := coalesce(new.tenant_id, old.tenant_id);
  entity_value uuid := coalesce(new.id, old.id);
  action_value text := case
    when tg_op = 'INSERT' then 'CREATE'
    when tg_op = 'DELETE' then 'DELETE'
    when old.deleted_at is null and new.deleted_at is not null then 'SOFT_DELETE'
    when new.item_status is distinct from old.item_status then 'STATUS_TRANSITION'
    else 'UPDATE'
  end;
begin
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    tenant_value,
    tg_table_name,
    entity_value,
    (select auth.uid()),
    action_value,
    jsonb_build_object(
      'before', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end,
      'after', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end,
      'source', 'CONTINUOUS_APPRAISAL'
    )
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_continuous_appraisal_change() from public, anon, authenticated;

create policy continuous_appraisal_items_not_deleted
on public.continuous_appraisal_items as restrictive for all to authenticated
using (deleted_at is null)
with check (deleted_at is null);

revoke update on public.continuous_appraisal_items from authenticated;
revoke delete, truncate on public.continuous_appraisal_items from authenticated;
grant update (title, body, due_on, next_meeting_on, priority, owner_employee_id, owner_label, version)
  on public.continuous_appraisal_items to authenticated;
revoke insert on public.continuous_appraisal_items from authenticated;
grant insert (tenant_id, employee_id, manager_employee_id, created_by_employee_id, created_by_user_id,
  created_by_label, created_by_avatar_url, owner_employee_id, owner_label, item_type, goal_kind,
  feedback_direction, title, body, occurred_on, due_on, next_meeting_on, item_status, priority)
  on public.continuous_appraisal_items to authenticated;

create or replace function public.transition_continuous_appraisal_item_status(
  p_item_id uuid,
  p_expected_version integer,
  p_item_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.continuous_appraisal_items%rowtype;
  actor_employee_id uuid := internal_security.current_employee_id();
  updated_id uuid;
  updated_version integer;
begin
  if auth.uid() is null or actor_employee_id is null then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_FORBIDDEN';
  end if;

  select * into item_row
  from public.continuous_appraisal_items
  where id = p_item_id
  for update;
  if not found or item_row.deleted_at is not null then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND';
  end if;
  if item_row.item_type not in ('ACTION', 'AGREEMENT', 'GOAL') then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_FORBIDDEN';
  end if;
  if not (
    (item_row.employee_id = actor_employee_id and internal_security.current_employee_has_permission('self:continuous-appraisal:write'))
    or internal_security.current_user_has_permission(item_row.tenant_id, null, 'continuous-appraisal:manage')
    or internal_security.can_manage_employee(item_row.employee_id, 'continuous-appraisal:write')
  ) then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_FORBIDDEN';
  end if;
  if p_expected_version <> item_row.version then
    raise exception 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT';
  end if;
  if p_item_status not in ('DONE', 'NOT_RELEVANT')
    or item_row.item_status not in ('PLANNED', 'OPEN', 'WAITING', 'ACTIVE') then
    raise exception 'CONTINUOUS_APPRAISAL_STATUS_TRANSITION_INVALID';
  end if;

  perform set_config('app.continuous_appraisal_status_transition', 'on', true);
  update public.continuous_appraisal_items
  set item_status = p_item_status, version = version + 1
  where id = p_item_id and version = p_expected_version
  returning id, version into updated_id, updated_version;
  if updated_id is null then
    raise exception 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT';
  end if;
  return jsonb_build_object('id', updated_id, 'version', updated_version);
end;
$$;

create or replace function public.soft_delete_continuous_appraisal_item(
  p_item_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.continuous_appraisal_items%rowtype;
  actor_employee_id uuid := internal_security.current_employee_id();
  updated_id uuid;
  updated_version integer;
begin
  if auth.uid() is null or actor_employee_id is null then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_FORBIDDEN';
  end if;

  select * into item_row
  from public.continuous_appraisal_items
  where id = p_item_id
  for update;
  if not found or item_row.deleted_at is not null then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_NOT_FOUND';
  end if;
  if (item_row.created_by_employee_id <> actor_employee_id and item_row.owner_employee_id <> actor_employee_id)
    or item_row.item_type = 'SYSTEM_EVENT' then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_FORBIDDEN';
  end if;
  if not (
    (item_row.employee_id = actor_employee_id and internal_security.current_employee_has_permission('self:continuous-appraisal:write'))
    or internal_security.current_user_has_permission(item_row.tenant_id, null, 'continuous-appraisal:manage')
    or internal_security.can_manage_employee(item_row.employee_id, 'continuous-appraisal:write')
  ) then
    raise exception 'CONTINUOUS_APPRAISAL_ITEM_FORBIDDEN';
  end if;
  if item_row.occurred_on < current_date then
    raise exception 'CONTINUOUS_APPRAISAL_PAST_IMMUTABLE';
  end if;
  if p_expected_version <> item_row.version then
    raise exception 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT';
  end if;

  perform set_config('app.continuous_appraisal_soft_delete', 'on', true);
  update public.continuous_appraisal_items
  set deleted_at = timezone('utc', now()), deleted_by_user_id = auth.uid(), version = version + 1
  where id = p_item_id and version = p_expected_version
  returning id, version into updated_id, updated_version;
  if updated_id is null then
    raise exception 'CONTINUOUS_APPRAISAL_VERSION_CONFLICT';
  end if;
  return jsonb_build_object('id', updated_id, 'version', updated_version);
end;
$$;

revoke all on function public.transition_continuous_appraisal_item_status(uuid, integer, text) from public, anon;
revoke all on function public.soft_delete_continuous_appraisal_item(uuid, integer) from public, anon;
grant execute on function public.transition_continuous_appraisal_item_status(uuid, integer, text) to authenticated;
grant execute on function public.soft_delete_continuous_appraisal_item(uuid, integer) to authenticated;

commit;
