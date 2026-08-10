begin;

-- P9 permits one person to hold both the source-manager and target-manager
-- roles. The generic self-assignment guard remains unchanged for every other
-- participant and selector. Only the target-manager candidate that equals the
-- actor completing the source-manager step bypasses that guard.
do $p9$
declare
  function_definition text;
  original_fragment text := $$candidate_row.employee_id, requested_actor_employee_id, false,$$;
  replacement_fragment text := $$candidate_row.employee_id,
            case
              when requested_participant ->> 'key' = 'target-manager'
                and candidate_row.employee_id = requested_actor_employee_id
                then null
              else requested_actor_employee_id
            end,
            false,$$;
begin
  select pg_catalog.pg_get_functiondef(
    'internal_security.resolve_process_assignment(uuid, uuid, public.access_scope_type, uuid, uuid, uuid, jsonb, uuid, uuid, date, timestamptz, timestamptz, jsonb, uuid)'::pg_catalog.regprocedure
  ) into function_definition;

  if pg_catalog.length(function_definition) - pg_catalog.length(
    pg_catalog.replace(function_definition, original_fragment, '')
  ) <> pg_catalog.length(original_fragment) then
    raise exception 'P9_RESOLVER_PATCH_TARGET_NOT_UNIQUE' using errcode = 'P0001';
  end if;

  function_definition := pg_catalog.replace(function_definition, original_fragment, replacement_fragment);
  execute function_definition;
end;
$p9$;

commit;
