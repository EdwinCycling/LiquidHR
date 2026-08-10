begin;

-- P8 compiled definitions keep the published process under definition_json.content.
-- The P9 Forms work screens need the published step actions and titles from that shape.
do $p9$
declare
  function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'internal_security.get_process_work_projection(uuid,text,text,text,uuid,uuid,text,text,integer,integer)'::pg_catalog.regprocedure
  ) into function_definition;
  function_definition := replace(
    function_definition,
    $$coalesce(version.definition_json -> 'steps', '[]'::jsonb)$$,
    $$coalesce(internal_security.process_definition_content(version.definition_json) -> 'steps', '[]'::jsonb)$$
  );
  execute function_definition;

  select pg_catalog.pg_get_functiondef(
    'internal_security.get_process_work_item_detail(uuid,text)'::pg_catalog.regprocedure
  ) into function_definition;
  function_definition := replace(
    function_definition,
    $$coalesce(version_row.definition_json -> 'steps', '[]'::jsonb)$$,
    $$coalesce(internal_security.process_definition_content(version_row.definition_json) -> 'steps', '[]'::jsonb)$$
  );
  execute function_definition;
end;
$p9$;

commit;
