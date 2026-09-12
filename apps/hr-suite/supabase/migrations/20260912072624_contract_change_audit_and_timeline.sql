-- Houd de contractmutatie op dezelfde invoker/RLS-grens en koppel haar aan de
-- bestaande change-set- en auditarchitectuur. De afhankelijke tijdlijnen
-- volgen de terminale contractperiode bij zowel verlengen als verkorten.
do $migration$
declare
  function_oid regprocedure := 'public.manage_employment_contract(uuid, uuid, jsonb)'::regprocedure;
  function_definition text;
  declaration_anchor text := E'  resulting_sequence smallint;\nbegin';
  declaration_replacement text := E'  resulting_sequence smallint;\n  change_id uuid;\n  contract_change_reason text;\nbegin';
  validation_anchor text := E'    ) then raise exception ''FLEX_PHASE_NOT_FOUND''; end if;\n  end if;\n\n  if requested_contract_id is null then';
  validation_replacement text := E'    ) then raise exception ''FLEX_PHASE_NOT_FOUND''; end if;\n  end if;\n\n  contract_change_reason := nullif(trim(requested_payload ->> ''reason''), '''');\n  if requested_contract_id is not null and contract_change_reason is null then\n    raise exception ''CONTRACT_CHANGE_REASON_REQUIRED'';\n  end if;\n\n  insert into public.employment_change_sets (\n    tenant_id, administration_id, employee_id, employment_id, effective_on,\n    reason, domains, warning_codes, acknowledgements\n  ) values (\n    employment_row.tenant_id, employment_row.administration_id, employment_row.employee_id,\n    employment_row.id, requested_starts_on,\n    coalesce(contract_change_reason, ''CONTRACT_CREATED''), array[''CONTRACT''],\n    case when jsonb_typeof(requested_payload -> ''warningCodes'') = ''array''\n      then array(select jsonb_array_elements_text(requested_payload -> ''warningCodes''))\n      else ''{}''::text[] end,\n    case when jsonb_typeof(requested_payload -> ''acknowledgements'') = ''object''\n      then requested_payload -> ''acknowledgements''\n      else ''{}''::jsonb end\n  ) returning id into change_id;\n  perform set_config(''app.change_set_id'', change_id::text, true);\n\n  if requested_contract_id is null then';
  old_link_fragment text := 'or link.valid_until >= requested_ends_on';
  old_relationship_fragment text := 'or relationship.ends_on >= requested_ends_on';
  old_organization_fragment text := 'or organization.effective_to >= requested_ends_on';
  old_schedule_fragment text := 'or schedule.valid_until >= requested_ends_on';
  old_salary_fragment text := 'or salary.valid_until >= requested_ends_on';
  old_allocation_fragment text := 'or allocation.valid_until >= requested_ends_on';
  new_link_fragment text := 'or link.valid_until = current_contract.ends_on or link.valid_until >= requested_ends_on';
  new_relationship_fragment text := 'or relationship.ends_on = current_contract.ends_on or relationship.ends_on >= requested_ends_on';
  new_organization_fragment text := 'or organization.effective_to = current_contract.ends_on or organization.effective_to >= requested_ends_on';
  new_schedule_fragment text := 'or schedule.valid_until = current_contract.ends_on or schedule.valid_until >= requested_ends_on';
  new_salary_fragment text := 'or salary.valid_until = current_contract.ends_on or salary.valid_until >= requested_ends_on';
  new_allocation_fragment text := 'or allocation.valid_until = current_contract.ends_on or allocation.valid_until >= requested_ends_on';
begin
  select pg_get_functiondef(function_oid) into function_definition;

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_MUST_REMAIN_INVOKER';
  end if;
  if (select p.provolatile from pg_proc p where p.oid = function_oid) <> 'v' then
    raise exception 'CONTRACT_FUNCTION_MUST_REMAIN_VOLATILE';
  end if;
  if strpos(function_definition, declaration_anchor) = 0 then
    raise exception 'CONTRACT_DECLARATION_ANCHOR_NOT_FOUND';
  end if;
  if strpos(function_definition, validation_anchor) = 0 then
    raise exception 'CONTRACT_VALIDATION_ANCHOR_NOT_FOUND';
  end if;
  if strpos(function_definition, old_link_fragment) = 0
     or strpos(function_definition, old_relationship_fragment) = 0
     or strpos(function_definition, old_organization_fragment) = 0
     or strpos(function_definition, old_schedule_fragment) = 0
     or strpos(function_definition, old_salary_fragment) = 0
     or strpos(function_definition, old_allocation_fragment) = 0 then
    raise exception 'CONTRACT_TERMINAL_SELECTION_ANCHOR_NOT_FOUND';
  end if;

  function_definition := replace(function_definition, declaration_anchor, declaration_replacement);
  function_definition := replace(function_definition, validation_anchor, validation_replacement);
  function_definition := replace(function_definition, old_link_fragment, new_link_fragment);
  function_definition := replace(function_definition, old_relationship_fragment, new_relationship_fragment);
  function_definition := replace(function_definition, old_organization_fragment, new_organization_fragment);
  function_definition := replace(function_definition, old_schedule_fragment, new_schedule_fragment);
  function_definition := replace(function_definition, old_salary_fragment, new_salary_fragment);
  function_definition := replace(function_definition, old_allocation_fragment, new_allocation_fragment);

  execute function_definition;

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_BECAME_SECURITY_DEFINER';
  end if;
  if (select p.provolatile from pg_proc p where p.oid = function_oid) <> 'v' then
    raise exception 'CONTRACT_FUNCTION_VOLATILITY_CHANGED';
  end if;
  if strpos(pg_get_functiondef(function_oid), 'contract_change_reason') = 0
     or strpos(pg_get_functiondef(function_oid), 'employment_change_sets') = 0
     or strpos(pg_get_functiondef(function_oid), new_link_fragment) = 0 then
    raise exception 'CONTRACT_CHANGE_AUDIT_TIMELINE_NOT_INSTALLED';
  end if;
end;
$migration$;

-- Contractupdates worden via dezelfde bestaande audittrigger als de andere
-- employment-tijdlijnen aan de transactionele change-set gekoppeld.
drop trigger if exists audit_employment_contracts on public.employment_contracts;
create trigger audit_employment_contracts
after insert or update or delete on public.employment_contracts
for each row execute function internal_security.audit_employment_change('employment_contract');

revoke all on function public.manage_employment_contract(uuid, uuid, jsonb)
from public, anon;
grant execute on function public.manage_employment_contract(uuid, uuid, jsonb)
to authenticated;
