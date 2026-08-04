do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(functions.oid)
  into function_definition
  from pg_proc functions
  join pg_namespace namespaces on namespaces.oid = functions.pronamespace
  where namespaces.nspname = 'public'
    and functions.proname = 'get_employee_directory_detail'
    and pg_get_function_identity_arguments(functions.oid) = 'requested_tenant_id uuid, requested_administration_id uuid, requested_employee_id uuid, requested_week_start date';

  if function_definition is null then
    raise exception 'get_employee_directory_detail function not found';
  end if;

  function_definition := replace(
    function_definition,
    'if not internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'') then',
    E'if not (\n    internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee-directory:read'')\n    or internal_security.current_user_has_permission(requested_tenant_id, requested_administration_id, ''employee:read'')\n  ) then'
  );

  execute function_definition;
end;
$$;
