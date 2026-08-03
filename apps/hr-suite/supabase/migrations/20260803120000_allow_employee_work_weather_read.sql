-- Medewerkers mogen voor hun werkweer alleen de locatiecontext van hun actieve
-- dienstverband lezen. Persoonlijke adressen en andere bedrijfslocaties blijven
-- buiten deze policy.
drop policy if exists administration_company_data_read on public.administration_company_data;
create policy administration_company_data_read
on public.administration_company_data
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-placement:read'))
  or exists (
    select 1
    from public.employees employee
    join public.employments employment on employment.employee_id = employee.id
    where employee.auth_user_id = (select auth.uid())
      and employee.id = (select internal_security.current_employee_id())
      and employee.tenant_id = administration_company_data.tenant_id
      and employment.tenant_id = administration_company_data.tenant_id
      and employment.administration_id = administration_company_data.administration_id
      and employment.record_status = 'CONFIRMED'
      and employment.starts_on <= current_date
      and (employment.ends_on is null or employment.ends_on >= current_date)
      and employment.deleted_at is null
  )
);

drop policy if exists administration_locations_read on public.administration_locations;
create policy administration_locations_read
on public.administration_locations
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, administration_id, 'company-data:read'))
  or (select internal_security.current_user_has_permission(tenant_id, administration_id, 'organization-placement:read'))
  or exists (
    select 1
    from public.employee_organizations placement
    join public.employees employee on employee.id = placement.employee_id
    join public.employments employment on employment.id = placement.employment_id
    where placement.location_id = administration_locations.id
      and employee.auth_user_id = (select auth.uid())
      and employee.id = (select internal_security.current_employee_id())
      and placement.tenant_id = administration_locations.tenant_id
      and placement.administration_id = administration_locations.administration_id
      and placement.effective_from <= current_date
      and (placement.effective_to is null or placement.effective_to >= current_date)
      and employment.record_status = 'CONFIRMED'
      and employment.starts_on <= current_date
      and (employment.ends_on is null or employment.ends_on >= current_date)
      and employment.deleted_at is null
  )
);
