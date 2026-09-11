-- Corrigeer de terminale selectie voor bestaande regels waarvan de oude
-- einddatum al buiten de actuele contractperiode ligt.
do $migration$
declare
  function_oid regprocedure := 'public.manage_employment_contract(uuid, uuid, jsonb)'::regprocedure;
  function_definition text;
  old_income_link_condition text := 'and (link.valid_until is null or link.valid_until = current_contract.ends_on)';
  old_income_condition text := 'and (relationship.ends_on is null or relationship.ends_on = current_contract.ends_on)';
  old_organization_condition text := 'and (organization.effective_to is null or organization.effective_to = current_contract.ends_on)';
  old_schedule_condition text := 'and (schedule.valid_until is null or schedule.valid_until = current_contract.ends_on)';
  old_salary_condition text := 'and (salary.valid_until is null or salary.valid_until = current_contract.ends_on)';
  old_allocation_condition text := 'and (allocation.valid_until is null or allocation.valid_until = current_contract.ends_on)';
  new_income_link_condition text := E'and (\n      (requested_ends_on is null and (link.valid_until is null or link.valid_until = current_contract.ends_on))\n      or (requested_ends_on is not null and (link.valid_until is null or link.valid_until >= requested_ends_on))\n    )';
  new_income_condition text := E'and (\n      (requested_ends_on is null and (relationship.ends_on is null or relationship.ends_on = current_contract.ends_on))\n      or (requested_ends_on is not null and (relationship.ends_on is null or relationship.ends_on >= requested_ends_on))\n    )';
  new_organization_condition text := E'and (\n      (requested_ends_on is null and (organization.effective_to is null or organization.effective_to = current_contract.ends_on))\n      or (requested_ends_on is not null and (organization.effective_to is null or organization.effective_to >= requested_ends_on))\n    )';
  new_schedule_condition text := E'and (\n      (requested_ends_on is null and (schedule.valid_until is null or schedule.valid_until = current_contract.ends_on))\n      or (requested_ends_on is not null and (schedule.valid_until is null or schedule.valid_until >= requested_ends_on))\n    )';
  new_salary_condition text := E'and (\n      (requested_ends_on is null and (salary.valid_until is null or salary.valid_until = current_contract.ends_on))\n      or (requested_ends_on is not null and (salary.valid_until is null or salary.valid_until >= requested_ends_on))\n    )';
  new_allocation_condition text := E'and (\n      (requested_ends_on is null and (allocation.valid_until is null or allocation.valid_until = current_contract.ends_on))\n      or (requested_ends_on is not null and (allocation.valid_until is null or allocation.valid_until >= requested_ends_on))\n    )';
begin
  select pg_get_functiondef(function_oid) into function_definition;

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_MUST_REMAIN_INVOKER';
  end if;
  if strpos(function_definition, old_income_link_condition) = 0
     or strpos(function_definition, old_income_condition) = 0
     or strpos(function_definition, old_organization_condition) = 0
     or strpos(function_definition, old_schedule_condition) = 0
     or strpos(function_definition, old_salary_condition) = 0
     or strpos(function_definition, old_allocation_condition) = 0 then
    raise exception 'CONTRACT_TERMINAL_SELECTION_ANCHOR_NOT_FOUND';
  end if;

  function_definition := replace(function_definition, old_income_link_condition, new_income_link_condition);
  function_definition := replace(function_definition, old_income_condition, new_income_condition);
  function_definition := replace(function_definition, old_organization_condition, new_organization_condition);
  function_definition := replace(function_definition, old_schedule_condition, new_schedule_condition);
  function_definition := replace(function_definition, old_salary_condition, new_salary_condition);
  function_definition := replace(function_definition, old_allocation_condition, new_allocation_condition);

  execute function_definition;

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_BECAME_SECURITY_DEFINER';
  end if;
  if strpos(pg_get_functiondef(function_oid), 'valid_until >= requested_ends_on') = 0 then
    raise exception 'CONTRACT_TERMINAL_SELECTION_NOT_INSTALLED';
  end if;
end;
$migration$;
