begin;
create or replace function internal_security.commit_internal_transfer(
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
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  preview jsonb;
  existing_commit public.process_domain_commits%rowtype;
  placement_id uuid;
  action_result jsonb;
  result_json jsonb;
  actor_id uuid := auth.uid();
  correlation_id uuid;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = item_row.process_instance_id for update;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'organization-placement:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select commit_row.* into existing_commit
  from public.process_domain_commits commit_row
  where commit_row.process_instance_id = instance_row.id and commit_row.adapter_key = 'INTERNAL_TRANSFER_ORGANIZATION'
  for update;
  if existing_commit.id is not null then return existing_commit.result; end if;
  if item_row.step_key <> 'hr-validation' then raise exception 'INTERNAL_TRANSFER_HR_STEP_REQUIRED' using errcode = '42501'; end if;
  preview := internal_security.internal_transfer_projection(requested_work_item_id);
  if preview ->> 'status' = 'BLOCKING' then raise exception 'INTERNAL_TRANSFER_VALIDATION_BLOCKED' using errcode = '22023'; end if;

  placement_id := public.manage_employment_organization_timeline(
    (preview -> 'employee' ->> 'employmentId')::uuid,
    null,
    (preview ->> 'effectiveOn')::date,
    (preview -> 'proposed' ->> 'departmentId')::uuid,
    (preview -> 'proposed' ->> 'jobId')::uuid
  );
  update public.employee_organizations
  set direct_manager_id = (preview -> 'proposed' ->> 'managerId')::uuid
  where id = placement_id
    and employment_id = (preview -> 'employee' ->> 'employmentId')::uuid;
  if not found then raise exception 'PLACEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id);
  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action,
    changes, subject_employee_id, employment_id, correlation_id
  ) values (
    instance_row.tenant_id, instance_row.administration_id, 'employee_organization', placement_id, actor_id, 'CREATE',
    jsonb_build_object('adapterKey','INTERNAL_TRANSFER_ORGANIZATION','current',preview -> 'current','proposed',preview -> 'proposed','effectiveOn',preview ->> 'effectiveOn'),
    (preview -> 'employee' ->> 'id')::uuid,
    (preview -> 'employee' ->> 'employmentId')::uuid,
    correlation_id
  );

  action_result := internal_security.perform_process_work_item_action(
    requested_work_item_id, 'APPROVE', requested_expected_version,
    requested_step_expected_version, btrim(requested_idempotency_key), correlation_id
  );
  result_json := action_result || jsonb_build_object(
    'adapterKey','INTERNAL_TRANSFER_ORGANIZATION',
    'organizationPlacementId',placement_id,
    'preview',preview,
    'writesPerformed',true,
    'correlationId',correlation_id
  );
  insert into public.process_domain_commits (
    tenant_id, hr_group_id, process_instance_id, work_item_id, adapter_key,
    organization_placement_id, correlation_id, idempotency_key, result, created_by_user_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, 'INTERNAL_TRANSFER_ORGANIZATION',
    placement_id, correlation_id, btrim(requested_idempotency_key), result_json, actor_id
  );
  return result_json;
end;
$$;

create or replace function public.commit_internal_transfer(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.commit_internal_transfer(
    requested_work_item_id, requested_expected_version, requested_step_expected_version,
    requested_idempotency_key, requested_correlation_id
  );
$$;

create or replace function internal_security.request_process_work_item_changes(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  note_row public.process_work_item_notes%rowtype;
  action_result jsonb;
  actor_id uuid := auth.uid();
  correlation_id uuid;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if length(btrim(coalesce(requested_body,''))) < 1 then raise exception 'REQUEST_CHANGES_REASON_REQUIRED' using errcode = '22023'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = item_row.process_instance_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id);
  action_result := internal_security.perform_process_work_item_action(
    requested_work_item_id, 'REQUEST_CHANGES', requested_expected_version,
    requested_step_expected_version, btrim(requested_idempotency_key), correlation_id
  );
  insert into public.process_work_item_notes (
    tenant_id, hr_group_id, process_instance_id, work_item_id, action, body, actor_user_id, correlation_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id,
    'REQUEST_CHANGES', btrim(requested_body), actor_id, correlation_id
  ) returning * into note_row;
  insert into public.audit_logs (
    tenant_id, entity_id, entity_name, actor_user_id, action, changes, correlation_id
  ) values (
    instance_row.tenant_id, note_row.id, 'process_work_item_note', actor_id, 'CREATE',
    jsonb_build_object('workItemId', item_row.id, 'action', 'REQUEST_CHANGES'), correlation_id
  );
  return action_result || jsonb_build_object('noteId', note_row.id, 'correlationId', correlation_id);
end;
$$;

create or replace function public.request_process_work_item_changes(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_body text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.request_process_work_item_changes(
    requested_work_item_id, requested_expected_version, requested_step_expected_version,
    requested_idempotency_key, requested_correlation_id, requested_body
  );
$$;

revoke all on function internal_security.get_process_recipe_catalog_internal() from public, anon, authenticated;
revoke all on function internal_security.activate_process_recipe_internal(uuid, uuid, uuid, public.access_scope_type, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.get_process_recipe_start_context_internal(uuid, uuid, text) from public, anon, authenticated;
commit;