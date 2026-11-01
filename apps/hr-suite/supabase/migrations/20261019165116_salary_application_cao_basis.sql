-- Preserve an explicitly selected CAO scale basis through the authenticated
-- salary application RPCs. This migration changes function bodies only.
do $$
declare
  salary_function oid;
  combined_function oid;
  function_definition text;
  updated_definition text;
  basis_case_pattern text := 'case[[:space:]]+route[[:space:]]+when[[:space:]]+''SCALE_WITH_STEPS''[[:space:]]+then[[:space:]]+''CUSTOM_SCALE''::public[.]salary_basis[[:space:]]+when[[:space:]]+''MINIMUM_WAGE''[[:space:]]+then[[:space:]]+''MINIMUM_WAGE''::public[.]salary_basis[[:space:]]+else[[:space:]]+''MANUAL''::public[.]salary_basis[[:space:]]+end';
  replacement_basis_case text := $replacement$case route
        when 'SCALE_WITH_STEPS' then coalesce(
          nullif(requested_payload ->> 'salaryBasis', '')::public.salary_basis,
          'CUSTOM_SCALE'::public.salary_basis
        )
        when 'MINIMUM_WAGE' then 'MINIMUM_WAGE'::public.salary_basis
        when 'SALARY_BAND' then 'SALARY_BAND'::public.salary_basis
        else 'MANUAL'::public.salary_basis
      end$replacement$;
  basis_validation text := $validation$
  if route = 'SCALE_WITH_STEPS'
     and coalesce(nullif(requested_payload ->> 'salaryBasis', ''), 'CUSTOM_SCALE') not in ('CUSTOM_SCALE', 'CAO_SCALE') then
    raise exception 'SALARY_BASIS_ROUTE_MISMATCH';
  end if;
  if route = 'SCALE_WITH_STEPS'
     and coalesce(nullif(requested_payload ->> 'salaryBasis', ''), 'CUSTOM_SCALE') = 'CAO_SCALE'
     and (
       nullif(btrim(requested_payload ->> 'caoScaleName'), '') is null
       or nullif(btrim(requested_payload ->> 'caoStepName'), '') is null
     ) then
    raise exception 'CAO_SCALE_REQUIRED';
  end if;
$validation$;
  route_assignment text := 'route := (requested_payload ->> ''salaryRoute'')::public.salary_application_route;';
  definition_count integer;
  salary_acl aclitem[];
  combined_acl aclitem[];
begin
  select 'public.apply_salary_application_change(uuid, date, jsonb, text, text[], jsonb)'::regprocedure::oid
    into salary_function;
  select 'public.apply_combined_salary_application_change(uuid, date, jsonb, text, text[], jsonb)'::regprocedure::oid
    into combined_function;

  if salary_function is null or combined_function is null then
    raise exception 'SALARY_APPLICATION_RPC_NOT_FOUND';
  end if;
  if (select prosecdef from pg_proc where oid = salary_function)
     or (select prosecdef from pg_proc where oid = combined_function) then
    raise exception 'SALARY_APPLICATION_RPC_MUST_REMAIN_SECURITY_INVOKER';
  end if;

  select proacl into salary_acl from pg_proc where oid = salary_function;
  select proacl into combined_acl from pg_proc where oid = combined_function;

  select pg_get_functiondef(salary_function) into function_definition;
  select count(*) into definition_count
  from regexp_matches(function_definition, basis_case_pattern, 'gi');
  if definition_count <> 2 then
    raise exception 'SALARY_APPLICATION_BASIS_CASE_COUNT_INVALID';
  end if;
  updated_definition := regexp_replace(function_definition, basis_case_pattern, replacement_basis_case, 'gi');
  if updated_definition = function_definition then
    raise exception 'SALARY_APPLICATION_BASIS_CASE_REPLACEMENT_FAILED';
  end if;
  function_definition := updated_definition;

  definition_count := (
    char_length(function_definition)
    - char_length(replace(function_definition, route_assignment, ''))
  ) / char_length(route_assignment);
  if definition_count <> 1 then
    raise exception 'SALARY_APPLICATION_ROUTE_ASSIGNMENT_COUNT_INVALID';
  end if;
  updated_definition := replace(
    function_definition,
    route_assignment,
    route_assignment || E'\n' || basis_validation
  );
  if updated_definition = function_definition then
    raise exception 'SALARY_APPLICATION_BASIS_VALIDATION_INSERT_FAILED';
  end if;
  execute updated_definition;

  select pg_get_functiondef(combined_function) into function_definition;
  select count(*) into definition_count
  from regexp_matches(function_definition, basis_case_pattern, 'gi');
  if definition_count <> 1 then
    raise exception 'COMBINED_SALARY_APPLICATION_BASIS_CASE_COUNT_INVALID';
  end if;
  updated_definition := regexp_replace(function_definition, basis_case_pattern, replacement_basis_case, 'gi');
  if updated_definition = function_definition then
    raise exception 'COMBINED_SALARY_APPLICATION_BASIS_CASE_REPLACEMENT_FAILED';
  end if;
  function_definition := updated_definition;

  definition_count := (
    char_length(function_definition)
    - char_length(replace(function_definition, route_assignment, ''))
  ) / char_length(route_assignment);
  if definition_count <> 1 then
    raise exception 'COMBINED_SALARY_APPLICATION_ROUTE_ASSIGNMENT_COUNT_INVALID';
  end if;
  updated_definition := replace(
    function_definition,
    route_assignment,
    route_assignment || E'\n' || basis_validation
  );
  if updated_definition = function_definition then
    raise exception 'COMBINED_SALARY_APPLICATION_BASIS_VALIDATION_INSERT_FAILED';
  end if;
  execute updated_definition;

  if (select prosecdef from pg_proc where oid = salary_function)
     or (select prosecdef from pg_proc where oid = combined_function) then
    raise exception 'SALARY_APPLICATION_RPC_BECAME_SECURITY_DEFINER';
  end if;
  if (select proacl from pg_proc where oid = salary_function) is distinct from salary_acl
     or (select proacl from pg_proc where oid = combined_function) is distinct from combined_acl then
    raise exception 'SALARY_APPLICATION_RPC_GRANTS_CHANGED';
  end if;

  select pg_get_functiondef(salary_function) into function_definition;
  if position('CAO_SCALE_REQUIRED' in function_definition) = 0
     or position('requested_payload ->> ''salaryBasis''' in function_definition) = 0 then
    raise exception 'SALARY_APPLICATION_CAO_BASIS_READBACK_FAILED';
  end if;
  select pg_get_functiondef(combined_function) into function_definition;
  if position('CAO_SCALE_REQUIRED' in function_definition) = 0
     or position('requested_payload ->> ''salaryBasis''' in function_definition) = 0 then
    raise exception 'COMBINED_SALARY_APPLICATION_CAO_BASIS_READBACK_FAILED';
  end if;
end;
$$;

select pg_notify('pgrst', 'reload schema');
