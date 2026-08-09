-- P8: the exposed wrappers are invoker functions and may call only the
-- validated internal definer functions. The internal schema is not exposed
-- through PostgREST; the grant is required for the wrapper call itself.

grant execute on function internal_security.create_process_definition_draft_internal(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function internal_security.save_process_definition_draft_internal(uuid, integer, jsonb, jsonb)
  to authenticated;
grant execute on function internal_security.clone_process_definition_draft_internal(uuid, text, jsonb, jsonb)
  to authenticated;
grant execute on function internal_security.publish_process_definition_draft_internal(uuid, integer, jsonb, text, integer, text, text)
  to authenticated;
grant execute on function internal_security.retire_process_definition_internal(uuid, text)
  to authenticated;
