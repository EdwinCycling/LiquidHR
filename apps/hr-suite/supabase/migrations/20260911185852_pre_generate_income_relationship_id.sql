-- Generate the income-relationship identifier before INSERT so its RETURNING
-- clause does not require premature visibility of the incomplete graph.
do $$
declare
  function_definition text;
  old_income_block text := E'    insert into public.income_relationships (\n      tenant_id, administration_id, employee_id, payroll_tax_subnumber,\n      ikv_number, relationship_type, starts_on, ends_on\n    ) values (\n      requested_tenant_id, requested_administration_id, requested_employee_id,\n      coalesce(nullif(income_payload ->> ''payrollTaxSubnumber'', ''''), ''0001''),\n      (income_payload ->> ''ikvNumber'')::integer, ''EMPLOYMENT'', requested_starts_on, requested_ends_on\n    ) returning id into created_income_relationship_id;';
  new_income_block text := E'    created_income_relationship_id := gen_random_uuid();\n    insert into public.income_relationships (\n      id,\n      tenant_id, administration_id, employee_id, payroll_tax_subnumber,\n      ikv_number, relationship_type, starts_on, ends_on\n    ) values (\n      created_income_relationship_id,\n      requested_tenant_id, requested_administration_id, requested_employee_id,\n      coalesce(nullif(income_payload ->> ''payrollTaxSubnumber'', ''''), ''0001''),\n      (income_payload ->> ''ikvNumber'')::integer, ''EMPLOYMENT'', requested_starts_on, requested_ends_on\n    );';
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
     or position(old_income_block in function_definition) = 0
     or position('returning id into created_income_relationship_id' in lower(function_definition)) = 0
     or position('created_income_relationship_id := gen_random_uuid()' in function_definition) > 0 then
    raise exception 'PRE_GENERATE_INCOME_RELATIONSHIP_ID_FAILED';
  end if;

  execute replace(function_definition, old_income_block, new_income_block);
end;
$$;
select pg_notify('pgrst', 'reload schema');
