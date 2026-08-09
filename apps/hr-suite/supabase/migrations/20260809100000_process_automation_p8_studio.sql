-- P8: configuratiestudio voor procesdefinities.
-- Mutaties lopen uitsluitend via geautoriseerde wrappers; gepubliceerde versies
-- blijven append-only en kunnen niet via deze RPC's worden aangepast.

create or replace function internal_security.process_definition_studio_has_permission(
  requested_definition_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.process_definitions definition
    where definition.id = requested_definition_id
      and internal_security.process_scope_has_permission(
        definition.tenant_id,
        definition.hr_group_id,
        definition.scope_type,
        definition.administration_id,
        requested_permission_code
      )
  );
$$;

revoke all on function internal_security.process_definition_studio_has_permission(uuid, text)
  from public, anon, authenticated;

create or replace function public.create_process_definition_draft(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text,
  requested_title jsonb,
  requested_description jsonb,
  requested_definition jsonb,
  requested_validation_report jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  definition_id uuid;
  definition_row public.process_definitions%rowtype;
begin
  if actor_id is null then
    raise exception 'PROCESS_DEFINITION_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  if not internal_security.process_scope_has_permission(
    requested_tenant_id,
    requested_hr_group_id,
    requested_scope_type,
    requested_administration_id,
    'process-definition:write'
  ) then
    raise exception 'PROCESS_DEFINITION_FORBIDDEN' using errcode = '42501';
  end if;

  if requested_key is null or requested_key !~ '^[a-z][a-z0-9_-]*$' then
    raise exception 'PROCESS_DEFINITION_INVALID_KEY' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(coalesce(requested_title, '{}'::jsonb)) <> 'object'
     or pg_catalog.jsonb_typeof(coalesce(requested_definition, '{}'::jsonb)) <> 'object' then
    raise exception 'PROCESS_DEFINITION_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  if requested_scope_type = 'TENANT'::public.access_scope_type and requested_administration_id is not null then
    raise exception 'PROCESS_DEFINITION_INVALID_SCOPE' using errcode = '22023';
  end if;
  if requested_scope_type = 'ADMINISTRATION'::public.access_scope_type and requested_administration_id is null then
    raise exception 'PROCESS_DEFINITION_INVALID_SCOPE' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.process_definitions definition
    where definition.tenant_id = requested_tenant_id
      and definition.hr_group_id = requested_hr_group_id
      and definition.key = requested_key
  ) then
    raise exception 'PROCESS_DEFINITION_KEY_CONFLICT' using errcode = '23505';
  end if;

  insert into public.process_definitions (
    tenant_id,
    hr_group_id,
    scope_type,
    administration_id,
    key,
    title,
    description,
    status,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_scope_type,
    requested_administration_id,
    requested_key,
    requested_title,
    requested_description,
    'DRAFT'::public.process_definition_status,
    actor_id,
    actor_id
  )
  returning * into definition_row;

  definition_id := definition_row.id;

  insert into public.process_definition_drafts (
    tenant_id,
    hr_group_id,
    process_definition_id,
    revision,
    definition_json,
    validation_report,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    definition_id,
    1,
    requested_definition,
    coalesce(requested_validation_report, '{}'::jsonb),
    actor_id,
    actor_id
  );

  return jsonb_build_object(
    'id', definition_row.id,
    'key', definition_row.key,
    'status', definition_row.status,
    'revision', 1,
    'tenantId', definition_row.tenant_id,
    'hrGroupId', definition_row.hr_group_id
  );
end;
$$;

create or replace function public.save_process_definition_draft(
  requested_definition_id uuid,
  requested_expected_revision integer,
  requested_definition jsonb,
  requested_validation_report jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  definition_row public.process_definitions%rowtype;
  current_revision integer;
  next_revision integer;
begin
  if actor_id is null then
    raise exception 'PROCESS_DEFINITION_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(requested_definition, '{}'::jsonb)) <> 'object' then
    raise exception 'PROCESS_DEFINITION_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.id = requested_definition_id
  for update;
  if not found then
    raise exception 'PROCESS_DEFINITION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.process_definition_studio_has_permission(requested_definition_id, 'process-definition:write') then
    raise exception 'PROCESS_DEFINITION_FORBIDDEN' using errcode = '42501';
  end if;
  if definition_row.status = 'RETIRED'::public.process_definition_status then
    raise exception 'PROCESS_DEFINITION_RETIRED' using errcode = '55000';
  end if;

  select coalesce(max(draft.revision), 0)
  into current_revision
  from public.process_definition_drafts draft
  where draft.tenant_id = definition_row.tenant_id
    and draft.hr_group_id = definition_row.hr_group_id
    and draft.process_definition_id = requested_definition_id;

  if current_revision <> requested_expected_revision then
    raise exception 'PROCESS_DEFINITION_DRAFT_CONFLICT' using errcode = '40001';
  end if;
  next_revision := current_revision + 1;

  insert into public.process_definition_drafts (
    tenant_id,
    hr_group_id,
    process_definition_id,
    revision,
    definition_json,
    validation_report,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    definition_row.tenant_id,
    definition_row.hr_group_id,
    requested_definition_id,
    next_revision,
    requested_definition,
    coalesce(requested_validation_report, '{}'::jsonb),
    actor_id,
    actor_id
  );

  update public.process_definitions
  set title = coalesce(requested_definition -> 'title', definition_row.title),
      description = requested_definition -> 'description',
      updated_by_user_id = actor_id
  where id = requested_definition_id;

  return jsonb_build_object(
    'id', requested_definition_id,
    'revision', next_revision,
    'status', definition_row.status,
    'updatedAt', timezone('utc', now())
  );
end;
$$;

create or replace function public.clone_process_definition_draft(
  requested_source_definition_id uuid,
  requested_key text,
  requested_title jsonb default null,
  requested_description jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  source_definition public.process_definitions%rowtype;
  source_json jsonb;
  source_title jsonb;
  source_description jsonb;
  new_definition public.process_definitions%rowtype;
begin
  if actor_id is null then
    raise exception 'PROCESS_DEFINITION_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select definition.* into source_definition
  from public.process_definitions definition
  where definition.id = requested_source_definition_id;
  if not found then
    raise exception 'PROCESS_DEFINITION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.process_definition_studio_has_permission(requested_source_definition_id, 'process-definition:read')
     or not internal_security.process_definition_studio_has_permission(requested_source_definition_id, 'process-definition:write') then
    raise exception 'PROCESS_DEFINITION_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_key is null or requested_key !~ '^[a-z][a-z0-9_-]*$' then
    raise exception 'PROCESS_DEFINITION_INVALID_KEY' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.process_definitions definition
    where definition.tenant_id = source_definition.tenant_id
      and definition.hr_group_id = source_definition.hr_group_id
      and definition.key = requested_key
  ) then
    raise exception 'PROCESS_DEFINITION_KEY_CONFLICT' using errcode = '23505';
  end if;

  select draft.definition_json
  into source_json
  from public.process_definition_drafts draft
  where draft.tenant_id = source_definition.tenant_id
    and draft.hr_group_id = source_definition.hr_group_id
    and draft.process_definition_id = source_definition.id
  order by draft.revision desc
  limit 1;

  if source_json is null then
    select internal_security.process_definition_content(version.definition_json)
    into source_json
    from public.process_versions version
    where version.tenant_id = source_definition.tenant_id
      and version.hr_group_id = source_definition.hr_group_id
      and version.process_definition_id = source_definition.id
    order by version.version_number desc
    limit 1;
  end if;
  if source_json is null then
    raise exception 'PROCESS_DEFINITION_SOURCE_EMPTY' using errcode = 'P0002';
  end if;

  source_json := jsonb_set(source_json, '{status}', '"DRAFT"'::jsonb, true);
  source_title := coalesce(requested_title, source_json -> 'title', source_definition.title);
  source_description := coalesce(requested_description, source_json -> 'description', source_definition.description);

  insert into public.process_definitions (
    tenant_id, hr_group_id, scope_type, administration_id, key, title,
    description, status, created_by_user_id, updated_by_user_id
  )
  values (
    source_definition.tenant_id,
    source_definition.hr_group_id,
    source_definition.scope_type,
    source_definition.administration_id,
    requested_key,
    source_title,
    source_description,
    'DRAFT'::public.process_definition_status,
    actor_id,
    actor_id
  )
  returning * into new_definition;

  insert into public.process_definition_drafts (
    tenant_id, hr_group_id, process_definition_id, revision, definition_json,
    validation_report, created_by_user_id, updated_by_user_id
  )
  values (
    new_definition.tenant_id,
    new_definition.hr_group_id,
    new_definition.id,
    1,
    source_json,
    '{}'::jsonb,
    actor_id,
    actor_id
  );

  return jsonb_build_object(
    'id', new_definition.id,
    'key', new_definition.key,
    'status', new_definition.status,
    'revision', 1
  );
end;
$$;

create or replace function public.publish_process_definition_draft(
  requested_definition_id uuid,
  requested_expected_revision integer,
  requested_compiled_definition jsonb,
  requested_definition_hash text,
  requested_schema_version integer,
  requested_compiler_version text,
  requested_changelog text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  definition_row public.process_definitions%rowtype;
  current_revision integer;
  next_version integer;
  version_row public.process_versions%rowtype;
begin
  if actor_id is null then
    raise exception 'PROCESS_DEFINITION_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if not internal_security.process_definition_studio_has_permission(requested_definition_id, 'process-definition:publish') then
    raise exception 'PROCESS_DEFINITION_FORBIDDEN' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(requested_compiled_definition, '{}'::jsonb)) <> 'object'
     or requested_definition_hash is null
     or requested_definition_hash !~ '^[0-9a-f]{64}$'
     or requested_schema_version < 1
     or requested_compiler_version is null
     or btrim(requested_changelog) = '' then
    raise exception 'PROCESS_DEFINITION_PUBLISH_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.id = requested_definition_id
  for update;
  if not found then
    raise exception 'PROCESS_DEFINITION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if definition_row.status = 'RETIRED'::public.process_definition_status then
    raise exception 'PROCESS_DEFINITION_RETIRED' using errcode = '55000';
  end if;

  select coalesce(max(draft.revision), 0)
  into current_revision
  from public.process_definition_drafts draft
  where draft.tenant_id = definition_row.tenant_id
    and draft.hr_group_id = definition_row.hr_group_id
    and draft.process_definition_id = requested_definition_id;
  if current_revision <> requested_expected_revision then
    raise exception 'PROCESS_DEFINITION_DRAFT_CONFLICT' using errcode = '40001';
  end if;
  if current_revision = 0 then
    raise exception 'PROCESS_DEFINITION_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into next_version
  from public.process_versions version
  where version.tenant_id = definition_row.tenant_id
    and version.hr_group_id = definition_row.hr_group_id
    and version.process_definition_id = requested_definition_id;

  insert into public.process_versions (
    tenant_id,
    hr_group_id,
    process_definition_id,
    version_number,
    schema_version,
    compiler_version,
    definition_json,
    definition_hash,
    published_by_user_id
  )
  values (
    definition_row.tenant_id,
    definition_row.hr_group_id,
    requested_definition_id,
    next_version,
    requested_schema_version,
    requested_compiler_version,
    jsonb_set(
      requested_compiled_definition,
      '{publishChangelog}',
      to_jsonb(requested_changelog),
      true
    ),
    requested_definition_hash,
    actor_id
  )
  returning * into version_row;

  update public.process_definitions
  set status = 'PUBLISHED'::public.process_definition_status,
      updated_by_user_id = actor_id
  where id = requested_definition_id;

  insert into public.audit_logs (
    tenant_id,
    entity_name,
    entity_id,
    actor_user_id,
    action,
    changes
  )
  values (
    definition_row.tenant_id,
    'process_definition',
    requested_definition_id,
    actor_id,
    'UPDATE',
    jsonb_build_object(
      'event', 'PUBLISHED',
      'versionNumber', next_version,
      'draftRevision', current_revision,
      'changelog', requested_changelog,
      'definitionHash', requested_definition_hash
    )
  );

  return jsonb_build_object(
    'id', requested_definition_id,
    'versionId', version_row.id,
    'versionNumber', version_row.version_number,
    'revision', current_revision,
    'status', 'PUBLISHED',
    'definitionHash', version_row.definition_hash
  );
end;
$$;

create or replace function public.retire_process_definition(
  requested_definition_id uuid,
  requested_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  definition_row public.process_definitions%rowtype;
  active_instance_count bigint;
begin
  if actor_id is null then
    raise exception 'PROCESS_DEFINITION_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if not internal_security.process_definition_studio_has_permission(requested_definition_id, 'process-definition:publish') then
    raise exception 'PROCESS_DEFINITION_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_reason is null or btrim(requested_reason) = '' then
    raise exception 'PROCESS_DEFINITION_RETIRE_REASON_REQUIRED' using errcode = '22023';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.id = requested_definition_id
  for update;
  if not found then
    raise exception 'PROCESS_DEFINITION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*)
  into active_instance_count
  from public.process_instances instance
  where instance.tenant_id = definition_row.tenant_id
    and instance.hr_group_id = definition_row.hr_group_id
    and instance.process_definition_id = requested_definition_id
    and instance.status in ('DRAFT', 'RUNNING', 'WAITING', 'BLOCKED');

  update public.process_definitions
  set status = 'RETIRED'::public.process_definition_status,
      updated_by_user_id = actor_id
  where id = requested_definition_id;

  insert into public.audit_logs (
    tenant_id,
    entity_name,
    entity_id,
    actor_user_id,
    action,
    changes
  )
  values (
    definition_row.tenant_id,
    'process_definition',
    requested_definition_id,
    actor_id,
    'UPDATE',
    jsonb_build_object(
      'event', 'RETIRED',
      'reason', requested_reason,
      'activeInstanceCount', active_instance_count
    )
  );

  return jsonb_build_object(
    'id', requested_definition_id,
    'status', 'RETIRED',
    'activeInstanceCount', active_instance_count
  );
end;
$$;

revoke all on function public.create_process_definition_draft(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
revoke all on function public.save_process_definition_draft(uuid, integer, jsonb, jsonb)
  from public, anon;
revoke all on function public.clone_process_definition_draft(uuid, text, jsonb, jsonb)
  from public, anon;
revoke all on function public.publish_process_definition_draft(uuid, integer, jsonb, text, integer, text, text)
  from public, anon;
revoke all on function public.retire_process_definition(uuid, text)
  from public, anon;

grant execute on function public.create_process_definition_draft(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.save_process_definition_draft(uuid, integer, jsonb, jsonb)
  to authenticated;
grant execute on function public.clone_process_definition_draft(uuid, text, jsonb, jsonb)
  to authenticated;
grant execute on function public.publish_process_definition_draft(uuid, integer, jsonb, text, integer, text, text)
  to authenticated;
grant execute on function public.retire_process_definition(uuid, text)
  to authenticated;

comment on function public.create_process_definition_draft(uuid, uuid, public.access_scope_type, uuid, text, jsonb, jsonb, jsonb, jsonb)
  is 'P8 authorized creation of a process definition and its first draft revision.';
comment on function public.save_process_definition_draft(uuid, integer, jsonb, jsonb)
  is 'P8 append-only draft autosave with optimistic revision conflict detection.';
comment on function public.publish_process_definition_draft(uuid, integer, jsonb, text, integer, text, text)
  is 'P8 publishes an immutable compiled process version after permission and revision checks.';
