alter function internal_security.validate_salary_structure_revision(uuid)
  security definer;

revoke all on function internal_security.validate_salary_structure_revision(uuid)
  from public, anon, authenticated;