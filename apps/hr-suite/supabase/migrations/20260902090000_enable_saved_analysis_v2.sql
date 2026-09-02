begin;

-- V2 persistence is a forward-compatible extension of the existing personal
-- definition store. It stores no execution result or source data.
alter table public.saved_analysis_definitions
  drop constraint if exists saved_analysis_definitions_version_check;

alter table public.saved_analysis_definitions
  add constraint saved_analysis_definitions_version_check
  check (definition_version in (1, 2));

create or replace function internal_security.is_valid_saved_analysis_date(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when candidate is null or candidate !~ '^\d{4}-\d{2}-\d{2}$' then false
    when substring(candidate from 6 for 2)::integer not between 1 and 12 then false
    when substring(candidate from 9 for 2)::integer < 1 then false
    when substring(candidate from 9 for 2)::integer > case
      when substring(candidate from 6 for 2)::integer in (4, 6, 9, 11) then 30
      when substring(candidate from 6 for 2)::integer = 2 then
        28 + case
          when substring(candidate from 1 for 4)::integer % 400 = 0
            or (substring(candidate from 1 for 4)::integer % 4 = 0 and substring(candidate from 1 for 4)::integer % 100 <> 0)
            then 1
          else 0
        end
      else 31
    end then false
    else true
  end;
$function$;

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
  comparison_period jsonb;
begin
  if candidate is null or jsonb_typeof(candidate) <> 'object' then
    return false;
  end if;

  -- Keep the original V1 validator behavior unchanged inside the version
  -- branch. V1 has no period or comparison field.
  if candidate -> 'version' = '1'::jsonb then
    if exists (
      select 1
      from (
        values
          ('version'), ('source'), ('entity'), ('measures'), ('dimensions'),
          ('filters'), ('sort'), ('limit'), ('presentation')
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

    if jsonb_typeof(candidate -> 'dimensions') <> 'array'
      or jsonb_array_length(candidate -> 'dimensions') > 1 then
      return false;
    end if;
    if jsonb_typeof(candidate -> 'filters') <> 'array'
      or jsonb_array_length(candidate -> 'filters') > 20 then
      return false;
    end if;
    if exists (
      select 1 from jsonb_array_elements(candidate -> 'dimensions') as element(value)
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
      if jsonb_typeof(candidate -> 'sort') <> 'object'
        or (select count(*) from jsonb_object_keys(candidate -> 'sort')) <> 2
        or exists (select 1 from jsonb_object_keys(candidate -> 'sort') as object_key where object_key not in ('by', 'direction'))
        or jsonb_typeof(candidate -> 'sort' -> 'by') <> 'string'
        or candidate -> 'sort' ->> 'by' not in ('label', 'value')
        or jsonb_typeof(candidate -> 'sort' -> 'direction') <> 'string'
        or candidate -> 'sort' ->> 'direction' not in ('asc', 'desc') then
        return false;
      end if;
    end if;

    for filter_item in select value from jsonb_array_elements(candidate -> 'filters') as element(value) loop
      if jsonb_typeof(filter_item) <> 'object'
        or (select count(*) from jsonb_object_keys(filter_item)) <> 3
        or exists (select 1 from jsonb_object_keys(filter_item) as object_key where object_key not in ('dimension', 'operator', 'value'))
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
          or (filter_dimension = 'employment_status' and filter_value #>> '{}' not in ('NEVER_EMPLOYED', 'FUTURE_EMPLOYEE', 'ACTIVE_EMPLOYEE', 'FORMER_EMPLOYEE')) then
          return false;
        end if;
      else
        if jsonb_typeof(filter_value) <> 'array'
          or jsonb_array_length(filter_value) < 1
          or jsonb_array_length(filter_value) > 100
          or exists (select 1 from jsonb_array_elements(filter_value) as element(value) where jsonb_typeof(element.value) <> 'string' or btrim(element.value #>> '{}') = '' or char_length(element.value #>> '{}') > 160 or (filter_dimension = 'employment_status' and element.value #>> '{}' not in ('NEVER_EMPLOYED', 'FUTURE_EMPLOYEE', 'ACTIVE_EMPLOYEE', 'FORMER_EMPLOYEE'))) then
          return false;
        end if;
      end if;
    end loop;
    return true;
  end if;

  if candidate -> 'version' <> '2'::jsonb then
    return false;
  end if;

  -- V2 is a closed, aggregate-only snapshot definition. Every nested object
  -- is checked for both required and unknown keys.
  if exists (
    select 1 from (
      values ('version'), ('source'), ('entity'), ('measures'), ('dimensions'),
             ('filters'), ('period'), ('comparison'), ('sort'), ('limit'), ('presentation')
    ) as required_key(key)
    where not (candidate ? required_key.key)
  ) or exists (
    select 1 from jsonb_object_keys(candidate) as object_key
    where object_key not in ('version', 'source', 'entity', 'measures', 'dimensions', 'filters', 'period', 'comparison', 'sort', 'limit', 'presentation')
  ) then
    return false;
  end if;

  if jsonb_typeof(candidate -> 'version') <> 'number'
    or jsonb_typeof(candidate -> 'source') <> 'string'
    or candidate ->> 'source' <> 'workforce'
    or jsonb_typeof(candidate -> 'entity') <> 'string'
    or candidate ->> 'entity' <> 'employees'
    or jsonb_typeof(candidate -> 'measures') <> 'array'
    or candidate -> 'measures' <> '["headcount"]'::jsonb
    or jsonb_typeof(candidate -> 'dimensions') <> 'array'
    or jsonb_array_length(candidate -> 'dimensions') > 2
    or jsonb_typeof(candidate -> 'filters') <> 'array'
    or jsonb_array_length(candidate -> 'filters') > 8
    or jsonb_typeof(candidate -> 'limit') <> 'number'
    or (candidate ->> 'limit') !~ '^([1-9][0-9]?|100)$'
    or jsonb_typeof(candidate -> 'presentation') <> 'object'
    or (select count(*) from jsonb_object_keys(candidate -> 'presentation')) <> 1
    or exists (select 1 from jsonb_object_keys(candidate -> 'presentation') as object_key where object_key not in ('intent'))
    or jsonb_typeof(candidate -> 'presentation' -> 'intent') <> 'string'
    or candidate -> 'presentation' ->> 'intent' not in ('auto', 'kpi', 'table', 'comparison') then
    return false;
  end if;

  if exists (
    select 1 from jsonb_array_elements(candidate -> 'dimensions') as element(value)
    where jsonb_typeof(element.value) <> 'string'
      or element.value #>> '{}' not in ('department', 'job', 'employment_type')
  ) or (
    select count(distinct element.value #>> '{}') from jsonb_array_elements(candidate -> 'dimensions') as element(value)
  ) <> jsonb_array_length(candidate -> 'dimensions') then
    return false;
  end if;
  if candidate -> 'presentation' ->> 'intent' = 'kpi' and jsonb_array_length(candidate -> 'dimensions') > 0 then
    return false;
  end if;

  if jsonb_typeof(candidate -> 'period') <> 'object'
    or (select count(*) from jsonb_object_keys(candidate -> 'period')) <> 2
    or exists (select 1 from jsonb_object_keys(candidate -> 'period') as object_key where object_key not in ('kind', 'asOf'))
    or candidate -> 'period' ->> 'kind' <> 'snapshot'
    or jsonb_typeof(candidate -> 'period' -> 'asOf') <> 'string'
    or candidate -> 'period' ->> 'asOf' !~ '^\d{4}-\d{2}-\d{2}$'
    or not internal_security.is_valid_saved_analysis_date(candidate -> 'period' ->> 'asOf') then
    return false;
  end if;

  if candidate -> 'comparison' <> 'null'::jsonb then
    if jsonb_typeof(candidate -> 'comparison') <> 'object'
      or (select count(*) from jsonb_object_keys(candidate -> 'comparison')) <> 2
      or exists (select 1 from jsonb_object_keys(candidate -> 'comparison') as object_key where object_key not in ('kind', 'period'))
      or candidate -> 'comparison' ->> 'kind' <> 'explicit_period'
      or jsonb_typeof(candidate -> 'comparison' -> 'period') <> 'object'
      or (select count(*) from jsonb_object_keys(candidate -> 'comparison' -> 'period')) <> 2
      or exists (select 1 from jsonb_object_keys(candidate -> 'comparison' -> 'period') as object_key where object_key not in ('kind', 'asOf'))
      or candidate -> 'comparison' -> 'period' ->> 'kind' <> 'snapshot'
      or jsonb_typeof(candidate -> 'comparison' -> 'period' -> 'asOf') <> 'string'
      or candidate -> 'comparison' -> 'period' ->> 'asOf' !~ '^\d{4}-\d{2}-\d{2}$'
      or not internal_security.is_valid_saved_analysis_date(candidate -> 'comparison' -> 'period' ->> 'asOf')
      or candidate -> 'comparison' -> 'period' ->> 'asOf' = candidate -> 'period' ->> 'asOf' then
      return false;
    end if;
  end if;

  if candidate -> 'sort' <> 'null'::jsonb then
    if jsonb_typeof(candidate -> 'sort') <> 'object'
      or jsonb_typeof(candidate -> 'sort' -> 'by') <> 'string'
      or candidate -> 'sort' ->> 'by' not in ('label', 'measure') then
      return false;
    end if;
    if candidate -> 'sort' ->> 'by' = 'label' then
      if (select count(*) from jsonb_object_keys(candidate -> 'sort')) <> 2
        or exists (select 1 from jsonb_object_keys(candidate -> 'sort') as object_key where object_key not in ('by', 'direction')) then
        return false;
      end if;
    else
      if (select count(*) from jsonb_object_keys(candidate -> 'sort')) <> 3
        or exists (select 1 from jsonb_object_keys(candidate -> 'sort') as object_key where object_key not in ('by', 'measure', 'direction'))
        or candidate -> 'sort' ->> 'measure' <> 'headcount' then
        return false;
      end if;
    end if;
    if jsonb_typeof(candidate -> 'sort' -> 'direction') <> 'string'
      or candidate -> 'sort' ->> 'direction' not in ('asc', 'desc') then
      return false;
    end if;
  end if;

  if (
    select count(distinct element.value #>> '{}')
    from jsonb_array_elements(candidate -> 'filters') as element(value)
  ) <> jsonb_array_length(candidate -> 'filters') then
    return false;
  end if;

  for filter_item in select value from jsonb_array_elements(candidate -> 'filters') as element(value) loop
    if jsonb_typeof(filter_item) <> 'object'
      or (select count(*) from jsonb_object_keys(filter_item)) <> 3
      or exists (select 1 from jsonb_object_keys(filter_item) as object_key where object_key not in ('dimension', 'operator', 'value'))
      or jsonb_typeof(filter_item -> 'dimension') <> 'string'
      or filter_item ->> 'dimension' not in ('department', 'job', 'employment_type', 'employment_status')
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
        or (filter_dimension = 'employment_status' and filter_value #>> '{}' <> 'ACTIVE_EMPLOYEE')
        or (filter_dimension = 'employment_type' and filter_value #>> '{}' not in ('EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'TEMPORARY_AGENCY', 'FREELANCER', 'VOLUNTEER', 'NO_PAYROLL')) then
        return false;
      end if;
    else
      if jsonb_typeof(filter_value) <> 'array'
        or jsonb_array_length(filter_value) < 1
        or jsonb_array_length(filter_value) > 100
        or (select count(distinct element.value #>> '{}') from jsonb_array_elements(filter_value) as element(value)) <> jsonb_array_length(filter_value)
        or exists (select 1 from jsonb_array_elements(filter_value) as element(value) where jsonb_typeof(element.value) <> 'string' or btrim(element.value #>> '{}') = '' or char_length(element.value #>> '{}') > 160 or (filter_dimension = 'employment_status' and element.value #>> '{}' <> 'ACTIVE_EMPLOYEE') or (filter_dimension = 'employment_type' and element.value #>> '{}' not in ('EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'TEMPORARY_AGENCY', 'FREELANCER', 'VOLUNTEER', 'NO_PAYROLL'))) then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$function$;

-- Existing ACLs, identity immutability, RLS and owner scope remain unchanged.
comment on column public.saved_analysis_definitions.analysis_spec is
  'Gesloten AnalysisSpec V1/V2; bij openen wordt actuele geautoriseerde data opnieuw opgehaald.';

commit;
