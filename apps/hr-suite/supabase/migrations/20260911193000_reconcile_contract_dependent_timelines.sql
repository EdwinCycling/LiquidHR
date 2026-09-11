-- Begrens bij een contractperiodewijziging ook de bestaande afhankelijke
-- tijdlijnen op dezelfde contractperiode. De functie blijft SECURITY INVOKER;
-- RLS en de bestaande domeinrechten blijven de write boundary.
do $migration$
declare
  function_oid regprocedure := 'public.manage_employment_contract(uuid, uuid, jsonb)'::regprocedure;
  function_definition text;
  anchor text := E'    where condition.employment_contract_id = current_contract.id;\n  end if;\n\n  select contract.* into latest_contract';
  replacement text := E'    where condition.employment_contract_id = current_contract.id;\n\n    -- Begrens alleen de terminale regels van deze contractperiode.\n    update public.income_relationships relationship\n    set ends_on = requested_ends_on\n    where relationship.id in (\n      select link.income_relationship_id\n      from public.employment_income_relationships link\n      where link.employment_id = requested_employment_id\n        and link.valid_from >= requested_starts_on\n        and (requested_ends_on is null or link.valid_from <= requested_ends_on)\n        and (link.valid_until is null or link.valid_until = current_contract.ends_on)\n    )\n      and (relationship.ends_on is null or relationship.ends_on = current_contract.ends_on);\n\n    update public.employment_income_relationships link\n    set valid_until = requested_ends_on\n    where link.employment_id = requested_employment_id\n      and link.valid_from >= requested_starts_on\n      and (requested_ends_on is null or link.valid_from <= requested_ends_on)\n      and (link.valid_until is null or link.valid_until = current_contract.ends_on);\n\n    update public.employee_organizations organization\n    set effective_to = requested_ends_on\n    where organization.employment_id = requested_employment_id\n      and organization.effective_from >= requested_starts_on\n      and (requested_ends_on is null or organization.effective_from <= requested_ends_on)\n      and (organization.effective_to is null or organization.effective_to = current_contract.ends_on);\n\n    update public.employment_schedules schedule\n    set valid_until = requested_ends_on\n    where schedule.employment_id = requested_employment_id\n      and schedule.valid_from >= requested_starts_on\n      and (requested_ends_on is null or schedule.valid_from <= requested_ends_on)\n      and (schedule.valid_until is null or schedule.valid_until = current_contract.ends_on);\n\n    update public.employment_salaries salary\n    set valid_until = requested_ends_on\n    where salary.employment_id = requested_employment_id\n      and salary.valid_from >= requested_starts_on\n      and (requested_ends_on is null or salary.valid_from <= requested_ends_on)\n      and (salary.valid_until is null or salary.valid_until = current_contract.ends_on);\n\n    update public.employment_cost_allocations allocation\n    set valid_until = requested_ends_on\n    where allocation.employment_id = requested_employment_id\n      and allocation.valid_from >= requested_starts_on\n      and (requested_ends_on is null or allocation.valid_from <= requested_ends_on)\n      and (allocation.valid_until is null or allocation.valid_until = current_contract.ends_on);\n  end if;\n\n  select contract.* into latest_contract';
begin
  select pg_get_functiondef(function_oid) into function_definition;

  if strpos(function_definition, anchor) = 0 then
    raise exception 'CONTRACT_FUNCTION_ANCHOR_NOT_FOUND';
  end if;
  if strpos(function_definition, 'update public.employment_schedules') > 0 then
    raise exception 'CONTRACT_TIMELINE_RECONCILIATION_ALREADY_PRESENT';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_MUST_REMAIN_INVOKER';
  end if;

  execute replace(function_definition, anchor, replacement);

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_BECAME_SECURITY_DEFINER';
  end if;
  if strpos(pg_get_functiondef(function_oid), 'update public.employment_schedules') = 0 then
    raise exception 'CONTRACT_TIMELINE_RECONCILIATION_NOT_INSTALLED';
  end if;
end;
$migration$;
