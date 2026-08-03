-- M2.0 security and scope contract.
-- The audit grant assertions pass only after the security-hardening migration.
do $$
declare
  table_name text;
  expected_foundation_tables constant text[] := array[
    'talent_level_models', 'talent_levels', 'talent_seniorities',
    'talent_categories', 'talent_capabilities',
    'talent_capability_level_content', 'job_families',
    'job_profiles', 'job_profile_versions',
    'job_profile_capability_requirements'
  ];
  proposed_phase2_permissions constant text[] := array[
    'talent-record:read', 'talent-record:write',
    'self:talent-record:read', 'self:talent-record:write',
    'talent-qualification:read', 'talent-qualification:write',
    'self:talent-qualification:read', 'talent-assessment:manage',
    'talent-assessment:read', 'talent-assessment:write',
    'self:talent-assessment:read', 'self:talent-assessment:write',
    'talent-team:read', 'talent-comparison:read',
    'talent-import:manage', 'talent-goal:read', 'talent-goal:write',
    'self:talent-goal:read', 'self:talent-goal:write',
    'talent-export:read', 'talent-audit:read'
  ];
begin
  foreach table_name in array expected_foundation_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'M2.0 baseline: existing Talent foundation table ontbreekt: %', table_name;
    end if;
    if not exists (
      select 1
      from pg_class
      where oid = format('public.%I', table_name)::regclass
        and relrowsecurity
    ) then
      raise exception 'M2.0 baseline: RLS ontbreekt op %', table_name;
    end if;
  end loop;

  foreach table_name in array proposed_phase2_permissions loop
    if exists (select 1 from public.permissions where code = table_name) then
      raise exception 'M2.0 scope guard: fase-2-permission is vóór review ge-seed: %', table_name;
    end if;
  end loop;

  if exists (select 1 from public.permissions where code = 'talent-audit:read') then
    raise exception 'M2.0 scope guard: talent-audit:read moet eerst met de bestaande permissioncatalogus worden geharmoniseerd';
  end if;

  if has_table_privilege('anon', 'public.audit_logs', 'SELECT')
     or has_table_privilege('anon', 'public.audit_logs', 'INSERT')
     or has_table_privilege('anon', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('anon', 'public.audit_logs', 'DELETE') then
    raise exception 'M2.0 gegevensbescherming: anon heeft nog tabelgrants op public.audit_logs';
  end if;

  if has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') then
    raise exception 'M2.0 auditcontract: authenticated mag audit_logs niet wijzigen of verwijderen';
  end if;

  if not exists (
    select 1 from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'internal_security'
      and pg_proc.proname = 'current_user_has_permission'
  ) then
    raise exception 'M2.0 baseline: centrale RLS-permissionhelper ontbreekt';
  end if;

end;
$$;
