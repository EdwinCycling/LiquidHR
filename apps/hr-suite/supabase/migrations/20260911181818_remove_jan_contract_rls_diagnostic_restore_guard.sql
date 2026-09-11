-- Forward DEV cleanup: remove only the temporary Jan-scoped RPC diagnostic.
do $migration$
declare
  v_function_oid oid;
  v_definition text;
  v_start integer;
  v_end integer;
  v_end_marker text := E'    -- END_TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC\n';
begin
  select p.oid into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'publish_complete_employment'
    and pg_get_function_identity_arguments(p.oid) = 'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb';

  v_definition := pg_get_functiondef(v_function_oid);
  v_start := position(E'    -- TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC\n' in v_definition);
  v_end := position(v_end_marker in v_definition);
  if v_start = 0 or v_end = 0 or v_end < v_start then
    raise exception 'TEMP_JAN_CONTRACT_RLS_DIAGNOSTIC_NOT_FOUND';
  end if;
  v_definition := overlay(v_definition placing '' from v_start for v_end + length(v_end_marker) - v_start);
  execute v_definition;
end;
$migration$;

-- Restore the semantically correct classification and original SQL guard. The
-- guard reads only committed/transaction-visible state and does not need a
-- diagnostic VOLATILE or PL/pgSQL experiment in the final state.
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
    and internal_security.current_user_has_hr_group_permission(
      p_tenant_id, p_hr_group_id, 'contract:write'
    )
    and internal_security.current_user_has_permission(
      p_tenant_id, p_administration_id, 'contract:write'
    );
$$;

revoke all on function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function internal_security.can_insert_complete_employment_contract(uuid, uuid, uuid, uuid, uuid, date)
  to authenticated;

select pg_notify('pgrst', 'reload schema');
