-- Read-only contract checks for the Talent management completion migration.
do $$
begin
  if to_regclass('public.talent_capability_tags') is null then
    raise exception 'talent_capability_tags is missing';
  end if;
  if not exists (
    select 1 from pg_class table_info
    where table_info.oid = 'public.talent_capability_tags'::regclass
      and table_info.relrowsecurity
  ) then
    raise exception 'talent_capability_tags must have RLS enabled';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'talent_capability_tags'
      and policyname = 'talent_capability_tags_talent_read'
  ) then
    raise exception 'Talent tag relation read policy is missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'star_performer_tags'
      and policyname = 'star_performer_tags_read'
      and qual like '%talent:read%'
      and qual like '%talent:manage%'
  ) then
    raise exception 'Talent Cloud Tag read access is missing from the canonical read policy';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'star_performer_tags'
      and policyname = 'star_performer_tags_talent_read'
  ) then
    raise exception 'Redundant Talent Cloud Tag read policy remains';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'talent_categories'
      and column_name = 'capability_types'
  ) then
    raise exception 'Category typescope is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'talent_capabilities'
      and column_name = 'language_cefr'
  ) then
    raise exception 'Language CEFR field is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'talent_capabilities'
      and column_name = 'certificate_is_permanent'
  ) then
    raise exception 'Certificate metadata field is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.talent_capability_level_content'::regclass
      and tgname = 'talent_level_model_lock_on_capability_level_content'
  ) then
    raise exception 'Level model content lock trigger is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.talent_capabilities'::regclass
      and tgname = 'talent_capability_normalize_name'
  ) then
    raise exception 'Capability name normalization trigger is missing';
  end if;
end;
$$;
