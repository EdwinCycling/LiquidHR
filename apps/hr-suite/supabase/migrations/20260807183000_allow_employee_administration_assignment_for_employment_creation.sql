-- Een medewerker die vanuit de medewerkerwizard direct een dienstverband krijgt,
-- moet eerst aan de actieve administratie worden gekoppeld. Alleen een gebruiker
-- die het dienstverband mag aanmaken kan deze koppeling voor zijn HR-groep leggen.
create policy employee_administration_assignments_insert_for_employment
on public.employee_administration_assignments for insert to authenticated
with check (
  (select internal_security.current_user_has_hr_group_permission(
    tenant_id,
    hr_group_id,
    'contract:write'
  ))
  and exists (
    select 1
    from public.administrations administration
    where administration.tenant_id = employee_administration_assignments.tenant_id
      and administration.hr_group_id = employee_administration_assignments.hr_group_id
      and administration.id = employee_administration_assignments.administration_id
      and administration.is_active
  )
  and exists (
    select 1
    from public.employees employee
    where employee.tenant_id = employee_administration_assignments.tenant_id
      and employee.hr_group_id = employee_administration_assignments.hr_group_id
      and employee.id = employee_administration_assignments.employee_id
      and employee.deleted_at is null
  )
);
