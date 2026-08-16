-- Recreate the two employment-contract insert policies so pooled PostgREST
-- sessions use the current, narrowly scoped complete-employment checks.
drop policy if exists employment_contracts_hr_group_boundary on public.employment_contracts;
create policy employment_contracts_hr_group_boundary
on public.employment_contracts
as restrictive
for all
to authenticated
using ((select internal_security.has_hr_group_access(employment_contracts.tenant_id, employment_contracts.hr_group_id)))
with check (
  (select internal_security.has_hr_group_access(employment_contracts.tenant_id, employment_contracts.hr_group_id))
  or (select internal_security.can_insert_complete_employment_contract(
    employment_contracts.tenant_id,
    employment_contracts.hr_group_id,
    employment_contracts.administration_id,
    employment_contracts.employee_id,
    employment_contracts.employment_id,
    employment_contracts.starts_on
  ))
);

drop policy if exists employment_contracts_insert_complete_employment on public.employment_contracts;
create policy employment_contracts_insert_complete_employment
on public.employment_contracts
for insert
to authenticated
with check ((select internal_security.can_insert_complete_employment_contract(
  employment_contracts.tenant_id,
  employment_contracts.hr_group_id,
  employment_contracts.administration_id,
  employment_contracts.employee_id,
  employment_contracts.employment_id,
  employment_contracts.starts_on
)));

select pg_notify('pgrst', 'reload schema');
