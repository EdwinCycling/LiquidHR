begin;

-- AN-4 bewaart uitsluitend een door de AnalysisSpec V1-grens toegestane
-- definitie. De database valideert dezelfde gesloten vorm opnieuw, zodat een
-- alternatieve writer geen willekeurige JSONB kan opslaan.
create or replace function internal_security.is_valid_saved_analysis_spec(candidate jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  filter_item jsonb;
  filter_value jsonb;
  filter_dimension text;
  filter_operator text;
begin
  if candidate is null or jsonb_typeof(candidate) <> 'object' then
    return false;
  end if;

  if exists (
    select 1
    from (
      values
        ('version'),
        ('source'),
        ('entity'),
        ('measures'),
        ('dimensions'),
        ('filters'),
        ('sort'),
        ('limit'),
        ('presentation')
    ) as required_key(key)
    where not (candidate ? required_key.key)
  )
    or exists (
      select 1
      from jsonb_object_keys(candidate) as object_key
      where object_key not in (
        'version', 'source', 'entity', 'measures', 'dimensions',
        'filters', 'sort', 'limit', 'presentation'
      )
    ) then
    return false;
  end if;

  if jsonb_typeof(candidate -> 'version') <> 'number'
    or candidate -> 'version' <> '1'::jsonb
    or jsonb_typeof(candidate -> 'source') <> 'string'
    or candidate ->> 'source' <> 'workforce'
    or jsonb_typeof(candidate -> 'entity') <> 'string'
    or candidate ->> 'entity' <> 'employees'
    or jsonb_typeof(candidate -> 'measures') <> 'array'
    or candidate -> 'measures' <> '["headcount"]'::jsonb
    or jsonb_typeof(candidate -> 'limit') <> 'number'
    or (candidate ->> 'limit') !~ '^([1-9][0-9]?|100)$'
    or jsonb_typeof(candidate -> 'presentation') <> 'string'
    or candidate ->> 'presentation' not in ('auto', 'kpi', 'table') then
    return false;
  end if;

  if jsonb_typeof(candidate -> 'dimensions') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate -> 'dimensions') > 1 then
    return false;
  end if;

  if jsonb_typeof(candidate -> 'filters') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate -> 'filters') > 20 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(candidate -> 'dimensions') as element(value)
    where jsonb_typeof(element.value) <> 'string'
      or element.value #>> '{}' not in ('department', 'job', 'employment_status')
  ) then
    return false;
  end if;

  if candidate ->> 'presentation' = 'kpi'
    and jsonb_array_length(candidate -> 'dimensions') > 0 then
    return false;
  end if;

  if candidate -> 'sort' <> 'null'::jsonb then
    if jsonb_typeof(candidate -> 'sort') <> 'object' then
      return false;
    end if;
    if (select count(*) from jsonb_object_keys(candidate -> 'sort')) <> 2
      or exists (
        select 1
        from jsonb_object_keys(candidate -> 'sort') as object_key
        where object_key not in ('by', 'direction')
      )
      or jsonb_typeof(candidate -> 'sort' -> 'by') <> 'string'
      or candidate -> 'sort' ->> 'by' not in ('label', 'value')
      or jsonb_typeof(candidate -> 'sort' -> 'direction') <> 'string'
      or candidate -> 'sort' ->> 'direction' not in ('asc', 'desc') then
      return false;
    end if;
  end if;

  for filter_item in
    select value
    from jsonb_array_elements(candidate -> 'filters') as element(value)
  loop
    if jsonb_typeof(filter_item) <> 'object' then
      return false;
    end if;
    if (select count(*) from jsonb_object_keys(filter_item)) <> 3
      or exists (
        select 1
        from jsonb_object_keys(filter_item) as object_key
        where object_key not in ('dimension', 'operator', 'value')
      )
      or jsonb_typeof(filter_item -> 'dimension') <> 'string'
      or filter_item ->> 'dimension' not in ('department', 'job', 'employment_status')
      or jsonb_typeof(filter_item -> 'operator') <> 'string'
      or filter_item ->> 'operator' not in ('eq', 'in') then
      return false;
    end if;

    filter_dimension := filter_item ->> 'dimension';
    filter_operator := filter_item ->> 'operator';
    filter_value := filter_item -> 'value';

    if filter_operator = 'eq' then
      if jsonb_typeof(filter_value) <> 'string'
        or btrim(filter_value #>> '{}') = ''
        or char_length(filter_value #>> '{}') > 160
        or (
          filter_dimension = 'employment_status'
          and filter_value #>> '{}' not in (
            'NEVER_EMPLOYED', 'FUTURE_EMPLOYEE', 'ACTIVE_EMPLOYEE', 'FORMER_EMPLOYEE'
          )
        ) then
        return false;
      end if;
    else
      if jsonb_typeof(filter_value) <> 'array' then
        return false;
      end if;
      if jsonb_array_length(filter_value) < 1
        or jsonb_array_length(filter_value) > 100
        or exists (
          select 1
          from jsonb_array_elements(filter_value) as element(value)
          where jsonb_typeof(element.value) <> 'string'
            or btrim(element.value #>> '{}') = ''
            or char_length(element.value #>> '{}') > 160
            or (
              filter_dimension = 'employment_status'
              and element.value #>> '{}' not in (
                'NEVER_EMPLOYED', 'FUTURE_EMPLOYEE', 'ACTIVE_EMPLOYEE', 'FORMER_EMPLOYEE'
              )
            )
        ) then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$function$;

revoke all on function internal_security.is_valid_saved_analysis_spec(jsonb) from public, anon, authenticated;
grant usage on schema internal_security to service_role;
grant execute on function internal_security.is_valid_saved_analysis_spec(jsonb) to service_role;

create table public.saved_analysis_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  owner_user_id uuid not null
    references auth.users(id) on delete restrict,
  name text not null
    constraint saved_analysis_definitions_name_check
      check (char_length(btrim(name)) between 1 and 120),
  definition_version integer not null default 1
    constraint saved_analysis_definitions_version_check
      check (definition_version = 1),
  analysis_spec jsonb not null
    constraint saved_analysis_definitions_spec_check
      check (internal_security.is_valid_saved_analysis_spec(analysis_spec)),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint saved_analysis_definitions_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict
);

create index saved_analysis_definitions_owner_scope_idx
  on public.saved_analysis_definitions (tenant_id, hr_group_id, owner_user_id, updated_at desc);

create trigger set_saved_analysis_definitions_updated_at
before update on public.saved_analysis_definitions
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.prevent_saved_analysis_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.hr_group_id is distinct from old.hr_group_id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.definition_version is distinct from old.definition_version then
    raise exception using
      errcode = '42501',
      message = 'SAVED_ANALYSIS_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$function$;

revoke all on function internal_security.prevent_saved_analysis_identity_change() from public, anon, authenticated;
grant execute on function internal_security.prevent_saved_analysis_identity_change() to service_role;

create trigger prevent_saved_analysis_identity_change
before update of tenant_id, hr_group_id, owner_user_id, definition_version
on public.saved_analysis_definitions
for each row execute function internal_security.prevent_saved_analysis_identity_change();

alter table public.saved_analysis_definitions enable row level security;

-- Deze policies blijven defense-in-depth voor een eventuele toekomstige grant.
-- De gekozen cookie-context zit niet in auth.jwt(); directe tabeltoegang blijft
-- daarom volledig dicht en de serverlaag bepaalt de actieve scope.
create policy saved_analysis_definitions_select_own_scope
on public.saved_analysis_definitions
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'dashboard:read'))
);

create policy saved_analysis_definitions_insert_own_scope
on public.saved_analysis_definitions
for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'dashboard:read'))
);

create policy saved_analysis_definitions_update_own_scope
on public.saved_analysis_definitions
for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'dashboard:read'))
)
with check (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'dashboard:read'))
);

create policy saved_analysis_definitions_delete_own_scope
on public.saved_analysis_definitions
for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'dashboard:read'))
);

revoke all on public.saved_analysis_definitions from public, anon, authenticated;
grant select, insert, update, delete on public.saved_analysis_definitions to service_role;

comment on table public.saved_analysis_definitions is
  'Persoonlijke, versioned AnalysisSpec-definities; bevat alleen configuratie.';
comment on column public.saved_analysis_definitions.analysis_spec is
  'Gesloten AnalysisSpec V1; bij openen wordt actuele geautoriseerde data opnieuw opgehaald.';

commit;
