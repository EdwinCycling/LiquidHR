-- Lees gepubliceerde procesversies via het bestaande normalisatiecontract.
-- Alleen deze definitielezing verandert; deadlines, ACL en triggers blijven intact.
do $migration$
declare
  function_definition text;
  original_read constant text := 'select version.definition_json into definition_content';
  normalized_read constant text := 'select internal_security.process_definition_content(version.definition_json) into definition_content';
begin
  select pg_catalog.pg_get_functiondef(
    'internal_security.materialize_process_step_deadline()'::regprocedure
  ) into function_definition;

  if pg_catalog.strpos(function_definition, normalized_read) > 0 then
    if (length(function_definition) - length(pg_catalog.replace(function_definition, normalized_read, '')))
       / length(normalized_read) <> 1
       or pg_catalog.strpos(function_definition, original_read) > 0 then
      raise exception 'process deadline normalized definition read is ambiguous';
    end if;
    return;
  end if;

  if (length(function_definition) - length(pg_catalog.replace(function_definition, original_read, '')))
     / length(original_read) <> 1 then
    raise exception 'process deadline definition read is missing or ambiguous';
  end if;

  execute pg_catalog.replace(function_definition, original_read, normalized_read);
end;
$migration$;
