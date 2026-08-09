-- P5 form action compatibility: avoid PL/pgSQL variable/column ambiguity.

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(function_row.oid)
    into function_definition
  from pg_proc function_row
  join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
  where function_schema.nspname = 'internal_security'
    and function_row.proname = 'prepare_process_form_action'
  limit 1;
  if function_definition is null then raise exception 'P5_FORM_ACTION_FUNCTION_MISSING'; end if;
  function_definition := replace(
    function_definition,
    'for field in select value from internal_security.process_form_fields(form_definition) value loop',
    'for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop'
  );
  execute function_definition;
end;
$$;
