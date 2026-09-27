-- DOC02 optional placeholders are part of canonical placeholder metadata.
-- Keep the exact-key validator closed everywhere else.
create or replace function internal_security.document_studio_assert_object_keys(
  requested_value jsonb,
  requested_required text[],
  requested_allowed text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  placeholder_attributes boolean := coalesce(
    requested_allowed = array['field']::text[]
    or requested_allowed = array['field', 'temporal']::text[]
    or requested_allowed = array['key']::text[],
    false
  );
begin
  if jsonb_typeof(requested_value) <> 'object'
    or exists (
      select 1
      from unnest(coalesce(requested_required, array[]::text[])) required_key
      where not requested_value ? required_key
    )
    or exists (
      select 1
      from jsonb_object_keys(requested_value) actual_key
      where not actual_key = any(coalesce(requested_allowed, array[]::text[]))
        and not (placeholder_attributes and actual_key = 'optional')
    )
    or (
      requested_value ? 'optional'
      and (
        not placeholder_attributes
        or jsonb_typeof(requested_value -> 'optional') <> 'boolean'
      )
    ) then
    raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023';
  end if;
end;
$$;
