-- Remove the temporary DEV-only RPC diagnostic of SELECT visibility.
do $$
declare
  function_definition text;
  insert_position integer;
  diagnostic_start integer;
  diagnostic_length integer;
begin
  select pg_get_functiondef(function_ref.oid) into function_definition
  from pg_proc function_ref
  join pg_namespace function_namespace on function_namespace.oid = function_ref.pronamespace
  where function_namespace.nspname = 'public'
    and function_ref.proname = 'publish_complete_employment'
    and pg_get_function_identity_arguments(function_ref.oid) = 'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb';

  diagnostic_start := position('    if requested_employee_id = ' in function_definition);
  insert_position := position('    insert into public.employment_contracts (' in function_definition);
  if function_definition is null or diagnostic_start = 0 or position('JAN_CONTRACT_SELECT_VISIBILITY_DIAGNOSTIC' in function_definition) = 0 or insert_position = 0 then
    raise exception 'JAN_CONTRACT_SELECT_DIAGNOSTIC_REMOVE_FAILED';
  end if;
  diagnostic_length := insert_position - diagnostic_start;
  execute replace(function_definition, substring(function_definition from diagnostic_start for diagnostic_length), insertion_point);
end;
$$;
select pg_notify('pgrst', 'reload schema');
