-- De aanmaakwizard schrijft zijn eigen audit/change-set binnen dezelfde
-- transactie als het nieuwe dienstverband. Controleer dat specifieke record
-- server-side zonder de change-set tabel breder schrijfbaar te maken.
create or replace function internal_security.can_insert_employment_creation_change_set(
  requested_tenant_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_effective_on date,
  requested_reason text,
  requested_status text,
  requested_created_by_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and requested_created_by_user_id = (select auth.uid())
    and requested_reason in ('EMPLOYMENT_CREATED', 'EMPLOYMENT_CREATED_SALARY')
    and requested_status = 'APPLIED'
    and exists (
      select 1
      from public.employees employee
      join public.employments employment
        on employment.employee_id = employee.id
       and employment.tenant_id = employee.tenant_id
       and employment.hr_group_id = employee.hr_group_id
      where employee.id = requested_employee_id
        and employee.tenant_id = requested_tenant_id
        and employee.deleted_at is null
        and employment.id = requested_employment_id
        and employment.administration_id = requested_administration_id
        and employment.starts_on = requested_effective_on
        and employment.record_status = 'CONFIRMED'
        and employment.deleted_at is null
        and (select internal_security.current_user_has_hr_group_permission(
          employee.tenant_id,
          employee.hr_group_id,
          'contract:write'
        ))
    );
$$;

revoke all on function internal_security.can_insert_employment_creation_change_set(uuid, uuid, uuid, uuid, date, text, text, uuid) from public, anon, authenticated;
grant execute on function internal_security.can_insert_employment_creation_change_set(uuid, uuid, uuid, uuid, date, text, text, uuid) to authenticated;

create policy employment_change_sets_insert_for_employment_creation
on public.employment_change_sets for insert to authenticated
with check (
  (select internal_security.can_insert_employment_creation_change_set(
    tenant_id,
    administration_id,
    employee_id,
    employment_id,
    effective_on,
    reason,
    status,
    created_by_user_id
  ))
);
