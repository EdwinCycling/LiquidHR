-- CONTROL02 defense-in-depth: keep staged people and income rows inside the
-- same tenant, HR group, and import batch, and keep employee matches inside
-- the same tenant and HR group.
-- CONVERGENCE_REQUIRED: apply only after explicit approval for the exact
-- shared Core TEST project. This migration is forward-only.
begin;

-- The existing person scope key proves tenant/HR-group/id identity. Add the
-- batch dimension as a referenced key so an income row cannot point at a
-- person from another import batch with the same tenant/group scope.
create unique index payroll_import_persons_tenant_hr_group_batch_id_key
  on public.payroll_import_persons (tenant_id, hr_group_id, batch_id, id);

alter table public.payroll_import_income_relationships
  drop constraint payroll_import_income_person_scope_fkey,
  add constraint payroll_import_income_person_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, import_person_id)
    references public.payroll_import_persons (tenant_id, hr_group_id, batch_id, id)
    on delete cascade;

-- The original FK checked only tenant/id. Rebind the existing constraint name
-- to the canonical employee scope key, which includes the HR group.
alter table public.payroll_import_persons
  drop constraint payroll_import_persons_employee_scope_fkey,
  add constraint payroll_import_persons_employee_scope_fkey
    foreign key (tenant_id, hr_group_id, matched_employee_id)
    references public.employees (tenant_id, hr_group_id, id)
    on delete restrict;

commit;
