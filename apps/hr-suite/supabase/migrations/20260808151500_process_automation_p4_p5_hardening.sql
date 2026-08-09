begin;

do $$
begin
  if (select not exists (
    select 1 from pg_constraint
    where conrelid = 'public.form_versions'::regclass
      and conname = 'form_versions_tenant_hr_group_id_key'
  )) then
    alter table public.form_versions
      add constraint form_versions_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id);
  end if;
  if (select not exists (
    select 1 from pg_constraint
    where conrelid = 'public.process_form_responses'::regclass
      and conname = 'process_form_responses_form_version_fkey'
  )) then
    alter table public.process_form_responses
      add constraint process_form_responses_form_version_fkey
      foreign key (tenant_id, hr_group_id, form_version_id)
      references public.form_versions(tenant_id, hr_group_id, id)
      on delete restrict;
  end if;
end;
$$;

create or replace function internal_security.process_form_html_escape(requested_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.replace(
    pg_catalog.replace(
      pg_catalog.replace(
        pg_catalog.replace(
          pg_catalog.replace(coalesce(requested_value, ''), '&', '&amp;'),
          '<', '&lt;'
        ),
        '>', '&gt;'
      ),
      '"', '&quot;'
    ),
    '''', '&#39;'
  );
$$;

revoke all on function internal_security.process_form_html_escape(text) from public, anon, authenticated;

create or replace function internal_security.process_form_language_allowed(
  requested_definition jsonb,
  requested_language text
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select requested_language in ('nl', 'en')
    and coalesce(requested_definition -> 'enabledLanguages', '["nl"]'::jsonb)
      @> pg_catalog.to_jsonb(requested_language);
$$;

revoke all on function internal_security.process_form_language_allowed(jsonb, text) from public, anon, authenticated;

create or replace function internal_security.process_form_value_is_empty(requested_value jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select requested_value is null
    or requested_value = 'null'::jsonb
    or (pg_catalog.jsonb_typeof(requested_value) = 'string' and pg_catalog.btrim(requested_value #>> '{}') = '')
    or (pg_catalog.jsonb_typeof(requested_value) = 'array' and pg_catalog.jsonb_array_length(requested_value) = 0);
$$;

revoke all on function internal_security.process_form_value_is_empty(jsonb) from public, anon, authenticated;

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
      and exists (
        select 1
        from pg_catalog.jsonb_array_elements(coalesce(requested_field -> 'options', '[]'::jsonb)) as option_item(value)
        where option_item.value ->> 'value' = scalar_value
      );
  elsif field_type = 'MULTI_SELECT' then
    return pg_catalog.jsonb_typeof(requested_value) = 'array'
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(requested_value) as array_item(value)
        where pg_catalog.jsonb_typeof(array_item.value) <> 'string'
          or not exists (
            select 1
            from pg_catalog.jsonb_array_elements(coalesce(requested_field -> 'options', '[]'::jsonb)) as option_item(value)
            where option_item.value ->> 'value' = array_item.value #>> '{}'
          )
      );
  elsif field_type in ('EMPLOYEE_REFERENCE', 'DEPARTMENT_REFERENCE', 'JOB_REFERENCE', 'EMPLOYMENT_REFERENCE', 'DOCUMENT_REFERENCE') then
    scalar_value := coalesce(requested_value ->> 'id', scalar_value);
    return scalar_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  end if;
  return false;
exception when others then
  return false;
end;
$$;

revoke all on function internal_security.process_form_value_is_valid(jsonb, jsonb) from public, anon, authenticated;

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

create or replace function internal_security.process_form_field_required(
  requested_field jsonb,
  requested_participant_key text,
  requested_values jsonb,
  requested_subject jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_rule jsonb := internal_security.process_form_access_rule(requested_field, requested_participant_key);
  mode_name text := access_rule ->> 'mode';
  required_condition jsonb := requested_field -> 'requiredCondition';
begin
  if mode_name = 'WRITE_REQUIRED' then return true; end if;
  if mode_name <> 'WRITE_OPTIONAL' then return false; end if;
  if required_condition is null or required_condition = 'null'::jsonb then return false; end if;
  return internal_security.process_condition_matches(required_condition, requested_values, requested_subject);
end;
$$;

revoke all on function internal_security.process_form_field_required(jsonb, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function internal_security.resolve_process_form_definition(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_version_id uuid,
  requested_step_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  version_definition jsonb;
  process_content jsonb;
  step jsonb;
  form_key text;
  form_definition jsonb;
  published_form_definition jsonb;
  form_version_id uuid;
  form_version_id_text text;
begin
  select version.definition_json into version_definition
  from public.process_versions version
  where version.tenant_id = requested_tenant_id
    and version.hr_group_id = requested_hr_group_id
    and version.id = requested_process_version_id;
  process_content := internal_security.process_definition_content(version_definition);
  select value into step
  from pg_catalog.jsonb_array_elements(coalesce(process_content -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = requested_step_key;
  form_key := step ->> 'formKey';
  if form_key is null then raise exception 'FORM_REQUIRED' using errcode = 'P0001'; end if;

  select value into form_definition
  from pg_catalog.jsonb_array_elements(coalesce(process_content -> 'forms', '[]'::jsonb)) value
  where value ->> 'key' = form_key;
  if form_definition is null then raise exception 'FORM_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;

  form_version_id_text := nullif(form_definition ->> 'formVersionId', '');
  if form_version_id_text is not null then
    begin
      form_version_id := form_version_id_text::uuid;
    exception when others then
      raise exception 'FORM_VERSION_NOT_FOUND' using errcode = 'P0002';
    end;
    select internal_security.process_definition_content(form_version.definition_json)
      into published_form_definition
    from public.form_versions form_version
    join public.form_definitions definition
      on definition.tenant_id = form_version.tenant_id
     and definition.hr_group_id = form_version.hr_group_id
     and definition.id = form_version.form_definition_id
    where form_version.tenant_id = requested_tenant_id
      and form_version.hr_group_id = requested_hr_group_id
      and form_version.id = form_version_id
      and definition.status = 'PUBLISHED'::public.process_definition_status;
    if published_form_definition is null then raise exception 'FORM_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
    form_definition := published_form_definition;
  elsif pg_catalog.jsonb_typeof(form_definition -> 'sections') <> 'array' then
    raise exception 'FORM_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'formKey', form_key,
    'formVersionId', form_version_id,
    'definition', form_definition
  );
end;
$$;

revoke all on function internal_security.resolve_process_form_definition(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function internal_security.process_form_actor_allowed(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_instance_id uuid,
  requested_work_item_id uuid,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees actor
    where actor.tenant_id = requested_tenant_id
      and actor.hr_group_id = requested_hr_group_id
      and actor.id = requested_actor_employee_id
      and actor.auth_user_id = requested_actor_user_id
      and actor.is_active
      and actor.deleted_at is null
  ) and (
    exists (
      select 1
      from public.process_instances instance
      join public.process_work_items item
        on item.tenant_id = instance.tenant_id
       and item.hr_group_id = instance.hr_group_id
       and item.process_instance_id = instance.id
       and item.id = requested_work_item_id
      where instance.tenant_id = requested_tenant_id
        and instance.hr_group_id = requested_hr_group_id
        and instance.id = requested_instance_id
        and internal_security.process_scope_has_permission(
          instance.tenant_id, instance.hr_group_id, instance.scope_type,
          instance.administration_id, 'process-task:act'
        )
    )
    or exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = requested_tenant_id
        and candidate.hr_group_id = requested_hr_group_id
        and candidate.work_item_id = requested_work_item_id
        and candidate.employee_id = requested_actor_employee_id
        and candidate.candidate_user_id = requested_actor_user_id
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = requested_tenant_id
            and latest.hr_group_id = requested_hr_group_id
            and latest.work_item_id = requested_work_item_id
        )
    )
  );
$$;

revoke all on function internal_security.process_form_actor_allowed(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function internal_security.process_form_runtime_fields(requested_work_item_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(instance.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response.current_values, '{}'::jsonb)
    || coalesce(response.new_values, '{}'::jsonb)
  from public.process_work_items item
  join public.process_instances instance
    on instance.tenant_id = item.tenant_id
   and instance.hr_group_id = item.hr_group_id
   and instance.id = item.process_instance_id
  left join public.process_form_responses response
    on response.tenant_id = item.tenant_id
   and response.hr_group_id = item.hr_group_id
   and response.work_item_id = item.id
  where item.id = requested_work_item_id;
$$;

revoke all on function internal_security.process_form_runtime_fields(uuid) from public, anon, authenticated;

create or replace function internal_security.prepare_process_form_action(
  requested_work_item_id uuid,
  requested_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  form_info jsonb;
  form_definition jsonb;
  field jsonb;
  access_rule jsonb;
  subject jsonb;
  condition_values jsonb;
  value jsonb;
  mode_name text;
  field_key text;
  required boolean;
begin
  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response_row.current_values, '{}'::jsonb)
    || coalesce(response_row.new_values, '{}'::jsonb);

  if requested_action in ('SUBMIT', 'APPROVE') then
    for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
      access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
      mode_name := access_rule ->> 'mode';
      if mode_name is null or mode_name = 'HIDDEN' then continue; end if;
      if not internal_security.process_condition_matches(field -> 'visibilityCondition', condition_values, subject) then continue; end if;
      field_key := field ->> 'key';
      value := coalesce(response_row.new_values, '{}'::jsonb) -> field_key;
      required := internal_security.process_form_field_required(field, item_row.participant_key, condition_values, subject);
      if required and internal_security.process_form_value_is_empty(value) then
        raise exception 'REQUIRED_FORM_FIELD' using errcode = 'P0001';
      end if;
      if mode_name in ('WRITE_OPTIONAL', 'WRITE_REQUIRED')
        and not internal_security.process_form_value_is_empty(value)
        and not internal_security.process_form_value_is_valid(field, value) then
        raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
      end if;
      if field ->> 'type' = 'DOCUMENT_REFERENCE'
        and not internal_security.process_form_value_is_empty(value)
        and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, value) then
        raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
      end if;
    end loop;
    if response_row.id is not null then
      update public.process_form_responses
      set status = 'SUBMITTED'
      where id = response_row.id;
    end if;
  elsif requested_action = 'REQUEST_CHANGES' and response_row.id is not null then
    update public.process_form_responses
    set status = 'IN_PROGRESS'
    where id = response_row.id;
  end if;
end;
$$;

revoke all on function internal_security.prepare_process_form_action(uuid, text) from public, anon, authenticated;

create or replace function internal_security.get_process_form_projection(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  form_info jsonb;
  form_definition jsonb;
  section jsonb;
  field jsonb;
  access_rule jsonb;
  visible_fields jsonb;
  sections jsonb := '[]'::jsonb;
  summary jsonb := '[]'::jsonb;
  field_projection jsonb;
  participant_key text;
  mode_name text;
  field_key text;
  language_code text := requested_language;
  fields_for_conditions jsonb;
  subject jsonb;
  is_visible boolean;
  is_required boolean;
  current_value jsonb;
  new_value jsonb;
  label_text text;
  html_summary text := '<div data-process-form-summary="true">';
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_language not in ('nl', 'en') then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id
  for share;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id
  for share;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id
  for share;
  if instance_row.id is null or step_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if instance_row.status not in ('RUNNING'::public.process_instance_status, 'WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then
    raise exception 'PROCESS_INSTANCE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if step_row.status <> 'ACTIVE'::public.process_step_instance_status then raise exception 'STEP_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  if not coalesce(internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ), false) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
  if not internal_security.process_form_language_allowed(form_definition, language_code) then
    raise exception 'FORM_LANGUAGE_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  participant_key := item_row.participant_key;
  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id;
  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  fields_for_conditions := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb)
    || coalesce(response_row.current_values, '{}'::jsonb)
    || coalesce(response_row.new_values, '{}'::jsonb);

  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
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

  for section in select value from pg_catalog.jsonb_array_elements(coalesce(form_definition -> 'sections', '[]'::jsonb)) value loop
    visible_fields := '[]'::jsonb;
    for field in select value from pg_catalog.jsonb_array_elements(coalesce(section -> 'fields', '[]'::jsonb)) value loop
      field_key := field ->> 'key';
      access_rule := internal_security.process_form_access_rule(field, participant_key);
      mode_name := access_rule ->> 'mode';
      is_visible := mode_name is not null and mode_name <> 'HIDDEN'
        and internal_security.process_condition_matches(field -> 'visibilityCondition', fields_for_conditions, subject);
      if not is_visible then continue; end if;
      is_required := internal_security.process_form_field_required(field, participant_key, fields_for_conditions, subject);
      current_value := coalesce(response_row.current_values, '{}'::jsonb) -> field_key;
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
      label_text := coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl');
      field_projection := jsonb_build_object(
        'key', field_key,
        'label', label_text,
        'helpText', coalesce(field -> 'helpText' ->> language_code, field -> 'helpText' ->> 'nl'),
        'type', field ->> 'type',
        'accessMode', mode_name,
        'required', is_required,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'value', option ->> 'value',
            'label', coalesce(option -> 'label' ->> language_code, option -> 'label' ->> 'nl')
          ) order by option ->> 'value')
          from pg_catalog.jsonb_array_elements(coalesce(field -> 'options', '[]'::jsonb)) option
        ), '[]'::jsonb),
        'currentValue', current_value,
        'newValue', new_value
      );
      visible_fields := visible_fields || pg_catalog.jsonb_build_array(field_projection);
      summary := summary || pg_catalog.jsonb_build_array(jsonb_build_object(
        'fieldKey', field_key,
        'label', label_text,
        'currentValue', current_value,
        'newValue', new_value
      ));
      html_summary := html_summary || pg_catalog.format(
        '<section data-field-key="%s" data-field-label="%s"><h3>%s</h3><dl><div data-value-kind="current"><dd>%s</dd></div><div data-value-kind="new"><dd>%s</dd></div></dl></section>',
        internal_security.process_form_html_escape(field_key),
        internal_security.process_form_html_escape(label_text),
        internal_security.process_form_html_escape(label_text),
        internal_security.process_form_html_escape(coalesce(current_value::text, 'null')),
        internal_security.process_form_html_escape(coalesce(new_value::text, 'null'))
      );
    end loop;
    if pg_catalog.jsonb_array_length(visible_fields) > 0 then
      sections := sections || pg_catalog.jsonb_build_array(jsonb_build_object(
        'key', section ->> 'key',
        'title', coalesce(section -> 'title' ->> language_code, section -> 'title' ->> 'nl'),
        'fields', visible_fields
      ));
    end if;
  end loop;
  html_summary := html_summary || '</div>';

  return jsonb_build_object(
    'responseId', response_row.id,
    'workItemId', item_row.id,
    'processInstanceId', instance_row.id,
    'stepInstanceId', step_row.id,
    'stepKey', item_row.step_key,
    'participantKey', participant_key,
    'formKey', form_info ->> 'formKey',
    'formVersionId', form_info -> 'formVersionId',
    'language', language_code,
    'status', coalesce(response_row.status, 'IN_PROGRESS'),
    'revision', coalesce(response_row.revision, 0),
    'expectedVersion', coalesce(response_row.expected_version, 0),
    'title', coalesce(form_definition -> 'title' ->> language_code, form_definition -> 'title' ->> 'nl'),
    'description', coalesce(form_definition -> 'description' ->> language_code, form_definition -> 'description' ->> 'nl'),
    'sections', sections,
    'summary', summary,
    'htmlSummary', html_summary,
    'availableLanguages', coalesce(form_definition -> 'enabledLanguages', '["nl"]'::jsonb)
  );
end;
$$;

revoke all on function internal_security.get_process_form_projection(uuid, text) from public, anon, authenticated;

create or replace function public.get_process_form_projection(
  requested_work_item_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_form_projection(requested_work_item_id, requested_language);
$$;

revoke all on function public.get_process_form_projection(uuid, text) from public, anon;
grant execute on function public.get_process_form_projection(uuid, text) to authenticated;

create or replace function internal_security.save_process_form_response(
  requested_work_item_id uuid,
  requested_expected_revision bigint,
  requested_expected_version bigint,
  requested_values jsonb,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  form_info jsonb;
  form_definition jsonb;
  field jsonb;
  access_rule jsonb;
  subject jsonb;
  incoming_current jsonb := coalesce(requested_values -> 'current', '{}'::jsonb);
  incoming_new jsonb := coalesce(requested_values -> 'new', '{}'::jsonb);
  existing_current jsonb;
  existing_new jsonb;
  merged_new jsonb;
  merged_condition_values jsonb;
  value jsonb;
  field_key text;
  mode_name text;
  response_id uuid;
  next_revision bigint;
  next_expected_version bigint;
  save_correlation_id uuid;
  has_response boolean;
  required boolean;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_language not in ('nl', 'en') then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(requested_values) <> 'object' then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(incoming_current) <> 'object' or pg_catalog.jsonb_typeof(incoming_new) <> 'object' then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id
  for update;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if instance_row.status not in ('RUNNING'::public.process_instance_status, 'WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then
    raise exception 'PROCESS_INSTANCE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if not (exists (
    select 1 from public.process_step_instances step
    where step.tenant_id = item_row.tenant_id
      and step.hr_group_id = item_row.hr_group_id
      and step.process_instance_id = item_row.process_instance_id
      and step.id = item_row.step_instance_id
      and step.status = 'ACTIVE'::public.process_step_instance_status
  )) then raise exception 'STEP_NOT_ACTIVE' using errcode = 'P0001'; end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  if not coalesce(internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ), false) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id
  for update;
  has_response := response_row.id is not null;
  if has_response then
    if exists (
      select 1 from public.process_form_response_revisions revision
      where revision.tenant_id = item_row.tenant_id
        and revision.hr_group_id = item_row.hr_group_id
        and revision.response_id = response_row.id
        and revision.idempotency_key = pg_catalog.btrim(requested_idempotency_key)
        and revision.changed_by_user_id = actor_user_id
    ) then
      return internal_security.get_process_form_projection(item_row.id, requested_language);
    end if;
    if response_row.revision <> requested_expected_revision or response_row.expected_version <> requested_expected_version then
      raise exception 'STALE_FORM_RESPONSE' using errcode = 'P0001';
    end if;
  elsif requested_expected_revision <> 0 or requested_expected_version <> 0 then
    raise exception 'STALE_FORM_RESPONSE' using errcode = 'P0001';
  end if;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
  if not internal_security.process_form_language_allowed(form_definition, requested_language) then
    raise exception 'FORM_LANGUAGE_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  existing_current := coalesce(response_row.current_values, '{}'::jsonb);
  existing_new := coalesce(response_row.new_values, '{}'::jsonb);
  merged_condition_values := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || existing_new || incoming_new;

  for field_key in select key from pg_catalog.jsonb_object_keys(incoming_current) key loop
    select field_item into field from internal_security.process_form_fields(form_definition) field_item where field_item ->> 'key' = field_key;
    if field is null then raise exception 'UNKNOWN_FORM_FIELD' using errcode = 'P0001'; end if;
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001'; end if;
    if (existing_current -> field_key) is distinct from (incoming_current -> field_key) then raise exception 'CURRENT_VALUE_CHANGED' using errcode = 'P0001'; end if;
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and not internal_security.process_form_value_is_empty(incoming_current -> field_key)
      and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, incoming_current -> field_key) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;

  for field_key in select key from pg_catalog.jsonb_object_keys(incoming_new) key loop
    select field_item into field from internal_security.process_form_fields(form_definition) field_item where field_item ->> 'key' = field_key;
    if field is null then raise exception 'UNKNOWN_FORM_FIELD' using errcode = 'P0001'; end if;
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001'; end if;
    if mode_name not in ('WRITE_OPTIONAL', 'WRITE_REQUIRED') then raise exception 'FIELD_NOT_WRITABLE' using errcode = 'P0001'; end if;
    if not internal_security.process_condition_matches(field -> 'visibilityCondition', merged_condition_values, subject) then
      raise exception 'HIDDEN_FIELD_SUBMITTED' using errcode = 'P0001';
    end if;
    value := incoming_new -> field_key;
    if not internal_security.process_form_value_is_valid(field, value) then raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001'; end if;
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;

  merged_new := existing_new || incoming_new;
  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then continue; end if;
    if not internal_security.process_condition_matches(field -> 'visibilityCondition', coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject) then continue; end if;
    required := internal_security.process_form_field_required(field, item_row.participant_key, coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject);
    value := merged_new -> (field ->> 'key');
    if required and internal_security.process_form_value_is_empty(value) then raise exception 'REQUIRED_FORM_FIELD' using errcode = 'P0001'; end if;
    if mode_name in ('WRITE_OPTIONAL', 'WRITE_REQUIRED')
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_form_value_is_valid(field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
    if field ->> 'type' = 'DOCUMENT_REFERENCE'
      and not internal_security.process_form_value_is_empty(value)
      and not internal_security.process_document_reference_allowed(item_row.tenant_id, item_row.hr_group_id, field, value) then
      raise exception 'INVALID_FORM_VALUE' using errcode = 'P0001';
    end if;
  end loop;

  save_correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id, extensions.gen_random_uuid());
  next_revision := case when has_response then response_row.revision + 1 else 1 end;
  next_expected_version := case when has_response then response_row.expected_version + 1 else 1 end;
  if has_response then
    update public.process_form_responses
    set new_values = merged_new,
        revision = next_revision,
        expected_version = next_expected_version,
        status = 'IN_PROGRESS',
        last_saved_by_user_id = actor_user_id,
        correlation_id = save_correlation_id
    where id = response_row.id;
    response_id := response_row.id;
  else
    insert into public.process_form_responses (
      tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id,
      process_version_id, form_version_id, form_key, participant_key, revision,
      expected_version, current_values, new_values, last_saved_by_user_id, correlation_id
    ) values (
      item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.step_instance_id, item_row.id,
      instance_row.process_version_id, nullif(form_info ->> 'formVersionId', '')::uuid, form_info ->> 'formKey', item_row.participant_key,
      next_revision, next_expected_version, coalesce(incoming_current, '{}'::jsonb), merged_new, actor_user_id, save_correlation_id
    ) returning id into response_id;
  end if;
  insert into public.process_form_response_revisions (
    tenant_id, hr_group_id, response_id, revision, expected_version,
    current_values, new_values, changed_by_user_id, idempotency_key, correlation_id
  ) values (
    item_row.tenant_id, item_row.hr_group_id, response_id, next_revision, next_expected_version,
    case when has_response then existing_current else coalesce(incoming_current, '{}'::jsonb) end,
    merged_new, actor_user_id, pg_catalog.btrim(requested_idempotency_key), save_correlation_id
  );
  return internal_security.get_process_form_projection(item_row.id, requested_language);
end;
$$;

revoke all on function internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text) from public, anon, authenticated;

create or replace function public.save_process_form_response(
  requested_work_item_id uuid,
  requested_expected_revision bigint,
  requested_expected_version bigint,
  requested_values jsonb,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.save_process_form_response(
    requested_work_item_id, requested_expected_revision, requested_expected_version,
    requested_values, requested_idempotency_key, requested_correlation_id, requested_language
  );
$$;

revoke all on function public.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text) from public, anon;
grant execute on function public.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text) to authenticated;

create or replace function internal_security.perform_process_work_item_action(
  requested_work_item_id uuid,
  requested_action text,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  step_row public.process_step_instances%rowtype;
  version_row public.process_versions%rowtype;
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  existing_event_id uuid;
  existing_actor_user_id uuid;
  existing_event_work_item_id uuid;
  existing_event_action text;
  event_id uuid;
  transition jsonb;
  definition_content jsonb;
  step_definition jsonb;
  subject jsonb;
  fields jsonb;
  has_scope_permission boolean;
  candidate_ok boolean;
  remaining_all integer;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  select event.id, event.actor_user_id, event.work_item_id, event.payload ->> 'action'
    into existing_event_id, existing_actor_user_id, existing_event_work_item_id, existing_event_action
  from public.process_events event
  where event.tenant_id = instance_row.tenant_id
    and event.hr_group_id = instance_row.hr_group_id
    and event.process_instance_id = instance_row.id
    and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
  if existing_event_id is not null then
    if existing_actor_user_id is distinct from actor_user_id
      or existing_event_work_item_id is distinct from requested_work_item_id
      or existing_event_action is distinct from requested_action then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return internal_security.process_runtime_result(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, existing_event_id);
  end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id
  for update;
  if item_row.id is null or step_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if instance_row.status not in ('RUNNING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status) then
    raise exception 'PROCESS_INSTANCE_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if step_row.status <> 'ACTIVE'::public.process_step_instance_status then raise exception 'STEP_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;
  if requested_step_expected_version is not null and step_row.expected_version <> requested_step_expected_version then
    raise exception 'STALE_STATE' using errcode = 'P0001';
  end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  has_scope_permission := internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-task:act'
  );
  select exists (
    select 1 from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = actor_employee_id
      and candidate.candidate_user_id = actor_user_id
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item_row.tenant_id
          and latest.hr_group_id = item_row.hr_group_id
          and latest.work_item_id = item_row.id
      )
  ) into candidate_ok;
  if not has_scope_permission and not candidate_ok then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status = 'CLAIMED' and item_row.claimed_by_user_id <> actor_user_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = instance_row.tenant_id
    and version.hr_group_id = instance_row.hr_group_id
    and version.id = instance_row.process_version_id;
  if version_row.id is null then raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  definition_content := internal_security.process_definition_content(version_row.definition_json);
  select value into step_definition
  from pg_catalog.jsonb_array_elements(coalesce(definition_content -> 'steps', '[]'::jsonb)) value
  where value ->> 'key' = item_row.step_key;
  if step_definition is null then raise exception 'STEP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not (exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(step_definition -> 'allowedActions', '[]'::jsonb)) action
    where action #>> '{}' = requested_action
  )) then raise exception 'FORBIDDEN_ACTION' using errcode = '42501'; end if;

  subject := internal_security.process_subject_context(instance_row.tenant_id, instance_row.hr_group_id, instance_row.id);
  fields := coalesce(instance_row.metadata -> 'fields', '{}'::jsonb);
  if step_definition ->> 'type' = 'FORM' then
    fields := fields || coalesce(internal_security.process_form_runtime_fields(item_row.id), '{}'::jsonb);
    perform internal_security.prepare_process_form_action(item_row.id, requested_action);
  end if;
  transition := internal_security.select_process_transition(definition_content, item_row.step_key, requested_action, fields, subject);

  update public.process_work_items
  set status = 'COMPLETED'::public.process_work_item_status,
      expected_version = expected_version + 1
  where id = item_row.id;

  if item_row.assignment_mode = 'ALL'::public.process_assignment_mode then
    select count(*) into remaining_all
    from public.process_work_items sibling
    where sibling.tenant_id = item_row.tenant_id
      and sibling.hr_group_id = item_row.hr_group_id
      and sibling.step_instance_id = item_row.step_instance_id
      and sibling.status <> 'COMPLETED'::public.process_work_item_status
      and sibling.status <> 'CANCELLED'::public.process_work_item_status;
    if remaining_all > 0 then
      update public.process_step_instances
      set expected_version = expected_version + 1
      where id = step_row.id;
      update public.process_instances
      set instance_version = instance_version + 1
      where id = instance_row.id;
      event_id := internal_security.append_process_runtime_event(
        item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
        'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'remainingParallelItems', remaining_all),
        actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
      );
      return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
    end if;
  end if;

  update public.process_step_instances
  set status = case requested_action
    when 'REJECT' then 'REJECTED'::public.process_step_instance_status
    when 'CANCEL' then 'CANCELLED'::public.process_step_instance_status
    else 'COMPLETED'::public.process_step_instance_status
  end,
      completed_at = timezone('utc', now()), expected_version = expected_version + 1
  where id = step_row.id;
  update public.process_instances
  set instance_version = instance_version + 1,
      current_step_key = null
  where id = instance_row.id;
  perform internal_security.activate_process_step(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id,
    instance_row.scope_type, instance_row.administration_id, instance_row.process_version_id,
    definition_content, transition ->> 'toStepKey', coalesce(requested_correlation_id, instance_row.correlation_id),
    actor_user_id, actor_employee_id
  );
  event_id := internal_security.append_process_runtime_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'PROCESS_WORK_ITEM_ACTIONED', jsonb_build_object('action', requested_action, 'stepKey', item_row.step_key, 'transitionKey', transition ->> 'key'),
    actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), coalesce(requested_correlation_id, instance_row.correlation_id)
  );
  return internal_security.process_runtime_result(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, event_id);
end;
$$;

revoke all on function internal_security.perform_process_work_item_action(uuid, text, bigint, bigint, text, uuid) from public, anon, authenticated;

create or replace function internal_security.start_process(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_employment_id uuid,
  requested_business_effective_date date,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_row public.process_definitions%rowtype;
  version_row public.process_versions%rowtype;
  existing_instance public.process_instances%rowtype;
  instance_id uuid;
  actor_employee_id uuid;
  actor_user_id uuid := auth.uid();
  resolved_employment_id uuid := requested_employment_id;
  correlation_id uuid := coalesce(requested_correlation_id, extensions.gen_random_uuid());
  event_id uuid;
  definition_content jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.id = requested_process_definition_id
    and definition.status = 'PUBLISHED'::public.process_definition_status
  for update;
  if definition_row.id is null then raise exception 'PROCESS_DEFINITION_NOT_PUBLISHED' using errcode = 'P0001'; end if;

  actor_employee_id := internal_security.current_employee_id(definition_row.tenant_id, definition_row.hr_group_id);
  if not internal_security.process_scope_has_permission(
    definition_row.tenant_id, definition_row.hr_group_id, definition_row.scope_type, definition_row.administration_id, 'process-instance:start'
  ) and not (
    actor_employee_id = requested_subject_employee_id
    and internal_security.process_scope_has_permission(
      definition_row.tenant_id, definition_row.hr_group_id, definition_row.scope_type, definition_row.administration_id, 'self:process-instance:start'
    )
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  if not (exists (
    select 1 from public.employees employee
    where employee.tenant_id = definition_row.tenant_id
      and employee.hr_group_id = definition_row.hr_group_id
      and employee.id = requested_subject_employee_id
      and employee.deleted_at is null and employee.is_active
  )) then raise exception 'SUBJECT_EMPLOYEE_NOT_FOUND' using errcode = 'P0002'; end if;

  if definition_row.administration_id is not null then
    if resolved_employment_id is null then
      select employment.id into resolved_employment_id
      from public.employments employment
      where employment.tenant_id = definition_row.tenant_id
        and employment.hr_group_id = definition_row.hr_group_id
        and employment.administration_id = definition_row.administration_id
        and employment.employee_id = requested_subject_employee_id
        and employment.deleted_at is null
        and employment.starts_on <= coalesce(requested_business_effective_date, current_date)
        and (employment.ends_on is null or employment.ends_on >= coalesce(requested_business_effective_date, current_date))
      order by employment.is_primary desc, employment.starts_on desc, employment.id
      limit 1;
    end if;
    if resolved_employment_id is null or not exists (
      select 1 from public.employments employment
      where employment.tenant_id = definition_row.tenant_id
        and employment.hr_group_id = definition_row.hr_group_id
        and employment.administration_id = definition_row.administration_id
        and employment.id = resolved_employment_id
        and employment.employee_id = requested_subject_employee_id
        and employment.deleted_at is null
    ) then raise exception 'SUBJECT_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;

  select instance.* into existing_instance
  from public.process_instances instance
  where instance.tenant_id = definition_row.tenant_id
    and instance.hr_group_id = definition_row.hr_group_id
    and instance.idempotency_key = pg_catalog.btrim(requested_idempotency_key)
  for update;
  if existing_instance.id is not null then
    if existing_instance.initiator_user_id <> actor_user_id then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001'; end if;
    if existing_instance.process_definition_id <> requested_process_definition_id
      or existing_instance.business_effective_date is distinct from requested_business_effective_date
      or not exists (
        select 1 from public.process_employee_subjects subject
        where subject.tenant_id = existing_instance.tenant_id
          and subject.hr_group_id = existing_instance.hr_group_id
          and subject.process_instance_id = existing_instance.id
          and subject.employee_id = requested_subject_employee_id
      )
      or (definition_row.administration_id is not null and not exists (
        select 1 from public.process_employment_subjects subject
        where subject.tenant_id = existing_instance.tenant_id
          and subject.hr_group_id = existing_instance.hr_group_id
          and subject.process_instance_id = existing_instance.id
          and subject.employment_id = resolved_employment_id
      )) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    select event.id into event_id
    from public.process_events event
    where event.tenant_id = existing_instance.tenant_id
      and event.hr_group_id = existing_instance.hr_group_id
      and event.process_instance_id = existing_instance.id
      and event.idempotency_key = pg_catalog.btrim(requested_idempotency_key);
    return internal_security.process_runtime_result(existing_instance.tenant_id, existing_instance.hr_group_id, existing_instance.id, event_id);
  end if;

  select version.* into version_row
  from public.process_versions version
  where version.tenant_id = definition_row.tenant_id
    and version.hr_group_id = definition_row.hr_group_id
    and version.process_definition_id = definition_row.id
  order by version.version_number desc
  limit 1;
  if version_row.id is null then raise exception 'PROCESS_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  definition_content := internal_security.process_definition_content(version_row.definition_json);

  insert into public.process_instances (
    tenant_id, hr_group_id, scope_type, administration_id, process_definition_id,
    process_version_id, status, initiator_user_id, initiator_employee_id,
    business_effective_date, current_step_key, instance_version, started_at,
    metadata, idempotency_key, correlation_id
  ) values (
    definition_row.tenant_id, definition_row.hr_group_id, definition_row.scope_type, definition_row.administration_id,
    definition_row.id, version_row.id, 'RUNNING'::public.process_instance_status, actor_user_id, actor_employee_id,
    requested_business_effective_date, definition_content ->> 'startStepKey', 1, timezone('utc', now()),
    jsonb_build_object('fields', '{}'::jsonb), pg_catalog.btrim(requested_idempotency_key), correlation_id
  ) returning id into instance_id;

  insert into public.process_employee_subjects (process_instance_id, tenant_id, hr_group_id, employee_id)
  values (instance_id, definition_row.tenant_id, definition_row.hr_group_id, requested_subject_employee_id);
  if resolved_employment_id is not null then
    insert into public.process_employment_subjects (
      process_instance_id, tenant_id, hr_group_id, administration_id, employment_id
    ) values (
      instance_id, definition_row.tenant_id, definition_row.hr_group_id, definition_row.administration_id, resolved_employment_id
    );
  end if;

  event_id := internal_security.append_process_runtime_event(
    definition_row.tenant_id, definition_row.hr_group_id, instance_id, null,
    'PROCESS_STARTED', jsonb_build_object('processDefinitionId', definition_row.id, 'processVersionId', version_row.id),
    actor_user_id, actor_employee_id, pg_catalog.btrim(requested_idempotency_key), correlation_id
  );
  perform internal_security.activate_process_step(
    definition_row.tenant_id, definition_row.hr_group_id, instance_id, definition_row.scope_type,
    definition_row.administration_id, version_row.id, definition_content, definition_content ->> 'startStepKey',
    correlation_id, actor_user_id, actor_employee_id
  );
  return internal_security.process_runtime_result(definition_row.tenant_id, definition_row.hr_group_id, instance_id, event_id);
end;
$$;

revoke all on function internal_security.start_process(uuid, uuid, uuid, date, text, uuid) from public, anon, authenticated;

commit;
