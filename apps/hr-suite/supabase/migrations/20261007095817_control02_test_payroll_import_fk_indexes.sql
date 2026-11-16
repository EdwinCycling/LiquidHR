begin;

create index if not exists payroll_import_batches_created_by_user_id_idx
  on public.payroll_import_batches (created_by_user_id);

create index if not exists payroll_import_decisions_batch_scope_idx
  on public.payroll_import_decisions (tenant_id, hr_group_id, administration_id, batch_id);

create index if not exists payroll_import_income_relationships_administration_scope_idx
  on public.payroll_import_income_relationships (tenant_id, hr_group_id, administration_id);

create index if not exists payroll_import_income_relationships_person_scope_idx
  on public.payroll_import_income_relationships (tenant_id, hr_group_id, batch_id, import_person_id);

create index if not exists payroll_import_persons_employee_scope_idx
  on public.payroll_import_persons (tenant_id, hr_group_id, matched_employee_id);

commit;