-- Keep the externally exposed mutation RPC SECURITY INVOKER so RLS remains in
-- force. The internal validator is read-only and returns no row data; granting
-- execute lets the invoker RPC call it without exposing it through public RPC.
alter function public.publish_salary_structure_revision(uuid, integer)
  security invoker;

grant execute on function internal_security.validate_salary_structure_revision(uuid)
  to authenticated;

revoke all on function public.publish_salary_structure_revision(uuid, integer)
  from public, anon;
grant execute on function public.publish_salary_structure_revision(uuid, integer)
  to authenticated;
