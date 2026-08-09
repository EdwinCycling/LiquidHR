create or replace function internal_security.process_document_reference_allowed(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_field jsonb,
  requested_value jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  scalar_value text;
  requested_document_id uuid;
begin
  if requested_field ->> 'type' <> 'DOCUMENT_REFERENCE' then return false; end if;
  if requested_value is null or requested_value = 'null'::jsonb then return true; end if;
  if pg_catalog.jsonb_typeof(requested_value) not in ('string', 'object') then return false; end if;
  scalar_value := coalesce(requested_value ->> 'id', requested_value #>> '{}');
  if scalar_value is null or scalar_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  requested_document_id := scalar_value::uuid;
  return exists (
    select 1
    from public.employee_documents document
    where document.id = requested_document_id
      and document.tenant_id = requested_tenant_id
      and document.deleted_at is null
      and internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id) is not null
      and internal_security.can_access_document(document.id, 'document:read')
  );
exception when others then
  return false;
end;
$$;

revoke all on function internal_security.process_document_reference_allowed(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;

do $migration$
declare
  definition text;
  updated_definition text;
begin
  select pg_catalog.pg_get_functiondef('internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text)'::pg_catalog.regprocedure)
    into definition;
  if pg_catalog.strpos(definition, 'process_document_reference_allowed') = 0 then
    updated_definition := replace(
    definition,
    $$    if (existing_current -> field_key) is distinct from (incoming_current -> field_key) then raise exception 'CURRENT_VALUE_CHANGED' using errcode = 'P0001'; end if;
  end loop;$$,
    $$    if (existing_current -> field_key) is distinct from (incoming_current -> field_key) then raise exception 'CURRENT_VALUE_CHANGED' using errcode = 'P0001'; end if;
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and not internal_security.process_form_value_is_empty(incoming_current -> field_key)
      and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, incoming_current -> field_key) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;$$
    );
    updated_definition := replace(
    updated_definition,
    $$    value := incoming_new -> field_key;
    if not internal_security.process_form_value_is_valid(field, value) then raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001'; end if;
  end loop;$$,
    $$    value := incoming_new -> field_key;
    if not internal_security.process_form_value_is_valid(field, value) then raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001'; end if;
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;$$
    );
    updated_definition := replace(
    updated_definition,
    $$    if mode_name in ('WRITE_OPTIONAL', 'WRITE_REQUIRED')
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_form_value_is_valid(field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;$$,
    $$    if mode_name in ('WRITE_OPTIONAL', 'WRITE_REQUIRED')
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_form_value_is_valid(field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;$$
    );
    if updated_definition = definition then raise exception 'P5_DOCUMENT_REFERENCE_SAVE_PATCH_NOT_APPLIED'; end if;
    execute updated_definition;
  end if;

  select pg_catalog.pg_get_functiondef('internal_security.prepare_process_form_action(uuid, text)'::pg_catalog.regprocedure)
    into definition;
  if pg_catalog.strpos(definition, 'process_document_reference_allowed') = 0 then
    updated_definition := replace(
    definition,
    $$      if mode_name in ('WRITE_OPTIONAL', 'WRITE_REQUIRED')
        and not internal_security.process_form_value_is_empty(value)
        and not internal_security.process_form_value_is_valid(field, value) then
        raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
      end if;$$,
    $$      if mode_name in ('WRITE_OPTIONAL', 'WRITE_REQUIRED')
        and not internal_security.process_form_value_is_empty(value)
        and not internal_security.process_form_value_is_valid(field, value) then
        raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
      end if;
      if field ->> 'type' = 'DOCUMENT_REFERENCE'
        and not internal_security.process_form_value_is_empty(value)
        and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, value) then
        raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
      end if;$$
    );
    if updated_definition = definition then raise exception 'P5_DOCUMENT_REFERENCE_PREPARE_PATCH_NOT_APPLIED'; end if;
    execute updated_definition;
  end if;

  select pg_catalog.pg_get_functiondef('internal_security.get_process_form_projection(uuid, text)'::pg_catalog.regprocedure)
    into definition;
  if pg_catalog.strpos(definition, 'process_document_reference_allowed') = 0 then
    updated_definition := replace(
    definition,
    $$  for section in select value from pg_catalog.jsonb_array_elements(coalesce(form_definition -> 'sections', '[]'::jsonb)) value loop$$,
    $$  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and (
        (not internal_security.process_form_value_is_empty(coalesce(response_row.current_values, '{}'::jsonb) -> (field ->> 'key'))
          and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, coalesce(response_row.current_values, '{}'::jsonb) -> (field ->> 'key')))
        or (not internal_security.process_form_value_is_empty(coalesce(response_row.new_values, '{}'::jsonb) -> (field ->> 'key'))
          and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, coalesce(response_row.new_values, '{}'::jsonb) -> (field ->> 'key')))
      ) then
      fields_for_conditions := fields_for_conditions - (field ->> 'key');
    end if;
  end loop;

  for section in select value from pg_catalog.jsonb_array_elements(coalesce(form_definition -> 'sections', '[]'::jsonb)) value loop$$
    );
    updated_definition := replace(
    updated_definition,
    $$      current_value := coalesce(response_row.current_values, '{}'::jsonb) -> field_key;
      new_value := coalesce(response_row.new_values, '{}'::jsonb) -> field_key;
      label_text := coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl');$$,
    $$      current_value := coalesce(response_row.current_values, '{}'::jsonb) -> field_key;
      new_value := coalesce(response_row.new_values, '{}'::jsonb) -> field_key;
      if field ->> 'type' = 'DOCUMENT_REFERENCE'
        and (
          (not internal_security.process_form_value_is_empty(current_value)
            and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, current_value))
          or (not internal_security.process_form_value_is_empty(new_value)
            and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, new_value))
        ) then
        current_value := null;
        new_value := null;
      end if;
      label_text := coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl');$$
    );
    if updated_definition = definition then raise exception 'P5_DOCUMENT_REFERENCE_PROJECTION_PATCH_NOT_APPLIED'; end if;
    execute updated_definition;
  end if;
end;
$migration$;
