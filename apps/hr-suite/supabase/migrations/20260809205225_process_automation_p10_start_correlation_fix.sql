create or replace function internal_security.start_document_acknowledgement_internal(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_document_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  definition_row public.process_definitions%rowtype;
  document_row public.employee_documents%rowtype;
  process_result jsonb;
  started_process_instance_id uuid;
  item_row public.process_work_items%rowtype;
  form_info jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select definition.* into definition_row
  from public.process_definitions definition
  join public.process_recipe_activations activation
    on activation.tenant_id = definition.tenant_id
   and activation.hr_group_id = definition.hr_group_id
   and activation.process_definition_id = definition.id
  join public.process_recipe_catalog recipe on recipe.id = activation.process_recipe_id
  where definition.id = requested_process_definition_id
    and definition.status = 'PUBLISHED'::public.process_definition_status
    and recipe.recipe_key = 'document-acknowledgement'
    and recipe.status = 'PUBLISHED';
  if definition_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_RECIPE_NOT_PUBLISHED' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(
    definition_row.tenant_id, definition_row.hr_group_id, 'process-instance:start'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select document.* into document_row
  from public.employee_documents document
  where document.tenant_id = definition_row.tenant_id
    and document.administration_id = definition_row.administration_id
    and document.id = requested_document_id
    and document.employee_id = requested_subject_employee_id
    and document.deleted_at is null
    and exists (
      select 1 from public.document_audiences audience
      where audience.tenant_id = document.tenant_id
        and audience.administration_id = document.administration_id
        and audience.document_id = document.id
        and audience.target_type = 'EMPLOYEE'::public.document_target_type
        and audience.target_employee_id = requested_subject_employee_id
    );
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  select internal_security.start_process(
    requested_process_definition_id,
    requested_subject_employee_id,
    null,
    current_date,
    requested_idempotency_key,
    requested_correlation_id
  ) into process_result;
  started_process_instance_id := (process_result ->> 'processInstanceId')::uuid;

  update public.process_instances instance
  set metadata = jsonb_set(
    coalesce(instance.metadata, '{}'::jsonb),
    '{fields}',
    coalesce(instance.metadata -> 'fields', '{}'::jsonb) || jsonb_build_object(
      'document', jsonb_build_object('id', document_row.id, 'label', document_row.title),
      'documentId', document_row.id
    ),
    true
  )
  where instance.tenant_id = definition_row.tenant_id
    and instance.hr_group_id = definition_row.hr_group_id
    and instance.id = started_process_instance_id;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = definition_row.tenant_id
    and item.hr_group_id = definition_row.hr_group_id
    and item.process_instance_id = started_process_instance_id
    and item.step_key = 'acknowledge'
  order by item.created_at desc
  limit 1;
  if item_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  form_info := internal_security.resolve_process_form_definition(
    definition_row.tenant_id, definition_row.hr_group_id, item_row.process_version_id, item_row.step_key
  );
  insert into public.process_form_responses (
    tenant_id, hr_group_id, process_instance_id, step_instance_id, work_item_id,
    process_version_id, form_version_id, form_key, participant_key, revision,
    expected_version, current_values, new_values, last_saved_by_user_id, correlation_id
  ) values (
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.step_instance_id, item_row.id,
    item_row.process_version_id, nullif(form_info ->> 'formVersionId', '')::uuid, form_info ->> 'formKey', item_row.participant_key,
    1, 1,
    jsonb_build_object('document', jsonb_build_object('id', document_row.id, 'label', document_row.title)),
    jsonb_build_object('acknowledged', false), actor_user_id,
    coalesce(requested_correlation_id, (process_result ->> 'correlationId')::uuid)
  )
  on conflict (tenant_id, hr_group_id, work_item_id) do nothing;

  return process_result || jsonb_build_object(
    'adapterKey', 'DOCUMENT_ACKNOWLEDGEMENT',
    'documentId', document_row.id,
    'documentTitle', document_row.title,
    'documentChecksumSha256', document_row.checksum_sha256,
    'workItemId', item_row.id
  );
end;
$$;

revoke all on function internal_security.start_document_acknowledgement_internal(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;

create or replace function public.start_document_acknowledgement(
  requested_process_definition_id uuid,
  requested_subject_employee_id uuid,
  requested_document_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.start_document_acknowledgement_internal(
    requested_process_definition_id,
    requested_subject_employee_id,
    requested_document_id,
    requested_idempotency_key,
    requested_correlation_id
  );
$$;

revoke all on function public.start_document_acknowledgement(uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.start_document_acknowledgement(uuid, uuid, uuid, text, uuid) to authenticated;