-- Markeer de bestaande contractmutatie pas na een volledig geslaagde
-- contract- en employmentupdate als APPLIED.
do $migration$
declare
  function_oid regprocedure := 'public.manage_employment_contract(uuid, uuid, jsonb)'::regprocedure;
  function_definition text;
  status_anchor text := E'  return resulting_contract_id;';
  status_replacement text := E'  update public.employment_change_sets\n    set status = ''APPLIED'', applied_at = timezone(''utc'', now())\n    where id = change_id;\n\n  return resulting_contract_id;';
begin
  select pg_get_functiondef(function_oid) into function_definition;

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_MUST_REMAIN_INVOKER';
  end if;
  if (select p.provolatile from pg_proc p where p.oid = function_oid) <> 'v' then
    raise exception 'CONTRACT_FUNCTION_MUST_REMAIN_VOLATILE';
  end if;
  if strpos(function_definition, 'change_id uuid') = 0
     or strpos(function_definition, 'employment_change_sets') = 0
     or strpos(function_definition, status_anchor) = 0 then
    raise exception 'CONTRACT_CHANGE_STATUS_ANCHOR_NOT_FOUND';
  end if;

  execute replace(function_definition, status_anchor, status_replacement);

  if (select p.prosecdef from pg_proc p where p.oid = function_oid) then
    raise exception 'CONTRACT_FUNCTION_BECAME_SECURITY_DEFINER';
  end if;
  if (select p.provolatile from pg_proc p where p.oid = function_oid) <> 'v' then
    raise exception 'CONTRACT_FUNCTION_VOLATILITY_CHANGED';
  end if;
  if strpos(pg_get_functiondef(function_oid), 'status = ''APPLIED''') = 0 then
    raise exception 'CONTRACT_CHANGE_STATUS_NOT_INSTALLED';
  end if;
end;
$migration$;
