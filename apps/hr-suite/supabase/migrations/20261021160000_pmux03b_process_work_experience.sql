begin;

create or replace function internal_security.get_process_work_item_experience(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  definition_content jsonb;
  current_step jsonb;
  step_titles jsonb;
  history jsonb;
  change_requests jsonb;
  next_routes jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id;
  if item_row.id is null then
    raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.process_work_item_can_read(item_row.tenant_id, item_row.hr_group_id, item_row.id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id;
  if instance_row.id is null then
    raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select internal_security.process_definition_content(version.definition_json)
    into definition_content
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.process_definition_id = instance_row.process_definition_id
    and version.id = instance_row.process_version_id;
  if definition_content is null then
    raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select step.value into current_step
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) as step(value)
  where step.value ->> 'key' = item_row.step_key
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'stepKey', step.value ->> 'key',
    'title', internal_security.process_localized_text(step.value -> 'title', requested_language, step.value ->> 'key')
  ) order by step.ordinality), '[]'::jsonb)
    into step_titles
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb))
    with ordinality as step(value, ordinality);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event.id,
    'eventType', event.event_type,
    'action', nullif(event.payload ->> 'action', ''),
    'stepTitle', internal_security.process_localized_text(event_step.value -> 'title', requested_language, event.payload ->> 'stepKey'),
    'terminalOutcome', nullif(event.payload ->> 'outcome', ''),
    'createdAt', event.created_at
  ) order by event.sequence_number), '[]'::jsonb)
    into history
  from public.process_events event
  left join lateral (
    select step.value
    from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) as step(value)
    where step.value ->> 'key' = event.payload ->> 'stepKey'
    limit 1
  ) event_step on true
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', note.id,
    'body', note.body,
    'createdAt', note.created_at
  ) order by note.created_at), '[]'::jsonb)
    into change_requests
  from public.process_work_item_notes note
  where note.tenant_id = item_row.tenant_id
    and note.hr_group_id = item_row.hr_group_id
    and note.process_instance_id = instance_row.id
    and note.work_item_id = item_row.id
    and note.action = 'REQUEST_CHANGES';

  select coalesce(jsonb_agg(jsonb_build_object(
    'action', transition.value ->> 'action',
    'label', internal_security.process_localized_text(transition.value -> 'label', requested_language, transition.value ->> 'action'),
    'toStepTitle', case when target_step.value is null then null
      else internal_security.process_localized_text(target_step.value -> 'title', requested_language, target_step.value ->> 'key')
    end,
    'terminalOutcome', target_step.value ->> 'terminalOutcome',
    'isConditional', transition.value ? 'condition' and transition.value -> 'condition' <> 'null'::jsonb
  ) order by transition.ordinality), '[]'::jsonb)
    into next_routes
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'transitions', '[]'::jsonb))
    with ordinality as transition(value, ordinality)
  left join lateral (
    select step.value
    from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) as step(value)
    where step.value ->> 'key' = transition.value ->> 'toStepKey'
    limit 1
  ) target_step on true
  where transition.value ->> 'fromStepKey' = item_row.step_key
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(coalesce(current_step -> 'allowedActions', '[]'::jsonb)) as allowed(action)
      where allowed.action = transition.value ->> 'action'
    );

  return jsonb_build_object(
    'steps', step_titles,
    'history', history,
    'changeRequests', change_requests,
    'nextRoutes', next_routes
  );
end;
$$;

revoke all on function internal_security.get_process_work_item_experience(uuid, text)
  from public, anon, authenticated;

create or replace function public.get_process_work_item_experience(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select internal_security.get_process_work_item_experience(requested_work_item_id, requested_language);
$$;

revoke all on function public.get_process_work_item_experience(uuid, text)
  from public, anon;
grant execute on function public.get_process_work_item_experience(uuid, text)
  to authenticated;

comment on function public.get_process_work_item_experience(uuid, text) is
  'Read-only, permission-filtered presentation data for the current immutable process version and scoped event history.';

commit;
