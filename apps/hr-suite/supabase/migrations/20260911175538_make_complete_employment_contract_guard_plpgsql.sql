-- The contract policy is evaluated immediately after the publication RPC inserts
-- its confirmed parent employment. Keep the existing narrow authorization proof,
-- but make it a non-inlineable VOLATILE function so its parent lookup is evaluated
-- in the current transaction state instead of the policy statement's init-plan.
-- This is not an authorization bypass: all tenant, HR-group, administration,
-- employee, parent and canonical permission predicates remain required.
create or replace function internal_security.can_insert_complete_employment_contract(
  p_tenant_id uuid,
  p_hr_group_id uuid,
  p_administration_id uuid,
  p_employee_id uuid,
  p_employment_id uuid,
  p_starts_on date
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_present boolean := auth.uid() is not null;
  v_employee_matches boolean := false;
  v_administration_matches boolean := false;
  v_parent_exists boolean := false;
  v_parent_tenant_matches boolean := false;
  v_parent_hr_group_matches boolean := false;
  v_parent_administration_matches boolean := false;
  v_parent_employee_matches boolean := false;
  v_parent_starts_on_matches boolean := false;
  v_parent_confirmed boolean := false;
  v_parent_not_deleted boolean := false;
  v_hr_group_contract_write boolean := false;
  v_administration_contract_write boolean := false;
begin
  select exists (
    select 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.tenant_id = p_tenant_id
      and employee.hr_group_id = p_hr_group_id
      and employee.deleted_at is null
  ) into v_employee_matches;

  select exists (
    select 1
    from public.administrations administration
    where administration.id = p_administration_id
      and administration.tenant_id = p_tenant_id
      and administration.hr_group_id = p_hr_group_id
      and administration.is_active
  ) into v_administration_matches;

  select
    true,
    employment.tenant_id = p_tenant_id,
    employment.hr_group_id = p_hr_group_id,
    employment.administration_id = p_administration_id,
    employment.employee_id = p_employee_id,
    employment.starts_on = p_starts_on,
    employment.record_status = 'CONFIRMED',
    employment.deleted_at is null
  into
    v_parent_exists,
    v_parent_tenant_matches,
    v_parent_hr_group_matches,
    v_parent_administration_matches,
    v_parent_employee_matches,
    v_parent_starts_on_matches,
    v_parent_confirmed,
    v_parent_not_deleted
  from public.employments employment
  where employment.id = p_employment_id;

  v_hr_group_contract_write := internal_security.current_user_has_hr_group_permission(
    p_tenant_id,
    p_hr_group_id,
    'contract:write'
  );
  v_administration_contract_write := internal_security.current_user_has_permission(
    p_tenant_id,
    p_administration_id,
    'contract:write'
  );

  return v_auth_present
    and v_employee_matches
    and v_administration_matches
    and v_parent_exists
    and v_parent_tenant_matches
    and v_parent_hr_group_matches
    and v_parent_administration_matches
    and v_parent_employee_matches
    and v_parent_starts_on_matches
    and v_parent_confirmed
    and v_parent_not_deleted
    and v_hr_group_contract_write
    and v_administration_contract_write;
end;
$$;

revoke all on function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date)
  to authenticated;

select pg_notify('pgrst', 'reload schema');
