begin;
create or replace function internal_security.acknowledge_document_process_work_item_internal(
  requested_work_item_id uuid,
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
  actor_user_id uuid := auth.uid();
  actor_employee_id uuid;
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  response_row public.process_form_responses%rowtype;
  document_row public.employee_documents%rowtype;
  domain_commit_row public.process_domain_commits%rowtype;
  document_value jsonb;
  document_id_text text;
  resolved_document_id uuid;
  subject_employee_id uuid;
  acknowledgement_id uuid;
  inserted_acknowledgement boolean := false;
  base_result jsonb;
  action_result jsonb;
  final_result jsonb;
begin
  if actor_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or pg_catalog.btrim(requested_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.step_key <> 'acknowledge' then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_STEP_INVALID' using errcode = 'P0001'; end if;
  if not exists (
    select 1
    from public.process_recipe_activations activation
    join public.process_recipe_catalog recipe on recipe.id = activation.process_recipe_id
    where activation.tenant_id = instance_row.tenant_id
      and activation.hr_group_id = instance_row.hr_group_id
      and activation.process_definition_id = instance_row.process_definition_id
      and recipe.recipe_key = 'document-acknowledgement'
  ) then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_RECIPE_INVALID' using errcode = 'P0001'; end if;

  select domain_commit.* into domain_commit_row
  from public.process_domain_commits domain_commit
  where domain_commit.tenant_id = instance_row.tenant_id
    and domain_commit.hr_group_id = instance_row.hr_group_id
    and domain_commit.process_instance_id = instance_row.id
    and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT';
  if domain_commit_row.id is not null then return domain_commit_row.result; end if;

  actor_employee_id := internal_security.current_employee_id(instance_row.tenant_id, instance_row.hr_group_id);
  if actor_employee_id is null or not internal_security.process_form_actor_allowed(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, actor_user_id, actor_employee_id
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if item_row.status not in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status) then
    raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001';
  end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;

  select response.* into response_row
  from public.process_form_responses response
  where response.tenant_id = item_row.tenant_id
    and response.hr_group_id = item_row.hr_group_id
    and response.work_item_id = item_row.id
  for update;
  if response_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_FORM_MISSING' using errcode = 'P0001'; end if;
  if requested_step_expected_version is not null and requested_step_expected_version <> (
    select step.expected_version
    from public.process_step_instances step
    where step.tenant_id = item_row.tenant_id
      and step.hr_group_id = item_row.hr_group_id
      and step.id = item_row.step_instance_id
  ) then raise exception 'STALE_STATE' using errcode = 'P0001'; end if;
  if coalesce(response_row.new_values -> 'acknowledged', 'false'::jsonb) <> 'true'::jsonb then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  document_value := coalesce(response_row.current_values -> 'document', response_row.new_values -> 'document');
  document_id_text := coalesce(document_value ->> 'id', document_value #>> '{}');
  if document_id_text is null or document_id_text !~* '^[0-9a-f-]{36}$' then
    raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_REQUIRED' using errcode = 'P0001';
  end if;
  resolved_document_id := document_id_text::uuid;
  select subject.employee_id into subject_employee_id
  from public.process_employee_subjects subject
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id;
  select document.* into document_row
  from public.employee_documents document
  where document.tenant_id = instance_row.tenant_id
    and document.administration_id = instance_row.administration_id
    and document.id = resolved_document_id
    and document.employee_id = subject_employee_id
    and document.deleted_at is null
    and exists (
      select 1 from public.document_audiences audience
      where audience.tenant_id = document.tenant_id
        and audience.administration_id = document.administration_id
        and audience.document_id = document.id
        and audience.target_type = 'EMPLOYEE'::public.document_target_type
        and audience.target_employee_id = subject_employee_id
    );
  if document_row.id is null then raise exception 'DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.employee_document_acknowledgements (
    tenant_id, hr_group_id, administration_id, employee_id, document_id,
    process_instance_id, work_item_id, acknowledged_by_user_id,
    document_checksum_sha256
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.administration_id, subject_employee_id, document_row.id,
    instance_row.id, item_row.id, actor_user_id, document_row.checksum_sha256
  ) on conflict (tenant_id, hr_group_id, employee_id, document_id) do nothing
  returning id into acknowledgement_id;
  inserted_acknowledgement := acknowledgement_id is not null;
  if acknowledgement_id is null then
    select acknowledgement.id into acknowledgement_id
    from public.employee_document_acknowledgements acknowledgement
    where acknowledgement.tenant_id = instance_row.tenant_id
      and acknowledgement.hr_group_id = instance_row.hr_group_id
      and acknowledgement.employee_id = subject_employee_id
      and acknowledgement.document_id = document_row.id;
  end if;

  update public.process_form_responses
  set status = 'SUBMITTED'
  where id = response_row.id;

  base_result := jsonb_build_object(
    'adapterKey', 'DOCUMENT_ACKNOWLEDGEMENT',
    'acknowledgementId', acknowledgement_id,
    'documentId', document_row.id,
    'documentTitle', document_row.title,
    'documentChecksumSha256', document_row.checksum_sha256,
    'alreadyAcknowledged', not inserted_acknowledgement,
    'writesPerformed', inserted_acknowledgement
  );
  insert into public.process_domain_commits (
    tenant_id, hr_group_id, process_instance_id, work_item_id, adapter_key,
    correlation_id, idempotency_key, result, created_by_user_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, 'DOCUMENT_ACKNOWLEDGEMENT',
    coalesce(requested_correlation_id, instance_row.correlation_id), pg_catalog.btrim(requested_idempotency_key), base_result, actor_user_id
  ) on conflict (process_instance_id, adapter_key) do nothing
  returning * into domain_commit_row;
  if domain_commit_row.id is null then
    select domain_commit.* into domain_commit_row
    from public.process_domain_commits domain_commit
    where domain_commit.tenant_id = instance_row.tenant_id
      and domain_commit.hr_group_id = instance_row.hr_group_id
      and domain_commit.process_instance_id = instance_row.id
      and domain_commit.adapter_key = 'DOCUMENT_ACKNOWLEDGEMENT';
    return domain_commit_row.result;
  end if;

  action_result := internal_security.perform_process_work_item_action(
    item_row.id,
    'ACKNOWLEDGE',
    requested_expected_version,
    requested_step_expected_version,
    requested_idempotency_key,
    requested_correlation_id
  );
  final_result := action_result || base_result;
  update public.process_domain_commits
  set result = final_result
  where id = domain_commit_row.id;
  return final_result;
end;
$$;
commit;