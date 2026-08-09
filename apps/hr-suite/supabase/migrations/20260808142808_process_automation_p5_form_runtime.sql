begin;

create table public.process_form_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_instance_id uuid not null,
  step_instance_id uuid not null,
  work_item_id uuid not null,
  process_version_id uuid not null,
  form_version_id uuid,
  form_key text not null,
  participant_key text not null,
  status text not null default 'IN_PROGRESS',
  revision bigint not null default 0,
  expected_version bigint not null default 0,
  current_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  last_saved_by_user_id uuid references auth.users(id) on delete set null,
  correlation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_form_responses_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_form_responses_step_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id, step_instance_id)
    references public.process_step_instances(tenant_id, hr_group_id, process_instance_id, id)
    on delete cascade,
  constraint process_form_responses_work_item_fkey
    foreign key (tenant_id, hr_group_id, work_item_id)
    references public.process_work_items(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_form_responses_version_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id, process_version_id)
    references public.process_instances(tenant_id, hr_group_id, id, process_version_id)
    on delete restrict,
  constraint process_form_responses_status_check
    check (status in ('IN_PROGRESS', 'SUBMITTED', 'STALE')),
  constraint process_form_responses_revision_check check (revision >= 0),
  constraint process_form_responses_expected_version_check check (expected_version >= 0),
  constraint process_form_responses_values_object_check check (
    jsonb_typeof(current_values) = 'object' and jsonb_typeof(new_values) = 'object'
  ),
  constraint process_form_responses_key_check check (form_key <> '' and participant_key <> ''),
  constraint process_form_responses_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id),
  constraint process_form_responses_work_item_key unique (tenant_id, hr_group_id, work_item_id)
);

create table public.process_form_response_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  response_id uuid not null,
  revision bigint not null,
  expected_version bigint not null,
  current_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null,
  correlation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_form_response_revisions_response_fkey
    foreign key (tenant_id, hr_group_id, response_id)
    references public.process_form_responses(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_form_response_revisions_revision_check check (revision > 0 and expected_version > 0),
  constraint process_form_response_revisions_values_object_check check (
    jsonb_typeof(current_values) = 'object' and jsonb_typeof(new_values) = 'object'
  ),
  constraint process_form_response_revisions_idempotency_check check (length(btrim(idempotency_key)) between 1 and 200),
  constraint process_form_response_revisions_revision_key unique (tenant_id, hr_group_id, response_id, revision),
  constraint process_form_response_revisions_idempotency_key unique (tenant_id, hr_group_id, response_id, idempotency_key)
);

create index process_form_responses_instance_lookup_idx
  on public.process_form_responses (tenant_id, hr_group_id, process_instance_id, updated_at desc);
create index process_form_responses_actor_lookup_idx
  on public.process_form_responses (tenant_id, hr_group_id, last_saved_by_user_id, updated_at desc);
create index process_form_response_revisions_response_lookup_idx
  on public.process_form_response_revisions (tenant_id, hr_group_id, response_id, revision desc);

alter table public.process_form_responses enable row level security;
alter table public.process_form_response_revisions enable row level security;

create policy process_form_responses_no_direct_read
on public.process_form_responses for select to authenticated
using (false);
create policy process_form_response_revisions_no_direct_read
on public.process_form_response_revisions for select to authenticated
using (false);

revoke all on table public.process_form_responses, public.process_form_response_revisions from public, anon, authenticated;

create trigger process_form_responses_updated_at
before update on public.process_form_responses
for each row execute function internal_security.set_updated_at();
create trigger process_form_response_revisions_append_only
before update or delete on public.process_form_response_revisions
for each row execute function internal_security.prevent_process_append_only_mutation();

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

  select form_version.id, internal_security.process_definition_content(form_version.definition_json)
    into form_version_id, published_form_definition
  from public.form_versions form_version
  join public.form_definitions definition
    on definition.tenant_id = form_version.tenant_id
   and definition.hr_group_id = form_version.hr_group_id
   and definition.id = form_version.form_definition_id
  where form_version.tenant_id = requested_tenant_id
    and form_version.hr_group_id = requested_hr_group_id
    and definition.key = form_key
    and definition.status = 'PUBLISHED'::public.process_definition_status
  order by form_version.version_number desc
  limit 1;

  if published_form_definition is not null then form_definition := published_form_definition; end if;
  if form_definition is null then raise exception 'FORM_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  return jsonb_build_object('formKey', form_key, 'formVersionId', form_version_id, 'definition', form_definition);
end;
$$;

revoke all on function internal_security.resolve_process_form_definition(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function internal_security.process_form_fields(requested_form_definition jsonb)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select field.value
  from pg_catalog.jsonb_array_elements(coalesce(requested_form_definition -> 'sections', '[]'::jsonb)) section
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(section.value -> 'fields', '[]'::jsonb)) field(value);
$$;

revoke all on function internal_security.process_form_fields(jsonb) from public, anon, authenticated;

create or replace function internal_security.process_form_access_rule(
  requested_field jsonb,
  requested_participant_key text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value
  from pg_catalog.jsonb_array_elements(coalesce(requested_field -> 'access', '[]'::jsonb)) value
  where value ->> 'participantKey' = requested_participant_key
  limit 1;
$$;

revoke all on function internal_security.process_form_access_rule(jsonb, text) from public, anon, authenticated;

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
    return scalar_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  end if;
  return false;
exception when others then
  return false;
end;
$$;

revoke all on function internal_security.process_form_value_is_valid(jsonb, jsonb) from public, anon, authenticated;

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
begin
  if mode_name = 'WRITE_REQUIRED' then return true; end if;
  if mode_name <> 'WRITE_OPTIONAL' then return false; end if;
  if requested_field -> 'requiredCondition' is null then return false; end if;
  return internal_security.process_condition_matches(requested_field -> 'requiredCondition', requested_values, requested_subject);
end;
$$;

revoke all on function internal_security.process_form_field_required(jsonb, text, jsonb, jsonb) from public, anon, authenticated;

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
  select internal_security.process_scope_has_permission(
    instance.tenant_id, instance.hr_group_id, instance.scope_type, instance.administration_id, 'process-task:act'
  )
  or exists (
    select 1
    from public.process_work_item_candidates candidate
    where candidate.tenant_id = item.tenant_id
      and candidate.hr_group_id = item.hr_group_id
      and candidate.work_item_id = item.id
      and candidate.employee_id = requested_actor_employee_id
      and candidate.candidate_user_id = requested_actor_user_id
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item.tenant_id and latest.hr_group_id = item.hr_group_id and latest.work_item_id = item.id
      )
  )
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_instance_id;
$$;

revoke all on function internal_security.process_form_actor_allowed(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

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
  language_code text := case when requested_language in ('nl', 'en') then requested_language else 'nl' end;
  fields_for_conditions jsonb;
  subject jsonb;
  is_visible boolean;
  is_required boolean;
  current_value jsonb;
  new_value jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id
  from public.employees employee
  where employee.auth_user_id = actor_user_id and employee.deleted_at is null
  order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.id = requested_work_item_id for share;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id
    and instance.id = item_row.process_instance_id for share;
  select step.* into step_row
  from public.process_step_instances step
  where step.tenant_id = item_row.tenant_id
    and step.hr_group_id = item_row.hr_group_id
    and step.process_instance_id = item_row.process_instance_id
    and step.id = item_row.step_instance_id for share;
  if not coalesce(internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ), false) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  form_info := internal_security.resolve_process_form_definition(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.process_version_id, item_row.step_key
  );
  form_definition := form_info -> 'definition';
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
      field_projection := jsonb_build_object(
        'key', field_key,
        'label', coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl'),
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
      visible_fields := visible_fields || jsonb_build_array(field_projection);
      summary := summary || jsonb_build_array(jsonb_build_object(
        'fieldKey', field_key,
        'label', coalesce(field -> 'label' ->> language_code, field -> 'label' ->> 'nl'),
        'currentValue', current_value,
        'newValue', new_value
      ));
    end loop;
    if pg_catalog.jsonb_array_length(visible_fields) > 0 then
      sections := sections || jsonb_build_array(jsonb_build_object(
        'key', section ->> 'key',
        'title', coalesce(section -> 'title' ->> language_code, section -> 'title' ->> 'nl'),
        'fields', visible_fields
      ));
    end if;
  end loop;

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
    'description', coalesce(form_definition -> 'description' -> language_code, form_definition -> 'description' -> 'nl'),
    'sections', sections,
    'summary', summary,
    'availableLanguages', coalesce(form_definition -> 'enabledLanguages', jsonb_build_array('nl', 'en'))
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
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(requested_values) <> 'object' then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(incoming_current) <> 'object' or pg_catalog.jsonb_typeof(incoming_new) <> 'object' then raise exception 'INVALID_FORM_PAYLOAD' using errcode = 'P0001'; end if;

  select employee.id into actor_employee_id
  from public.employees employee
  where employee.auth_user_id = actor_user_id and employee.deleted_at is null
  order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id and item.id = requested_work_item_id
  for update of instance;
  select item.* into item_row
  from public.process_work_items item where item.id = requested_work_item_id for update;
  if item_row.id is null or instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not coalesce(internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ), false) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id and response.hr_group_id = item_row.hr_group_id and response.work_item_id = item_row.id
  for update;
  has_response := response_row.id is not null;
  if has_response then
    if exists (
      select 1 from public.process_form_response_revisions revision
      where revision.tenant_id = item_row.tenant_id and revision.hr_group_id = item_row.hr_group_id
        and revision.response_id = response_row.id and revision.idempotency_key = pg_catalog.btrim(requested_idempotency_key)
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
  end loop;

  merged_new := existing_new || incoming_new;
  for field in select field_item from internal_security.process_form_fields(form_definition) field_item loop
    access_rule := internal_security.process_form_access_rule(field, item_row.participant_key);
    mode_name := access_rule ->> 'mode';
    if mode_name is null or mode_name = 'HIDDEN' then continue; end if;
    if not internal_security.process_condition_matches(field -> 'visibilityCondition', coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject) then continue; end if;
    required := internal_security.process_form_field_required(field, item_row.participant_key, coalesce(instance_row.metadata -> 'fields', '{}'::jsonb) || existing_current || merged_new, subject);
    if required and (
      (merged_new -> (field ->> 'key')) is null
      or merged_new -> (field ->> 'key') = 'null'::jsonb
      or (pg_catalog.jsonb_typeof(merged_new -> (field ->> 'key')) = 'string' and pg_catalog.btrim(merged_new ->> (field ->> 'key')) = '')
    ) then raise exception 'REQUIRED_FORM_FIELD' using errcode = 'P0001'; end if;
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

create or replace function internal_security.audit_process_form_runtime_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  administration_id_value uuid;
  action_value text;
  entity_id_value uuid;
  correlation_id_value uuid;
  changes_value jsonb;
  actor_user_id_value uuid;
begin
  if TG_TABLE_NAME = 'process_form_responses' then
    select instance.administration_id into administration_id_value
    from public.process_instances instance where instance.id = NEW.process_instance_id;
    action_value := case when TG_OP = 'INSERT' then 'PROCESS_FORM_RESPONSE_CREATED' else 'PROCESS_FORM_RESPONSE_SAVED' end;
    entity_id_value := NEW.id;
    correlation_id_value := NEW.correlation_id;
    actor_user_id_value := coalesce(auth.uid(), NEW.last_saved_by_user_id);
    changes_value := jsonb_build_object(
      'responseId', NEW.id,
      'workItemId', NEW.work_item_id,
      'revision', NEW.revision,
      'expectedVersion', NEW.expected_version,
      'status', NEW.status,
      'correlationId', NEW.correlation_id
    );
  else
    select instance.administration_id into administration_id_value
    from public.process_instances instance
    join public.process_form_responses response on response.process_instance_id = instance.id
    where response.id = NEW.response_id;
    action_value := 'PROCESS_FORM_RESPONSE_REVISION_CREATED';
    entity_id_value := NEW.id;
    correlation_id_value := NEW.correlation_id;
    actor_user_id_value := coalesce(auth.uid(), NEW.changed_by_user_id);
    changes_value := jsonb_build_object(
      'responseId', NEW.response_id,
      'revision', NEW.revision,
      'expectedVersion', NEW.expected_version,
      'correlationId', NEW.correlation_id
    );
  end if;
  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes, correlation_id
  ) values (
    NEW.tenant_id, administration_id_value,
    case when TG_TABLE_NAME = 'process_form_responses' then 'process_form_response' else 'process_form_response_revision' end,
    entity_id_value, actor_user_id_value, action_value, changes_value, correlation_id_value
  );
  return NEW;
end;
$$;

revoke all on function internal_security.audit_process_form_runtime_change() from public, anon, authenticated;

create trigger audit_process_form_responses_runtime
after insert or update on public.process_form_responses
for each row execute function internal_security.audit_process_form_runtime_change();
create trigger audit_process_form_response_revisions_runtime
after insert on public.process_form_response_revisions
for each row execute function internal_security.audit_process_form_runtime_change();

commit;
