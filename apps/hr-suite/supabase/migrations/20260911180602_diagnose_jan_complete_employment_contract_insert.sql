-- TEMPORARY DEV-only diagnostic. It alters only the existing atomic publication
-- RPC and runs only for the already-existing synthetic Jan Test employee. The
-- raised exception rolls back the complete transaction before the contract INSERT.
do $$
declare
  function_definition text;
  insertion_point text := E'  if has_contract then\n    insert into public.employment_contracts (';
  diagnostic_block text := E'  if has_contract then\n    -- TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC\n    if requested_employee_id = ''66ef22a5-5777-44dc-9bde-44a65d0a6d60''::uuid then\n      raise exception ''JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC %'',\n        jsonb_build_object(\n          ''tenant_id'', requested_tenant_id,\n          ''hr_group_id'', requested_hr_group_id,\n          ''administration_id'', requested_administration_id,\n          ''employee_id'', requested_employee_id,\n          ''employment_id'', created_employment_id,\n          ''authenticated_user_present'', auth.uid() is not null,\n          ''parent_exists'', exists (select 1 from public.employments employment where employment.id = created_employment_id),\n          ''parent_tenant_matches'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.tenant_id = requested_tenant_id),\n          ''parent_hr_group_matches'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.hr_group_id = requested_hr_group_id),\n          ''parent_administration_matches'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.administration_id = requested_administration_id),\n          ''parent_employee_matches'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.employee_id = requested_employee_id),\n          ''parent_starts_on_matches'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.starts_on = requested_starts_on),\n          ''parent_confirmed'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.record_status = ''CONFIRMED''),\n          ''parent_not_deleted'', exists (select 1 from public.employments employment where employment.id = created_employment_id and employment.deleted_at is null),\n          ''employment_contracts_insert'', internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''contract:write''),\n          ''employment_contracts_insert_complete_employment'', internal_security.can_insert_complete_employment_contract(requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_employee_id, created_employment_id, requested_starts_on),\n          ''employment_contracts_hr_group_boundary_has_hr_group_access'', internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id),\n          ''employment_contracts_hr_group_boundary_complete_guard'', internal_security.can_insert_complete_employment_contract(requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_employee_id, created_employment_id, requested_starts_on),\n          ''employment_contracts_hr_group_boundary'', internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id) or internal_security.can_insert_complete_employment_contract(requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_employee_id, created_employment_id, requested_starts_on),\n          ''guard_arguments_equal_contract_row'', true\n        )::text\n        using errcode = ''P0001'';\n    end if;\n    -- END_TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC\n    insert into public.employment_contracts (';
begin
  select pg_get_functiondef(function_ref.oid)
    into function_definition
  from pg_proc function_ref
  join pg_namespace function_namespace on function_namespace.oid = function_ref.pronamespace
  where function_namespace.nspname = 'public'
    and function_ref.proname = 'publish_complete_employment'
    and pg_get_function_identity_arguments(function_ref.oid) =
      'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb';

  if function_definition is null
     or position('TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC' in function_definition) > 0
     or position(insertion_point in function_definition) = 0 then
    raise exception 'JAN_COMPLETE_EMPLOYMENT_RPC_DIAGNOSTIC_INSTALL_FAILED';
  end if;

  execute replace(function_definition, insertion_point, diagnostic_block);
end;
$$;

select pg_notify('pgrst', 'reload schema');
