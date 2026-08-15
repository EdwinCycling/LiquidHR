-- The public publish RPC is SECURITY INVOKER and performs actor/RLS checks.
-- Its internal, read-only validator remains non-callable by application roles,
-- but must execute with its owner's table access when invoked by that RPC.
alter function internal_security.validate_salary_structure_revision(uuid)
  security definer;

revoke all on function internal_security.validate_salary_structure_revision(uuid)
  from public, anon, authenticated;
