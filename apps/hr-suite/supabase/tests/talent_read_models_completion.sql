-- Read-only contract checks for the Milestone 7/8 Talent read models.
do $$
declare
  function_oid oid;
  demo_tenant_id uuid;
begin
  select id into demo_tenant_id
  from public.tenants
  where name = 'Liquid HR Demo Holding'
  limit 1;

  if demo_tenant_id is null then
    raise exception 'Liquid HR Demo Holding fixture tenant is missing';
  end if;

  if not exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'get_my_talent_profile'
      and pg_get_function_identity_arguments(pg_proc.oid) = 'requested_tenant_id uuid'
      and pg_proc.prosecdef
      and pg_proc.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'Hardened get_my_talent_profile RPC is missing';
  end if;

  select pg_proc.oid into function_oid
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and pg_proc.proname = 'get_my_talent_profile_requirements'
    and pg_get_function_identity_arguments(pg_proc.oid) = 'requested_tenant_id uuid, requested_profile_version_id uuid'
    and pg_proc.prosecdef
    and pg_proc.proconfig @> array['search_path=""']::text[];

  if function_oid is null then
    raise exception 'Hardened get_my_talent_profile_requirements RPC is missing';
  end if;

  if has_function_privilege('anon', function_oid, 'execute') then
    raise exception 'Talent self-profile requirements RPC must not be executable by anon';
  end if;
  if not has_function_privilege('authenticated', function_oid, 'execute') then
    raise exception 'Talent self-profile requirements RPC must be executable by authenticated';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.talent_job_profile_readmodel'::regclass
      and reloptions @> array['security_invoker=true']::text[]
  ) then
    raise exception 'Talent readmodel view must use security_invoker';
  end if;

  foreach function_oid in array array[
    'public.jobs'::regclass::oid,
    'public.job_groups'::regclass::oid,
    'public.job_profiles'::regclass::oid,
    'public.job_profile_versions'::regclass::oid,
    'public.job_profile_capability_requirements'::regclass::oid,
    'public.talent_capabilities'::regclass::oid,
    'public.talent_levels'::regclass::oid
  ] loop
    if not exists (select 1 from pg_class where oid = function_oid and relrowsecurity) then
      raise exception 'Talent read table % must have RLS enabled', function_oid::regclass;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_profile_capability_requirements'
      and policyname = 'job_profile_capability_requirements_talent_read'
      and qual like '%CURRENT_DATE%'
      and qual like '%current_employee_id%'
  ) then
    raise exception 'Manager capability requirement scope policy is incomplete';
  end if;

  if not exists (
    select 1
    from public.employees employee
    join public.employee_organizations organization
      on organization.tenant_id = employee.tenant_id
     and organization.employee_id = employee.id
    join public.jobs job
      on job.tenant_id = organization.tenant_id
     and job.id = organization.job_id
    where employee.tenant_id = demo_tenant_id
      and employee.employee_number = 'DEMO-035'
      and job.code = 'TEST-CUSTOMER'
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to > current_date)
  ) then
    raise exception 'Employee Talent fixture assignment is missing';
  end if;

  if not exists (
    select 1
    from public.employees employee
    join public.employee_organizations organization
      on organization.tenant_id = employee.tenant_id
     and organization.employee_id = employee.id
    join public.employees manager
      on manager.tenant_id = organization.tenant_id
     and manager.id = organization.direct_manager_id
    where employee.tenant_id = demo_tenant_id
      and employee.employee_number = 'DEMO-035'
      and manager.employee_number = 'DEMO-028'
      and organization.effective_from <= current_date
      and (organization.effective_to is null or organization.effective_to > current_date)
  ) then
    raise exception 'Manager direct-scope Talent fixture is missing';
  end if;
end;
$$;
