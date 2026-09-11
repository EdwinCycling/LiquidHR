-- Allow authenticated users with explicit HR-group access to read contracts in that scope.
create policy employment_contracts_hr_group_read
  on public.employment_contracts
  as permissive
  for select
  to authenticated
  using (internal_security.has_hr_group_access(tenant_id, hr_group_id));
