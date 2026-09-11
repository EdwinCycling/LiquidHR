-- Generate the change-set identifier before INSERT so its RETURNING clause
-- does not require premature visibility of the incomplete employment graph.
do $$
declare
  function_definition text;
  old_change_set_block text := E'  insert into public.employment_change_sets (\n    tenant_id, administration_id, employee_id, employment_id, effective_on,\n    reason, domains, status, applied_at, created_by_user_id\n  ) values (\n    requested_tenant_id, requested_administration_id, requested_employee_id,\n    created_employment_id, requested_starts_on, ''EMPLOYMENT_CREATED'',\n    case when not has_contract then array[''EMPLOYMENT''] else case when salary_payload is null then array[\n      ''EMPLOYMENT'', ''CONTRACT'', ''INCOME_RELATIONSHIP'', ''ORGANIZATION'',\n      ''LABOR_CONDITIONS'', ''SCHEDULE'', ''COST_ALLOCATION''\n    ] else array[\n      ''EMPLOYMENT'', ''CONTRACT'', ''INCOME_RELATIONSHIP'', ''ORGANIZATION'',\n      ''LABOR_CONDITIONS'', ''SCHEDULE'', ''SALARY'', ''COST_ALLOCATION''\n    ] end end,\n    ''APPLIED'', timezone(''utc'', now()), (select auth.uid())\n  ) returning id into created_change_set_id;';
  new_change_set_block text := E'  created_change_set_id := gen_random_uuid();\n  insert into public.employment_change_sets (\n    id,\n    tenant_id, administration_id, employee_id, employment_id, effective_on,\n    reason, domains, status, applied_at, created_by_user_id\n  ) values (\n    created_change_set_id,\n    requested_tenant_id, requested_administration_id, requested_employee_id,\n    created_employment_id, requested_starts_on, ''EMPLOYMENT_CREATED'',\n    case when not has_contract then array[''EMPLOYMENT''] else case when salary_payload is null then array[\n      ''EMPLOYMENT'', ''CONTRACT'', ''INCOME_RELATIONSHIP'', ''ORGANIZATION'',\n      ''LABOR_CONDITIONS'', ''SCHEDULE'', ''COST_ALLOCATION''\n    ] else array[\n      ''EMPLOYMENT'', ''CONTRACT'', ''INCOME_RELATIONSHIP'', ''ORGANIZATION'',\n      ''LABOR_CONDITIONS'', ''SCHEDULE'', ''SALARY'', ''COST_ALLOCATION''\n    ] end end,\n    ''APPLIED'', timezone(''utc'', now()), (select auth.uid())\n  );';
begin
  select pg_get_functiondef(function_ref.oid)
    into function_definition
  from pg_proc function_ref
  join pg_namespace function_namespace
    on function_namespace.oid = function_ref.pronamespace
  where function_namespace.nspname = 'public'
    and function_ref.proname = 'publish_complete_employment'
    and pg_get_function_identity_arguments(function_ref.oid) = 'requested_employee_id uuid, requested_administration_id uuid, requested_payload jsonb'
    and function_ref.prosecdef = false;

  if function_definition is null
     or position(old_change_set_block in function_definition) = 0
     or position('returning id into created_change_set_id' in lower(function_definition)) = 0
     or position('created_change_set_id := gen_random_uuid()' in function_definition) > 0 then
    raise exception 'PRE_GENERATE_EMPLOYMENT_CHANGE_SET_ID_FAILED';
  end if;

  execute replace(function_definition, old_change_set_block, new_change_set_block);
end;
$$;
select pg_notify('pgrst', 'reload schema');
