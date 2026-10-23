begin;

-- Step-scoped field rights refine the existing participant access ceiling.
create or replace function internal_security.process_form_step_access_rule(
  requested_field jsonb,
  requested_participant_key text,
  requested_step_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base_rule jsonb;
  step_rule jsonb;
  base_mode text;
  step_mode text;
  base_rank integer;
  step_rank integer;
  step_rule_count integer;
begin
  base_rule := internal_security.process_form_access_rule(requested_field, requested_participant_key);
  if not (coalesce(requested_field, '{}'::jsonb) ? 'stepAccess') then
    return coalesce(base_rule, pg_catalog.jsonb_build_object('mode', 'HIDDEN'));
  end if;
  if base_rule is null then
    return pg_catalog.jsonb_build_object('mode', 'HIDDEN');
  end if;

  if pg_catalog.jsonb_typeof(requested_field -> 'stepAccess') <> 'array' then
    return pg_catalog.jsonb_build_object('mode', 'HIDDEN');
  end if;

  select rule.value, count(*) over() into step_rule, step_rule_count
  from pg_catalog.jsonb_array_elements(requested_field -> 'stepAccess') as rule(value)
  where rule.value ->> 'stepKey' = requested_step_key
    and rule.value ->> 'participantKey' = requested_participant_key
  limit 1;

  if step_rule is null or step_rule_count is distinct from 1 then
    return pg_catalog.jsonb_build_object('mode', 'HIDDEN');
  end if;

  base_mode := base_rule ->> 'mode';
  step_mode := step_rule ->> 'mode';
  if base_mode is null or step_mode is null
    or base_mode not in ('HIDDEN', 'READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED')
    or step_mode not in ('HIDDEN', 'READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED') then
    return pg_catalog.jsonb_build_object('mode', 'HIDDEN');
  end if;

  base_rank := case base_mode
    when 'HIDDEN' then 0
    when 'READ' then 1
    else 2
  end;
  step_rank := case step_mode
    when 'HIDDEN' then 0
    when 'READ' then 1
    else 2
  end;

  if step_rank > base_rank then
    return pg_catalog.jsonb_set(base_rule, '{mode}', pg_catalog.to_jsonb(base_mode), true);
  end if;
  return pg_catalog.jsonb_set(base_rule, '{mode}', pg_catalog.to_jsonb(step_mode), true);
end;
$$;

revoke all on function internal_security.process_form_step_access_rule(jsonb, text, text) from public, anon, authenticated;

create or replace function internal_security.process_form_step_field_required(
  requested_field jsonb,
  requested_participant_key text,
  requested_step_key text,
  requested_condition_values jsonb,
  requested_subject jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_rule jsonb;
  mode_name text;
begin
  access_rule := internal_security.process_form_step_access_rule(requested_field, requested_participant_key, requested_step_key);
  mode_name := access_rule ->> 'mode';
  if mode_name = 'WRITE_REQUIRED' then return true; end if;
  if mode_name <> 'WRITE_OPTIONAL' then return false; end if;
  if requested_field -> 'requiredCondition' is null then return false; end if;
  return internal_security.process_condition_matches(
    requested_field -> 'requiredCondition',
    requested_condition_values,
    requested_subject
  );
end;
$$;

revoke all on function internal_security.process_form_step_field_required(jsonb, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function internal_security.process_form_active_response_values(
  requested_form_definition jsonb,
  requested_participant_key text,
  requested_step_key text,
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
    access_rule := internal_security.process_form_step_access_rule(field, requested_participant_key, requested_step_key);
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

revoke all on function internal_security.process_form_active_response_values(jsonb, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

do $migration$
declare
  function_signature text;
  definition text;
  updated_definition text;
  function_signatures text[] := array[
    'internal_security.process_form_runtime_fields(uuid)',
    'internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text)',
    'internal_security.prepare_process_form_action(uuid, text)',
    'internal_security.get_process_form_projection(uuid, text)'
  ];
begin
  foreach function_signature in array function_signatures loop
    select pg_catalog.pg_get_functiondef(function_signature::pg_catalog.regprocedure) into definition;
    if definition is null then
      raise exception 'PMUX05C_RUNTIME_FUNCTION_NOT_FOUND: %', function_signature;
    end if;

    updated_definition := definition;
    updated_definition := replace(
      updated_definition,
      'process_form_access_rule(field, item_row.participant_key)',
      'process_form_step_access_rule(field, item_row.participant_key, item_row.step_key)'
    );
    updated_definition := replace(
      updated_definition,
      'process_form_access_rule(field, participant_key)',
      'process_form_step_access_rule(field, participant_key, item_row.step_key)'
    );
    updated_definition := replace(
      updated_definition,
      'process_form_field_required(field, item_row.participant_key,',
      'process_form_step_field_required(field, item_row.participant_key, item_row.step_key,'
    );
    updated_definition := replace(
      updated_definition,
      'process_form_field_required(field, participant_key,',
      'process_form_step_field_required(field, participant_key, item_row.step_key,'
    );
    updated_definition := pg_catalog.regexp_replace(
      updated_definition,
      '(process_form_active_response_values[[:space:]]*\([[:space:]]*form_definition[[:space:]]*,[[:space:]]*item_row\.participant_key[[:space:]]*,)',
      pg_catalog.chr(92) || '1item_row.step_key, ',
      'g'
    );
    updated_definition := pg_catalog.regexp_replace(
      updated_definition,
      '(process_form_active_response_values[[:space:]]*\([[:space:]]*form_definition[[:space:]]*,[[:space:]]*participant_key[[:space:]]*,)',
      pg_catalog.chr(92) || '1item_row.step_key, ',
      'g'
    );

    if updated_definition = definition then
      raise exception 'PMUX05C_RUNTIME_PATCH_NOT_APPLIED: %', function_signature;
    end if;
    if updated_definition ~ 'process_form_access_rule\(field[[:space:]]*,[[:space:]]*(item_row\.participant_key|participant_key)[[:space:]]*\)'
      or updated_definition ~ 'process_form_field_required\(field[[:space:]]*,[[:space:]]*(item_row\.participant_key|participant_key)[[:space:]]*,'
      or updated_definition ~ 'process_form_active_response_values[[:space:]]*\([[:space:]]*form_definition[[:space:]]*,[[:space:]]*(item_row\.participant_key|participant_key)[[:space:]]*,[[:space:]]*(condition_values|coalesce)'
    then
      raise exception 'PMUX05C_UNSCOPED_ACCESS_CALL_REMAINS: %', function_signature;
    end if;

    execute updated_definition;
  end loop;
end;
$migration$;

commit;
