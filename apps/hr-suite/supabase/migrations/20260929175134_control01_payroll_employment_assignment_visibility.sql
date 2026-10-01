-- Payroll import creates draft employments with contract:write. The employment
-- service also verifies the employee's administration assignment before insert.
-- Let contract writers read only assignments in HR groups they already control.
begin;

alter table public.employments
  add column payroll_import_person_id uuid;

alter table public.employments
  add constraint employments_payroll_import_person_scope_fkey
  foreign key (tenant_id, hr_group_id, payroll_import_person_id)
  references public.payroll_import_persons (tenant_id, hr_group_id, id)
  on delete restrict;

create unique index employments_payroll_import_person_key
  on public.employments (tenant_id, hr_group_id, payroll_import_person_id)
  where payroll_import_person_id is not null;

create policy employee_administration_assignments_select_for_contract_writers
on public.employee_administration_assignments for select to authenticated
using (
  (select internal_security.current_user_has_hr_group_permission(
    tenant_id,
    hr_group_id,
    'contract:write'
  ))
);

commit;
