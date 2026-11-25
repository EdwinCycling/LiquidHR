begin;

-- PostgreSQL does not define min(uuid). The PMUX assignment resolver uses
-- deterministic minima only to detect/choose a single effective manager or
-- department. Cast through canonical UUID text to preserve that ordering.
-- Patch the current secured implementation in place so every existing PMUX
-- workflow keeps its authorization and candidate-resolution behavior.
do $$
declare
  resolver_definition text;
  direct_manager_pattern text := 'min(organization.direct_manager_id)';
  direct_manager_fix text := 'min(organization.direct_manager_id::text)::uuid';
  department_pattern text := 'min(organization.department_id)';
  department_fix text := 'min(organization.department_id::text)::uuid';
begin
  resolver_definition := pg_catalog.pg_get_functiondef(
    'internal_security.resolve_process_assignment(uuid,uuid,public.access_scope_type,uuid,uuid,uuid,jsonb,uuid,uuid,date,timestamptz,timestamptz,jsonb,uuid)'::pg_catalog.regprocedure
  );

  if pg_catalog.strpos(resolver_definition, direct_manager_pattern) > 0 then
    resolver_definition := pg_catalog.replace(
      resolver_definition, direct_manager_pattern, direct_manager_fix
    );
  elsif pg_catalog.strpos(resolver_definition, direct_manager_fix) = 0 then
    raise exception 'PMUX_ASSIGNMENT_MANAGER_AGGREGATE_SOURCE_MISMATCH';
  end if;

  if pg_catalog.strpos(resolver_definition, department_pattern) > 0 then
    resolver_definition := pg_catalog.replace(
      resolver_definition, department_pattern, department_fix
    );
  elsif pg_catalog.strpos(resolver_definition, department_fix) = 0 then
    raise exception 'PMUX_ASSIGNMENT_DEPARTMENT_AGGREGATE_SOURCE_MISMATCH';
  end if;

  execute resolver_definition;
end;
$$;

commit;
