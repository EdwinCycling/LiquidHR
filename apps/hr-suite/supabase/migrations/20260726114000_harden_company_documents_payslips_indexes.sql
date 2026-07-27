create index company_documents_uploaded_by_user_idx
  on public.company_documents (uploaded_by_user_id);
create index payslips_employee_fk_idx
  on public.payslips (tenant_id, employee_id);
create index payslips_employment_fk_idx
  on public.payslips (tenant_id, administration_id, employee_id, employment_id);
create index payslips_imported_by_user_idx
  on public.payslips (imported_by_user_id);

drop policy if exists payslips_write on public.payslips;
create policy payslips_write on public.payslips
  for insert to authenticated
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'payslip:write')));
create policy payslips_update on public.payslips
  for update to authenticated
  using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'payslip:write')))
  with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'payslip:write')));
