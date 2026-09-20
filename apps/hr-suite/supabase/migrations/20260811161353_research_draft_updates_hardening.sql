begin;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into function_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'internal_security'
    and procedure.proname = 'update_survey_draft'
    and pg_get_function_identity_arguments(procedure.oid) = 'requested_campaign_id uuid, requested_payload jsonb';
  if function_definition is null then
    raise exception 'RESEARCH_DRAFT_UPDATE_FUNCTION_MISSING';
  end if;
  function_definition := replace(
    function_definition,
    'target_ids = target_ids',
    'target_ids = coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(requested_payload -> ''targetIds'')), ''{}'')'
  );
  execute function_definition;

  select pg_get_functiondef(procedure.oid)
  into function_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'internal_security'
    and procedure.proname = 'update_enps_draft'
    and pg_get_function_identity_arguments(procedure.oid) = 'requested_campaign_id uuid, requested_payload jsonb';
  if function_definition is null then
    raise exception 'RESEARCH_DRAFT_UPDATE_FUNCTION_MISSING';
  end if;
  function_definition := replace(
    function_definition,
    'target_ids = target_ids',
    'target_ids = coalesce((select array_agg(value::uuid) from jsonb_array_elements_text(requested_payload -> ''targetIds'')), ''{}'')'
  );
  execute function_definition;
end;
$$;

commit;
