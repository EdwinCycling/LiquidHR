-- Read-only contract checks for Talent Milestone 9 hardening.
do $$
declare
  table_name text;
  expected_tables constant text[] := array[
    'talent_level_models', 'talent_levels', 'talent_seniorities',
    'talent_categories', 'talent_capabilities', 'talent_capability_level_content',
    'talent_capability_tags', 'job_families', 'job_groups', 'jobs',
    'job_profiles', 'job_profile_versions', 'job_profile_capability_requirements'
  ];
begin
  foreach table_name in array expected_tables loop
    if not exists (
      select 1
      from pg_class
      where oid = format('public.%I', table_name)::regclass
        and relrowsecurity
    ) then
      raise exception 'Talent release gate: RLS ontbreekt op %', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.jobs'::regclass and tgname = 'jobs_talent_audit'
  ) then
    raise exception 'Talent release gate: jobs audit trigger ontbreekt';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.job_groups'::regclass and tgname = 'job_groups_talent_audit'
  ) then
    raise exception 'Talent release gate: job_groups audit trigger ontbreekt';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.job_revisions'::regclass and tgname = 'job_revisions_talent_audit'
  ) then
    raise exception 'Talent release gate: job_revisions audit trigger ontbreekt';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.job_group_jobs'::regclass and tgname = 'job_group_jobs_talent_audit'
  ) then
    raise exception 'Talent release gate: job_group_jobs audit trigger ontbreekt';
  end if;

  if has_function_privilege('anon', 'public.get_my_talent_profile(uuid)', 'execute') then
    raise exception 'Talent release gate: anon mag self-profile RPC niet uitvoeren';
  end if;
  if has_function_privilege('anon', 'public.get_my_talent_profile_requirements(uuid, uuid)', 'execute') then
    raise exception 'Talent release gate: anon mag self-profile requirements RPC niet uitvoeren';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'talent_capability_tags_tenant_tag_idx',
        'job_profile_versions_one_draft_per_profile_idx',
        'talent_capabilities_tenant_id_capability_type_normalized_na_key'
      )
    group by schemaname
    having count(*) = 3
  ) then
    raise exception 'Talent release gate: expected Talent indexes ontbreken';
  end if;
end;
$$;
