-- Generate the contract identifier before INSERT so INSERT ... RETURNING is not
-- needed while the subsequent organization placement is still absent.
do $$
declare
  function_definition text;
  old_contract_block text := E'  if has_contract then\n        insert into public.employment_contracts (\n      tenant_id, hr_group_id, administration_id, employee_id, employment_id, sequence_number,\n      worker_type, flex_phase_id, labor_condition_set_id, duration_type,\n      starts_on, ends_on, probation_applies, probation_ends_on\n    ) values (\n      requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_employee_id,\n      created_employment_id, 1, requested_worker_type,\n      nullif(contract_payload ->> ''flexPhaseId'', '''')::uuid,\n      (contract_payload ->> ''laborConditionSetId'')::uuid,\n      (contract_payload ->> ''durationType'')::public.contract_duration_type,\n      requested_starts_on, requested_ends_on,\n      coalesce((contract_payload ->> ''probationApplies'')::boolean, false),\n      nullif(contract_payload ->> ''probationEndsOn'', '''')::date\n    ) returning id into created_contract_id;\n  end if;';
  new_contract_block text := E'  if has_contract then\n    created_contract_id := gen_random_uuid();\n    insert into public.employment_contracts (\n      id,\n      tenant_id, hr_group_id, administration_id, employee_id, employment_id, sequence_number,\n      worker_type, flex_phase_id, labor_condition_set_id, duration_type,\n      starts_on, ends_on, probation_applies, probation_ends_on\n    ) values (\n      created_contract_id,\n      requested_tenant_id, requested_hr_group_id, requested_administration_id, requested_employee_id,\n      created_employment_id, 1, requested_worker_type,\n      nullif(contract_payload ->> ''flexPhaseId'', '''')::uuid,\n      (contract_payload ->> ''laborConditionSetId'')::uuid,\n      (contract_payload ->> ''durationType'')::public.contract_duration_type,\n      requested_starts_on, requested_ends_on,\n      coalesce((contract_payload ->> ''probationApplies'')::boolean, false),\n      nullif(contract_payload ->> ''probationEndsOn'', '''')::date\n    );\n  end if;';
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
     or position(old_contract_block in function_definition) = 0
     or position('created_contract_id := gen_random_uuid()' in function_definition) > 0 then
    raise exception 'PRE_GENERATE_EMPLOYMENT_CONTRACT_ID_FAILED';
  end if;

  execute replace(function_definition, old_contract_block, new_contract_block);
end;
$$;
select pg_notify('pgrst', 'reload schema');
