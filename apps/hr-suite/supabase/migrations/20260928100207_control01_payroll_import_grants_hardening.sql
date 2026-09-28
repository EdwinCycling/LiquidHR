-- CONTROL01 convergence correction: clear TEST default privileges from staging tables.
begin;

revoke all on table public.administration_payroll_tax_numbers from authenticated;
revoke all on table public.payroll_import_batches from authenticated;
revoke all on table public.payroll_import_persons from authenticated;
revoke all on table public.payroll_import_income_relationships from authenticated;

grant select, insert, update on table public.administration_payroll_tax_numbers to authenticated;
grant select, insert, update on table public.payroll_import_batches to authenticated;
grant select, insert, update on table public.payroll_import_persons to authenticated;
grant select, insert, update on table public.payroll_import_income_relationships to authenticated;

commit;
