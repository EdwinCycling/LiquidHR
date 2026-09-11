-- Forward DEV cleanup of the Jan-only V2 RPC diagnostic.
do $$
declare
  function_definition text;
  diagnostic_start integer;
  diagnostic_end integer;
  end_marker text := E'    -- END_TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC_V2\n';
begin
  select pg_get_functiondef(function_ref.oid) into function_definition
  from pg_proc function_ref join pg_namespace function_namespace on function_namespace.oid = function_ref.pronamespace
  where function_namespace.nspname = 'public' and function_ref.proname = 'publish_complete_employment'
    and pg_get_function_identity_arguments(function_ref.oid) = 'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb';
  diagnostic_start := position(E'    -- TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC_V2\n' in function_definition);
  diagnostic_end := position(end_marker in function_definition);
  if diagnostic_start = 0 or diagnostic_end = 0 or diagnostic_end < diagnostic_start then
    raise exception 'TEMP_JAN_CONTRACT_RLS_DIAGNOSTIC_V2_NOT_FOUND';
  end if;
  function_definition := overlay(function_definition placing '' from diagnostic_start for diagnostic_end + length(end_marker) - diagnostic_start);
  execute function_definition;
end;
$$;

select pg_notify('pgrst', 'reload schema');
