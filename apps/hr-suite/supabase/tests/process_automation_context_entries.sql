-- Contractcheck voor de employment-contextprojectie en de private wrappergrant.
do $$
declare
  internal_function oid;
  public_function oid;
begin
  select p.oid
    into internal_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'internal_security'
    and p.proname = 'get_process_work_projection_for_employment'
    and pg_get_function_identity_arguments(p.oid) = 'requested_hr_group_id uuid, requested_employment_id uuid, requested_administration_id uuid, requested_tab text, requested_search text, requested_status text, requested_process_definition_id uuid, requested_language text, requested_sort text, requested_limit integer, requested_offset integer';

  if internal_function is null then
    raise exception 'P9_CONTEXT_INTERNAL_FUNCTION_MISSING';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = internal_function) then
    raise exception 'P9_CONTEXT_INTERNAL_FUNCTION_NOT_SECURITY_DEFINER';
  end if;
  if not has_function_privilege('authenticated', internal_function, 'EXECUTE') then
    raise exception 'P9_CONTEXT_INTERNAL_FUNCTION_GRANT_MISSING';
  end if;
  if has_function_privilege('anon', internal_function, 'EXECUTE') then
    raise exception 'P9_CONTEXT_INTERNAL_FUNCTION_ANON_GRANT_PRESENT';
  end if;

  select p.oid
    into public_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_process_work_projection_for_employment'
    and pg_get_function_identity_arguments(p.oid) = 'requested_hr_group_id uuid, requested_employment_id uuid, requested_administration_id uuid, requested_tab text, requested_search text, requested_status text, requested_process_definition_id uuid, requested_language text, requested_sort text, requested_limit integer, requested_offset integer';

  if public_function is null then
    raise exception 'P9_CONTEXT_PUBLIC_FUNCTION_MISSING';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = public_function) then
    raise exception 'P9_CONTEXT_PUBLIC_FUNCTION_SHOULD_BE_INVOKER';
  end if;
  if not has_function_privilege('authenticated', public_function, 'EXECUTE') then
    raise exception 'P9_CONTEXT_PUBLIC_FUNCTION_GRANT_MISSING';
  end if;
  if has_function_privilege('anon', public_function, 'EXECUTE') then
    raise exception 'P9_CONTEXT_PUBLIC_FUNCTION_ANON_GRANT_PRESENT';
  end if;
end;
$$;
