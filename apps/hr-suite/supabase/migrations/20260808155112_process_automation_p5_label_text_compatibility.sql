-- P5 projection compatibility: localized text must be extracted as text, not JSON strings.

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(function_row.oid)
    into function_definition
  from pg_proc function_row
  join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
  where function_schema.nspname = 'internal_security'
    and function_row.proname = 'get_process_form_projection'
  limit 1;
  if function_definition is null then raise exception 'P5_FORM_PROJECTION_FUNCTION_MISSING'; end if;
  function_definition := replace(function_definition, 'field -> ''label'' -> language_code', 'field -> ''label'' ->> language_code');
  function_definition := replace(function_definition, 'field -> ''label'' -> ''nl''', 'field -> ''label'' ->> ''nl''');
  function_definition := replace(function_definition, 'field -> ''helpText'' -> language_code', 'field -> ''helpText'' ->> language_code');
  function_definition := replace(function_definition, 'field -> ''helpText'' -> ''nl''', 'field -> ''helpText'' ->> ''nl''');
  function_definition := replace(function_definition, 'option -> ''label'' -> language_code', 'option -> ''label'' ->> language_code');
  function_definition := replace(function_definition, 'option -> ''label'' -> ''nl''', 'option -> ''label'' ->> ''nl''');
  function_definition := replace(function_definition, 'section -> ''title'' -> language_code', 'section -> ''title'' ->> language_code');
  function_definition := replace(function_definition, 'section -> ''title'' -> ''nl''', 'section -> ''title'' ->> ''nl''');
  function_definition := replace(function_definition, 'form_definition -> ''title'' -> language_code', 'form_definition -> ''title'' ->> language_code');
  function_definition := replace(function_definition, 'form_definition -> ''title'' -> ''nl''', 'form_definition -> ''title'' ->> ''nl''');
  function_definition := replace(function_definition, 'form_definition -> ''description'' -> language_code', 'form_definition -> ''description'' ->> language_code');
  function_definition := replace(function_definition, 'form_definition -> ''description'' -> ''nl''', 'form_definition -> ''description'' ->> ''nl''');
  execute function_definition;
end;
$$;
