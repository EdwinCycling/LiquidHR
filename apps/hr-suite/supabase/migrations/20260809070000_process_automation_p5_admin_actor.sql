begin;

-- Scope-actors met procesrechten mogen formulieren lezen en opslaan zonder employee-koppeling.
create or replace function internal_security.get_process_form_projection(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  form_info jsonb;
  form_definition jsonb;
  section jsonb;
  field jsonb;
  access_rule jsonb;
  visible_fields jsonb;
  sections jsonb := '[]'::jsonb;
  summary jsonb := '[]'::jsonb;
  field_projection jsonb;
  participant_key text;
  mode_name text;
  field_key text;
  language_code text := case when requested_language in ('nl', 'en') then requested_language else 'nl' end;
  fields_for_conditions jsonb;
  subject jsonb;
  is_visible boolean;
  is_required boolean;
  current_value jsonb;
  new_value jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id for share;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id for share;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id for share;
  if not coalesce(internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ), false) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
  participant_key := item_row.participant_key;
  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id;
  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  fields_for_conditions := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response_row.current_values, '{}'::jsonb)
    || coalesce(response_row.new_values, '{}'::jsonb);

  for section in select value from pg_catalog.jsonb_array_elements(coalesce(form_definition -> 'sections', '[]'::jsonb)) value loop
    visible_fields := '[]'::jsonb;
    for field in select value from pg_catalog.jsonb_array_elements(coalesce(section -> 'fields', '[]'::jsonb)) value loop
      field_key := field ->> 'key';
      access_rule := internal_security.process_form_access_rule(field, participant_key);
      mode_name := access_rule ->> 'mode';
      is_visible := mode_name is not null and mode_name <> 'HIDDEN'
        and internal_security.process_condition_matches(field -> 'visibilityCondition', fields_for_conditions, subject);
      if not is_visible then continue; end if;
      is_required := internal_security.process_form_field_required(field, participant_key, fields_for_conditions, subject);
      current_value := coalesce(response_row.current_values, '{}'::jsonb) -> field_key;
      new_value := coalesce(response_row.new_values, '{}'::jsonb) -> field_key;
      field_projection := jsonb_build_object(
        'key', field_key,
        'label', coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl'),
        'helpText', coalesce(field -> 'helpText' ->> language_code, field -> 'helpText' ->> 'nl'),
        'type', field ->> 'type',
        'accessMode', mode_name,
        'required', is_required,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'value', option ->> 'value',
            'label', coalesce(option -> 'label' ->> language_code, option -> 'label' ->> 'nl')
          ) order by option ->> 'value')
          from pg_catalog.jsonb_array_elements(coalesce(field -> 'options', '[]'::jsonb)) option
        ), '[]'::jsonb),
        'currentValue', current_value,
        'newValue', new_value
      );
      visible_fields := visible_fields || jsonb_build_array(field_projection);
      summary := summary || jsonb_build_array(jsonb_build_object(
        'fieldKey', field_key,
        'label', coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl'),
        'currentValue', current_value,
        'newValue', new_value
      ));
    end loop;
    if pg_catalog.jsonb_array_length(visible_fields) > 0 then
      sections := sections || jsonb_build_array(jsonb_build_object(
        'key', section ->> 'key',
        'title', coalesce(section -> 'title' ->> language_code, section -> 'title' ->> 'nl'),
        'fields', visible_fields
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'responseId', response_row.id,
    'workItemId', item_row.id,
    'processInstanceId', instance_row.id,
    'stepInstanceId', step_row.id,
    'stepKey', item_row.step_key,
    'participantKey', participant_key,
    'formKey', form_info ->> 'formKey',
    'formVersionId', form_info -> 'formVersionId',
    'language', language_code,
    'status', coalesce(response_row.status, 'IN_PROGRESS'),
    'revision', coalesce(response_row.revision, 0),
    'expectedVersion', coalesce(response_row.expected_version, 0),
    'title', coalesce(form_definition -> 'title' ->> language_code, form_definition -> 'title' ->> 'nl'),
    'description', coalesce(form_definition -> 'description' -> language_code, form_definition -> 'description' -> 'nl'),
    'sections', sections,
    'summary', summary,
    'availableLanguages', coalesce(form_definition -> 'enabledLanguages', jsonb_build_array('nl', 'en'))
  );
end;
$$;

create or replace function internal_security.save_process_form_response(
  requested_work_item_id uuid,
  requested_expected_revision bigint,
  requested_expected_version bigint,
  requested_values jsonb,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  form_info jsonb;
  form_definition jsonb;
  field jsonb;
  access_rule jsonb;
  subject jsonb;
  incoming_current jsonb := coalesce(requested_values -> 'current', '{}'::jsonb);
  incoming_new jsonb := coalesce(requested_values -> 'new', '{}'::jsonb);
  existing_current jsonb;
  existing_new jsonb;
  merged_new jsonb;
  merged_condition_values jsonb;
  value jsonb;
  field_key text;
  mode_name text;
  response_id uuid;
  next_revision bigint;
  next_expected_version bigint;
  save_correlation_id uuid;
  has_response boolean;
  required boolean;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(requested_values) <> 'object' then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(incoming_current) <> 'object' or pg_catalog.jsonb_typeof(incoming_new) <> 'object' then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id and item.id = requested_work_item_id
  for update of instance;
  select item.* into item_row
  from public.process_work_items item where item.id = requested_work_item_id for update;
  if item_row.id is null or instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not coalesce(internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ), false) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id and response.hr_group_id = item_row.hr_group_id and response.work_item_id = item_row.id
  for update;
  has_response := response_row.id is not null;
  if has_response then
    if exists (
      select 1 from public.process_form_response_revisions revision
      where revision.tenant_id = item_row.tenant_id and revision.hr_group_id = item_row.hr_group_id
        and revision.response_id = response_row.id and revision.idempotency_key = pg_catalog.btrim(requested_idempotency_key)
        and revision.changed_by_user_id = actor_user_id
    ) then
      return internal_security.get_process_form_projection(item_row.id, requested_language);
    end if;
    if response_row.revision <> requested_expected_revision or response_row.expected_version <> requested_expected_version then
      raise exception 'STALE_FORM_RESPONSE' using errcode = 'P0001';
    end if;
  elsif requested_expected_revision <> 0 or requested_expected_version <> 0 then
    raise exception 'STALE_FORM_RESPONSE' using errcode = 'P0001';
  end if;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  existing_current := coalesce(response_row.current_values, '{}'::jsonb);
  existing_new := coalesce(response_row.new_values, '{}'::jsonb);
  merged_condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || existing_new || incoming_new;

  for field_key in select key from pg_catalog.jsonb_object_keys(incoming_current) key loop
    select field_item into field from internal_security.process_form_fields(form_definition) field_item where field_item ->> 'key' = field_key;
    if field is null then raise exception 'UNKNOWN_FORM_FIELD' using errcode = 'P0001'; end if;
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001'; end if;
    if (existing_current -> field_key) is distinct from (incoming_current -> field_key) then raise exception 'CURRENT_VALUE_CHANGED' using errcode = 'P0001'; end if;
  end loop;

  for field_key in select key from pg_catalog.jsonb_object_keys(incoming_new) key loop
    select field_item into field from internal_security.process_form_fields(form_definition) field_item where field_item ->> 'key' = field_key;
    if field is null then raise exception 'UNKNOWN_FORM_FIELD' using errcode = 'P0001'; end if;
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001'; end if;
    if mode_name not in ('WRITE_OPTIONAL', 'WRITE_REQUIRED') then raise exception 'FIELD_NOT_WRITABLE' using errcode = 'P0001'; end if;
    if not internal_security.process_condition_matches(field -> 'visibilityCondition', merged_condition_values, subject) then
      raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001';
    end if;
    value := incoming_new -> field_key;
    if not internal_security.process_form_value_is_valid(field, value) then raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001'; end if;
  end loop;

  merged_new := existing_new || incoming_new;
  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then continue; end if;
    if not internal_security.process_condition_matches(field -> 'visibilityCondition', coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject) then continue; end if;
    required := internal_security.process_form_field_required(field, item_row.participant_key, coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject);
    if required and (
      (merged_new -> (field ->> 'key')) is null
      or merged_new -> (field ->> 'key') = 'null'::jsonb
      or (pg_catalog.jsonb_typeof(merged_new -> (field ->> 'key')) = 'string' and pg_catalog.btrim(merged_new ->> (field ->> 'key')) = '')
    ) then raise exception 'REQUIRED_FORM_FIELD' using errcode = 'P0001'; end if;
  end loop;

  save_correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id, extensions.gen_random_uuid());
  next_revision := case when has_response then response_row.revision + 1 else 1 end;
  next_expected_version := case when has_response then response_row.expected_version + 1 else 1 end;
  if has_response then
    update public.process_form_responses
    set new_values = merged_new,
        revision = next_revision,
        expected_version = next_expected_version,
        status = 'IN_PROGRESS',
        last_saved_by_user_id = actor_user_id,
        correlation_id = save_correlation_id
    where id = response_row.id;
    response_id := response_row.id;
  else
    insert into public.process_form_responses (
      tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id,
      process_version_id, form_version_id, form_key, participant_key, revision,
      expected_version, current_values, new_values, last_saved_by_user_id, correlation_id
    ) values (
      item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.step_instance_id, item_row.id,
      instance_row.process_version_id, nullif(form_info ->> 'formVersionId', '')::uuid, form_info ->> 'formKey', item_row.participant_key,
      next_revision, next_expected_version, coalesce(incoming_current, '{}'::jsonb), merged_new, actor_user_id, save_correlation_id
    ) returning id into response_id;
  end if;
  insert into public.process_form_response_revisions (
    tenant_id, hr_group_id, response_id, revision, expected_version,
    current_values, new_values, changed_by_user_id, idempotency_key, correlation_id
  ) values (
    item_row.tenant_id, item_row.hr_group_id, response_id, next_revision, next_expected_version,
    case when has_response then existing_current else coalesce(incoming_current, '{}'::jsonb) end,
    merged_new, actor_user_id, pg_catalog.btrim(requested_idempotency_key), save_correlation_id
  );
  return internal_security.get_process_form_projection(item_row.id, requested_language);
end;
$$;

grant execute on function internal_security.get_process_form_projection(uuid, text) to authenticated;
grant execute on function internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text) to authenticated;

commit;

