-- P4 start idempotency compatibility: avoid a PL/pgSQL variable/column ambiguity.

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(function_row.oid)
    into function_definition
  from pg_proc function_row
  join pg_namespace function_schema on function_schema.oid = function_row.pronamespace
  where function_schema.nspname = 'internal_security'
    and function_row.proname = 'start_process'
  limit 1;
  if function_definition is null then raise exception 'P4_START_FUNCTION_MISSING'; end if;
  function_definition := replace(function_definition, 'employment_id uuid := requested_employment_id;', 'resolved_employment_id uuid := requested_employment_id;');
  function_definition := replace(function_definition, 'if employment_id is null then', 'if resolved_employment_id is null then');
  function_definition := replace(function_definition, 'select employment.id into employment_id', 'select employment.id into resolved_employment_id');
  function_definition := replace(function_definition, 'if employment_id is null or not exists (', 'if resolved_employment_id is null or not exists (');
  function_definition := replace(function_definition, 'and employment.id = employment_id', 'and employment.id = resolved_employment_id');
  function_definition := replace(function_definition, 'and subject.employment_id = employment_id', 'and subject.employment_id = resolved_employment_id');
  function_definition := replace(function_definition, 'if employment_id is not null then', 'if resolved_employment_id is not null then');
  function_definition := replace(function_definition, 'definition_row.administration_id, employment_id', 'definition_row.administration_id, resolved_employment_id');
  execute function_definition;
end;
$$;
