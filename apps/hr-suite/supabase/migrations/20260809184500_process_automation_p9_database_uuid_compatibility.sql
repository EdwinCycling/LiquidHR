begin;

-- PostgreSQL accepts UUID values whose version/variant nibbles are not RFC-labelled.
-- Reference fields must validate the database UUID shape, not an RFC 4122 version.
create or replace function internal_security.process_form_value_is_valid(
  requested_field jsonb,
  requested_value jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  field_type text := requested_field ->> 'type';
  scalar_value text;
begin
  if requested_value is null or requested_value = 'null'::jsonb then return true; end if;
  scalar_value := requested_value #>> '{}';
  if field_type in ('SHORT_TEXT', 'LONG_TEXT') then
    return pg_catalog.jsonb_typeof(requested_value) = 'string' and length(scalar_value) <= 4000;
  elsif field_type = 'INTEGER' then
    return pg_catalog.jsonb_typeof(requested_value) = 'number' and scalar_value::numeric = trunc(scalar_value::numeric);
  elsif field_type in ('DECIMAL', 'MONEY') then
    return pg_catalog.jsonb_typeof(requested_value) = 'number';
  elsif field_type = 'DATE' then
    return pg_catalog.jsonb_typeof(requested_value) = 'string' and scalar_value ~ '^\d{4}-\d{2}-\d{2}$';
  elsif field_type = 'TIME' then
    return pg_catalog.jsonb_typeof(requested_value) = 'string' and scalar_value ~ '^\d{2}:\d{2}(:\d{2})?$';
  elsif field_type = 'DATETIME' then
    return pg_catalog.jsonb_typeof(requested_value) = 'string' and scalar_value <> '';
  elsif field_type = 'BOOLEAN' then
    return pg_catalog.jsonb_typeof(requested_value) = 'boolean';
  elsif field_type = 'SINGLE_SELECT' then
    return pg_catalog.jsonb_typeof(requested_value) = 'string'
      and exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(requested_field -> 'options', '[]'::jsonb)) option where option ->> 'value' = scalar_value);
  elsif field_type = 'MULTI_SELECT' then
    return pg_catalog.jsonb_typeof(requested_value) = 'array'
      and not exists (
        select 1 from pg_catalog.jsonb_array_elements(requested_value) value
        where pg_catalog.jsonb_typeof(value) <> 'string'
          or not exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(requested_field -> 'options', '[]'::jsonb)) option where option ->> 'value' = value #>> '{}')
      );
  elsif field_type in ('EMPLOYEE_REFERENCE', 'DEPARTMENT_REFERENCE', 'JOB_REFERENCE', 'EMPLOYMENT_REFERENCE', 'DOCUMENT_REFERENCE') then
    scalar_value := coalesce(requested_value ->> 'id', scalar_value);
    return scalar_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  end if;
  return false;
exception when others then
  return false;
end;
$$;

revoke all on function internal_security.process_form_value_is_valid(jsonb, jsonb) from public, anon, authenticated;

commit;
