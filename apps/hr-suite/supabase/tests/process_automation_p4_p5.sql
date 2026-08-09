-- Voer dit script uit met Supabase SQL Editor of supabase_execute_sql.
-- Dit contractscript schrijft geen runtime-fixtures en verandert geen data.

do $$
declare
  protected_table_count integer;
  policy_count integer;
  direct_mutation_grant_count integer;
  internal_runtime_function_count integer;
  condition_result boolean;
  function_definition text;
begin
  select count(*) into protected_table_count
  from pg_class relation
  join pg_namespace schema on schema.oid = relation.relnamespace
  where schema.nspname = 'public'
    and relation.relname in (
      'process_instances', 'process_step_instances', 'process_work_items', 'process_events',
      'process_form_responses', 'process_form_response_revisions'
    )
    and relation.relrowsecurity;
  if protected_table_count <> 6 then raise exception 'P4_P5_RLS_TABLE_COUNT_INVALID: %', protected_table_count; end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('process_form_responses', 'process_form_response_revisions');
  if policy_count <> 2 then raise exception 'P5_FORM_POLICY_COUNT_INVALID: %', policy_count; end if;

  select count(*) into direct_mutation_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and table_name in ('process_form_responses', 'process_form_response_revisions');
  if direct_mutation_grant_count <> 0 then raise exception 'P5_DIRECT_FORM_GRANTS_PRESENT: %', direct_mutation_grant_count; end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'process_form_responses_form_version_fkey'
  ) then raise exception 'P5_FORM_VERSION_PINNING_FK_MISSING'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgname in ('audit_process_form_responses_runtime', 'audit_process_form_response_revisions_runtime')
    group by 1
    having count(*) = 2
  ) then raise exception 'P5_FORM_AUDIT_TRIGGERS_MISSING'; end if;

  select count(*) into internal_runtime_function_count
  from pg_proc function_row
  join pg_namespace schema on schema.oid = function_row.pronamespace
  where schema.nspname = 'internal_security'
    and function_row.proname in (
      'start_process', 'perform_process_work_item_action', 'get_process_instance_projection',
      'get_process_form_projection', 'save_process_form_response'
    )
    and function_row.prosecdef
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE');
  if internal_runtime_function_count <> 5 then
    raise exception 'P4_P5_INTERNAL_FUNCTION_CONTRACT_INVALID: %', internal_runtime_function_count;
  end if;

  if exists (
    select 1
    from pg_proc function_row
    join pg_namespace schema on schema.oid = function_row.pronamespace
    where schema.nspname = 'internal_security'
      and function_row.proname in (
        'start_process', 'perform_process_work_item_action', 'get_process_instance_projection',
        'get_process_form_projection', 'save_process_form_response'
      )
      and not function_row.prosecdef
  ) then raise exception 'P4_P5_INTERNAL_FUNCTION_EXECUTE_LEAK'; end if;

  if exists (
    select 1
    from pg_proc function_row
    join pg_namespace schema on schema.oid = function_row.pronamespace
    where schema.nspname = 'public'
      and function_row.proname in (
        'start_process', 'perform_process_work_item_action', 'get_process_instance_projection',
        'get_process_form_projection', 'save_process_form_response'
      )
      and (function_row.prosecdef or has_function_privilege('anon', function_row.oid, 'EXECUTE') = true)
  ) then raise exception 'P4_P5_PUBLIC_WRAPPER_CONTRACT_INVALID'; end if;

  select internal_security.process_condition_matches(
    '{"operator":"equals","left":{"kind":"FIELD","fieldKey":"status"},"right":{"kind":"LITERAL","value":"OPEN"}}'::jsonb,
    '{"status":"OPEN"}'::jsonb,
    '{}'::jsonb
  ) into condition_result;
  if condition_result is not true then raise exception 'P4_CONDITION_EVALUATOR_INVALID'; end if;
  if internal_security.process_form_value_is_valid(
    '{"type":"MULTI_SELECT","options":[{"value":"a"}]}'::jsonb, '["b"]'::jsonb
  ) then raise exception 'P5_MULTI_SELECT_INVALID_VALUE_ACCEPTED'; end if;
  if not internal_security.process_form_value_is_empty('[]'::jsonb) then raise exception 'P5_EMPTY_MULTI_SELECT_NOT_EMPTY'; end if;
  if internal_security.process_form_language_allowed('{"enabledLanguages":["nl"]}'::jsonb, 'en') then raise exception 'P5_UNPUBLISHED_LANGUAGE_ALLOWED'; end if;

  select pg_get_functiondef(function_row.oid) into function_definition
  from pg_proc function_row
  join pg_namespace schema on schema.oid = function_row.pronamespace
  where schema.nspname = 'internal_security'
    and function_row.proname = 'audit_process_form_runtime_change'
  limit 1;
  if function_definition is null or function_definition like '%current_values%' or function_definition like '%new_values%' then
    raise exception 'P5_AUDIT_FORM_VALUE_PAYLOAD_PRESENT';
  end if;
end;
$$;
