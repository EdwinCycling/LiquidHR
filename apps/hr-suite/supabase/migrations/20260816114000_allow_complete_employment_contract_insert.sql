-- Keep the publication RPC SECURITY INVOKER. This narrowly permits only the
-- new contract row whose parent and actor scope have been rechecked.
create or replace function internal_security.can_insert_complete_employment_contract(
  p_tenant_id uuid,
  p_hr_group_id uuid,
  p_administration_id uuid,
  p_employee_id uuid,
  p_employment_id uuid,
  p_starts_on date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.employees employee
      where employee.id = p_employee_id
        and employee.tenant_id = p_tenant_id
        and employee.hr_group_id = p_hr_group_id
        and employee.deleted_at is null
    )
    and exists (
      select 1
      from public.administrations administration
      where administration.id = p_administration_id
        and administration.tenant_id = p_tenant_id
        and administration.hr_group_id = p_hr_group_id
        and administration.is_active
    )
    and exists (
      select 1
      from public.employments employment
      where employment.id = p_employment_id
        and employment.tenant_id = p_tenant_id
        and employment.hr_group_id = p_hr_group_id
        and employment.administration_id = p_administration_id
        and employment.employee_id = p_employee_id
        and employment.starts_on = p_starts_on
        and employment.record_status = 'CONFIRMED'
        and employment.deleted_at is null
    )
    and internal_security.current_user_has_hr_group_permission(p_tenant_id, p_hr_group_id, 'contract:write')
    and internal_security.current_user_has_permission(p_tenant_id, p_administration_id, 'contract:write');
$$;

revoke all on function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date) from public, anon, authenticated;
grant execute on function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date) to authenticated;

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
