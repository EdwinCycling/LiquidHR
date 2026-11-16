begin;

create or replace function internal_security.process_form_active_response_values(
  requested_form_definition jsonb,
  requested_participant_key text,
  requested_condition_values jsonb,
  requested_subject jsonb,
  requested_values jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  field jsonb;
  access_rule jsonb;
  mode_name text;
  field_key text;
  active_values jsonb := '{}'::jsonb;
begin
  if pg_catalog.jsonb_typeof(coalesce(requested_values, '{}'::jsonb)) <> 'object' then
    raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001';
  end if;

  for field in select value from internal_security.process_form_fields(requested_form_definition) value loop
    field_key := field ->> 'key';
    if field_key is null or field_key = '' then continue; end if;
    access_rule := internal_security.process_form_access_rule(field, requested_participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name not in ('READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED') then continue; end if;
    if not internal_security.process_condition_matches(field -> 'visibilityCondition', requested_condition_values, requested_subject) then continue; end if;
    if requested_values ? field_key then
      active_values := active_values || pg_catalog.jsonb_build_object(field_key, requested_values -> field_key);
    end if;
  end loop;

  return active_values;
end;
$$;

revoke all on function internal_security.process_form_active_response_values(jsonb, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

create or replace function internal_security.process_form_runtime_fields(requested_work_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  form_info jsonb;
  form_definition jsonb;
  subject jsonb;
  condition_values jsonb;
  response_values jsonb;
begin
  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id;
  if item_row.id is null then return null; end if;

  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id;
  if instance_row.id is null then return null; end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response_row.current_values, '{}'::jsonb)
    || coalesce(response_row.new_values, '{}'::jsonb);
  response_values := internal_security.process_form_active_response_values(
    form_definition,
    item_row.participant_key,
    condition_values,
    subject,
    coalesce(response_row.current_values, '{}'::jsonb) || coalesce(response_row.new_values, '{}'::jsonb)
  );

  return coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || response_values;
end;
$$;

revoke all on function internal_security.process_form_runtime_fields(uuid) from public, anon, authenticated;

do $migration$
declare
  definition text;
  updated_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text)'::pg_catalog.regprocedure
  ) into definition;
  definition := replace(definition, E'\r\n', E'\n');

  updated_definition := replace(
    definition,
    $$  merged_condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || existing_new || incoming_new;$$,
    $$  merged_condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || internal_security.process_form_active_response_values(
      form_definition,
      item_row.participant_key,
      coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || existing_new,
      subject,
      existing_current || existing_new
    )
    || incoming_new;$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_CONDITION_VALUE_PATCH_NOT_APPLIED';
  end if;

  definition := updated_definition;
  updated_definition := replace(
    definition,
    $$  merged_new := existing_new || incoming_new;$$,
    $$  merged_new := internal_security.process_form_active_response_values(
    form_definition,
    item_row.participant_key,
    merged_condition_values,
    subject,
    existing_new || incoming_new
  );$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_DRAFT_SAVE_ACTIVE_VALUE_PATCH_NOT_APPLIED';
  end if;

  definition := updated_definition;
  updated_definition := replace(
    definition,
    $$    if required and internal_security.process_form_value_is_empty(value) then raise exception 'REQUIRED_FORM_FIELD' using errcode = 'P0001'; end if;$$,
    ''
  );
  if updated_definition = definition then
    raise exception 'PMUX05_DRAFT_SAVE_REQUIRED_CHECK_PATCH_NOT_APPLIED';
  end if;

  definition := updated_definition;
  updated_definition := replace(
    definition,
    $$    value := merged_new -> (field ->> 'key');$$,
    $$    field_key := field ->> 'key';
    value := merged_new -> field_key;$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_DRAFT_SAVE_FIELD_KEY_PATCH_NOT_APPLIED';
  end if;

  definition := updated_definition;
  updated_definition := replace(
    definition,
    $$raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';$$,
    $$raise exception using message = 'INVALID_FORM_VALUE', detail = field_key, errcode = 'P0001';$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_DRAFT_SAVE_FIELD_ERROR_PATCH_NOT_APPLIED';
  end if;
  execute updated_definition;

  select pg_catalog.pg_get_functiondef(
    'internal_security.prepare_process_form_action(uuid, text)'::pg_catalog.regprocedure
  ) into definition;
  definition := replace(definition, E'\r\n', E'\n');
  updated_definition := pg_catalog.regexp_replace(
    definition,
    $$condition_values := coalesce\(instance_row\.metadata -> 'fields', '\{\}'::jsonb\)[[:space:]]*\|\|[[:space:]]*coalesce\(response_row\.current_values, '\{\}'::jsonb\)[[:space:]]*\|\|[[:space:]]*coalesce\(response_row\.new_values, '\{\}'::jsonb\);$$,
    $$condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || internal_security.process_form_active_response_values(
      form_definition,
      item_row.participant_key,
      coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
        || coalesce(response_row.current_values, '{}'::jsonb)
        || coalesce(response_row.new_values, '{}'::jsonb),
      subject,
      coalesce(response_row.current_values, '{}'::jsonb) || coalesce(response_row.new_values, '{}'::jsonb)
    );$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_SUBMIT_CONDITION_VALUE_PATCH_NOT_APPLIED';
  end if;
  definition := updated_definition;
  updated_definition := replace(
    definition,
    $$raise exception 'REQUIRED_FORM_FIELD' using errcode = 'P0001';$$,
    $$raise exception using message = 'REQUIRED_FORM_FIELD', detail = field_key, errcode = 'P0001';$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_SUBMIT_REQUIRED_FIELD_DETAIL_PATCH_NOT_APPLIED';
  end if;
  definition := updated_definition;
  updated_definition := replace(
    definition,
    $$raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';$$,
    $$raise exception using message = 'INVALID_FORM_VALUE', detail = field_key, errcode = 'P0001';$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_SUBMIT_INVALID_FIELD_DETAIL_PATCH_NOT_APPLIED';
  end if;
  execute updated_definition;

  select pg_catalog.pg_get_functiondef(
    'internal_security.get_process_form_projection(uuid, text)'::pg_catalog.regprocedure
  ) into definition;
  definition := replace(definition, E'\r\n', E'\n');
  updated_definition := pg_catalog.regexp_replace(
    definition,
    $$fields_for_conditions := coalesce\(instance_row\.metadata -> 'fields', '\{\}'::jsonb\)[[:space:]]*\|\|[[:space:]]*coalesce\(response_row\.current_values, '\{\}'::jsonb\)[[:space:]]*\|\|[[:space:]]*coalesce\(response_row\.new_values, '\{\}'::jsonb\);$$,
    $$fields_for_conditions := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || internal_security.process_form_active_response_values(
      form_definition,
      participant_key,
      coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
        || coalesce(response_row.current_values, '{}'::jsonb)
        || coalesce(response_row.new_values, '{}'::jsonb),
      subject,
      coalesce(response_row.current_values, '{}'::jsonb) || coalesce(response_row.new_values, '{}'::jsonb)
    );$$
  );
  if updated_definition = definition then
    raise exception 'PMUX05_PROJECTION_CONDITION_VALUE_PATCH_NOT_APPLIED';
  end if;
  execute updated_definition;
end;
$migration$;

commit;
