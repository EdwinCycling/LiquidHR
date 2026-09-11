-- TEMPORARY DEV-only RPC diagnostic of SELECT visibility required by RETURNING.
do $$
declare
  function_definition text;
  insertion_point text := E'  if has_contract then\n    insert into public.employment_contracts (';
  diagnostic_block text := E'  if has_contract then\n    if requested_employee_id = ''66ef22a5-5777-44dc-9bde-44a65d0a6d60''::uuid then\n      raise exception ''JAN_CONTRACT_SELECT_VISIBILITY_DIAGNOSTIC %'', jsonb_build_object(''current_user'', current_user, ''session_user'', session_user, ''returning_id_into'', true, ''on_conflict'', false, ''select_permissive_policy_count'', 1, ''select_self_branch'', (exists (select 1 from public.employees employee where employee.id = requested_employee_id and employee.auth_user_id = auth.uid() and employee.deleted_at is null) and internal_security.current_employee_has_permission(''self:contract:read'')), ''select_manager_branch'', internal_security.can_manage_employee(requested_employee_id, ''contract:read''), ''select_permissive_result'', ((exists (select 1 from public.employees employee where employee.id = requested_employee_id and employee.auth_user_id = auth.uid() and employee.deleted_at is null) and internal_security.current_employee_has_permission(''self:contract:read'')) or internal_security.can_manage_employee(requested_employee_id, ''contract:read'')), ''select_restrictive_result'', internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id), ''select_effective_result'', (internal_security.has_hr_group_access(requested_tenant_id, requested_hr_group_id) and ((exists (select 1 from public.employees employee where employee.id = requested_employee_id and employee.auth_user_id = auth.uid() and employee.deleted_at is null) and internal_security.current_employee_has_permission(''self:contract:read'')) or internal_security.can_manage_employee(requested_employee_id, ''contract:read''))))::text using errcode = ''P0001'';\n    end if;\n    insert into public.employment_contracts (';
begin
  select pg_get_functiondef(function_ref.oid) into function_definition
  from pg_proc function_ref join pg_namespace function_namespace on function_namespace.oid = function_ref.pronamespace
  where function_namespace.nspname = 'public' and function_ref.proname = 'publish_complete_employment'
    and pg_get_function_identity_arguments(function_ref.oid) = 'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb';
  if function_definition is null or position('TEMP_JAN_COMPLETE_EMPLOYMENT_CONTRACT_RLS_DIAGNOSTIC' in function_definition) > 0 or position(insertion_point in function_definition) = 0 then
    raise exception 'JAN_CONTRACT_SELECT_DIAGNOSTIC_INSTALL_FAILED';
  end if;
  execute replace(function_definition, insertion_point, diagnostic_block);
end;
$$;
select pg_notify('pgrst', 'reload schema');
