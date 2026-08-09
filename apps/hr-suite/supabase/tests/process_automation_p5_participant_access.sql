-- P5 participant/access gate: four participant projections and typed document reference.
-- Alle fixtures worden in dezelfde transactie aangemaakt en teruggedraaid.

begin;

set local role postgres;

do $fixture$
declare
  actor_user uuid := 'b86f6a66-276d-4f3d-a985-230f2cca9fdb';
  actor_tenant uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  actor_group uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  actor_employee uuid := '6f2e2302-748f-8684-0ce6-1b29702d5d92';
  form_definition_id uuid := extensions.gen_random_uuid();
  form_version_id uuid := extensions.gen_random_uuid();
  process_definition_id uuid := extensions.gen_random_uuid();
  process_version_id uuid := extensions.gen_random_uuid();
  process_instance_id uuid := extensions.gen_random_uuid();
  document_id uuid := extensions.gen_random_uuid();
  document_administration_id uuid;
  document_category_id uuid;
  form_definition jsonb;
  process_definition jsonb;
  step_id uuid;
  work_item_id uuid;
  participant_key text;
  step_key text;
begin
  select employment.administration_id into document_administration_id
  from public.employments employment
  where employment.tenant_id = actor_tenant
    and employment.employee_id = actor_employee
  order by employment.id
  limit 1;
  select category.id into document_category_id
  from public.document_categories category
  where category.tenant_id = actor_tenant
    and category.administration_id = document_administration_id
    and category.is_active
  order by category.id
  limit 1;
  if document_administration_id is null or document_category_id is null then
    raise exception 'P5_DOCUMENT_FIXTURE_SCOPE_NOT_FOUND';
  end if;
  insert into public.employee_documents (
    id, tenant_id, administration_id, employee_id, category_id, storage_key,
    original_filename, content_type, file_size, checksum_sha256, title, added_by_user_id
  ) values (
    document_id, actor_tenant, document_administration_id, actor_employee, document_category_id,
    'p5/process-automation/document.pdf', 'document.pdf', 'application/pdf', 1, repeat('a', 64),
    'P5 document reference fixture', actor_user
  );
  insert into public.document_audiences (
    tenant_id, administration_id, document_id, target_type, target_employee_id
  ) values (
    actor_tenant, document_administration_id, document_id, 'EMPLOYEE', actor_employee
  );

  form_definition := jsonb_build_object(
    'enabledLanguages', jsonb_build_array('nl', 'en'),
    'title', jsonb_build_object('nl', 'Vier deelnemers', 'en', 'Four participants'),
    'description', jsonb_build_object('nl', 'Toegangsproef', 'en', 'Access gate'),
    'sections', jsonb_build_array(jsonb_build_object(
      'key', 'access',
      'title', jsonb_build_object('nl', 'Toegang', 'en', 'Access'),
      'fields', jsonb_build_array(
        jsonb_build_object('key', 'commonRead', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'Gemeenschappelijk', 'en', 'Common'), 'access', jsonb_build_array(
          jsonb_build_object('participantKey', 'requester', 'mode', 'READ'),
          jsonb_build_object('participantKey', 'manager', 'mode', 'READ'),
          jsonb_build_object('participantKey', 'hr', 'mode', 'READ'),
          jsonb_build_object('participantKey', 'observer', 'mode', 'READ')
        )),
        jsonb_build_object('key', 'requesterOnly', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'Aanvrager', 'en', 'Requester'), 'access', jsonb_build_array(jsonb_build_object('participantKey', 'requester', 'mode', 'WRITE_REQUIRED'))),
        jsonb_build_object('key', 'managerOnly', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'Manager', 'en', 'Manager'), 'access', jsonb_build_array(jsonb_build_object('participantKey', 'manager', 'mode', 'READ'))),
        jsonb_build_object('key', 'hrOnly', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'HR', 'en', 'HR'), 'access', jsonb_build_array(jsonb_build_object('participantKey', 'hr', 'mode', 'WRITE_OPTIONAL'))),
        jsonb_build_object('key', 'observerOnly', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'Observator', 'en', 'Observer'), 'access', jsonb_build_array(jsonb_build_object('participantKey', 'observer', 'mode', 'READ'))),
        jsonb_build_object('key', 'hiddenForRequester', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'Afgeschermd', 'en', 'Restricted'), 'access', jsonb_build_array(
          jsonb_build_object('participantKey', 'requester', 'mode', 'HIDDEN'),
          jsonb_build_object('participantKey', 'manager', 'mode', 'READ')
        )),
        jsonb_build_object('key', 'conditionalForHr', 'type', 'SHORT_TEXT', 'label', jsonb_build_object('nl', 'Voorwaardelijk HR', 'en', 'Conditional HR'), 'visibilityCondition', jsonb_build_object(
          'operator', 'equals', 'left', jsonb_build_object('kind', 'FIELD', 'fieldKey', 'flag'), 'right', jsonb_build_object('kind', 'LITERAL', 'value', 'show')
        ), 'access', jsonb_build_array(jsonb_build_object('participantKey', 'hr', 'mode', 'WRITE_OPTIONAL'))),
        jsonb_build_object('key', 'documentRef', 'type', 'DOCUMENT_REFERENCE', 'label', jsonb_build_object('nl', 'Document', 'en', 'Document'), 'access', jsonb_build_array(jsonb_build_object('participantKey', 'hr', 'mode', 'WRITE_OPTIONAL')))
      )
    ))
  );

  insert into public.form_definitions (
    id, tenant_id, hr_group_id, scope_type, key, title, description, status, created_by_user_id, updated_by_user_id
  ) values (
    form_definition_id, actor_tenant, actor_group, 'TENANT', 'p5-four-participants',
    form_definition -> 'title', form_definition -> 'description', 'PUBLISHED', actor_user, actor_user
  );
  insert into public.form_versions (
    id, tenant_id, hr_group_id, form_definition_id, version_number, schema_version,
    compiler_version, definition_json, definition_hash, published_by_user_id
  ) values (
    form_version_id, actor_tenant, actor_group, form_definition_id, 1, 1,
    'p5-access-test', form_definition, repeat('e', 64), actor_user
  );

  process_definition := jsonb_build_object(
    'content', jsonb_build_object(
      'startStepKey', 'requester-step',
      'participants', jsonb_build_array(
        jsonb_build_object('key', 'requester', 'permission', 'self:process-task:act', 'assignmentMode', 'EXACTLY_ONE', 'selector', jsonb_build_object('type', 'INITIATOR', 'resolutionDatePolicy', 'STEP_ACTIVATED_AT')),
        jsonb_build_object('key', 'manager', 'permission', 'process-task:act', 'assignmentMode', 'ANY_ONE', 'selector', jsonb_build_object('type', 'INITIATOR', 'resolutionDatePolicy', 'STEP_ACTIVATED_AT')),
        jsonb_build_object('key', 'hr', 'permission', 'process-task:act', 'assignmentMode', 'ANY_ONE', 'selector', jsonb_build_object('type', 'INITIATOR', 'resolutionDatePolicy', 'STEP_ACTIVATED_AT')),
        jsonb_build_object('key', 'observer', 'permission', 'process-task:act', 'assignmentMode', 'ANY_ONE', 'selector', jsonb_build_object('type', 'INITIATOR', 'resolutionDatePolicy', 'STEP_ACTIVATED_AT'))
      ),
      'forms', jsonb_build_array(jsonb_build_object('key', 'shared', 'formVersionId', form_version_id)),
      'steps', jsonb_build_array(
        jsonb_build_object('key', 'requester-step', 'type', 'FORM', 'participantKey', 'requester', 'formKey', 'shared', 'allowedActions', jsonb_build_array('SUBMIT')),
        jsonb_build_object('key', 'manager-step', 'type', 'FORM', 'participantKey', 'manager', 'formKey', 'shared', 'allowedActions', jsonb_build_array('SUBMIT')),
        jsonb_build_object('key', 'hr-step', 'type', 'FORM', 'participantKey', 'hr', 'formKey', 'shared', 'allowedActions', jsonb_build_array('SUBMIT')),
        jsonb_build_object('key', 'observer-step', 'type', 'FORM', 'participantKey', 'observer', 'formKey', 'shared', 'allowedActions', jsonb_build_array('SUBMIT'))
      )
    )
  );
  insert into public.process_definitions (
    id, tenant_id, hr_group_id, scope_type, key, title, description, status, created_by_user_id, updated_by_user_id
  ) values (
    process_definition_id, actor_tenant, actor_group, 'TENANT', 'p5-four-participants',
    jsonb_build_object('nl', 'P5 vier deelnemers', 'en', 'P5 four participants'),
    jsonb_build_object('nl', 'Test', 'en', 'Test'), 'PUBLISHED', actor_user, actor_user
  );
  insert into public.process_versions (
    id, tenant_id, hr_group_id, process_definition_id, version_number, schema_version,
    compiler_version, definition_json, definition_hash, published_by_user_id
  ) values (
    process_version_id, actor_tenant, actor_group, process_definition_id, 1, 1,
    'p5-access-test', process_definition, repeat('f', 64), actor_user
  );

  insert into public.process_instances (
    id, tenant_id, hr_group_id, scope_type, process_definition_id, process_version_id,
    status, initiator_user_id, initiator_employee_id, current_step_key, instance_version,
    started_at, metadata, idempotency_key
  ) values (
    process_instance_id, actor_tenant, actor_group, 'TENANT', process_definition_id, process_version_id,
    'RUNNING', actor_user, actor_employee, 'requester-step', 1, timezone('utc', now()),
    jsonb_build_object('fields', jsonb_build_object('flag', 'show')), 'p5-four-participants'
  );
  insert into public.process_employee_subjects (process_instance_id, tenant_id, hr_group_id, employee_id)
  values (process_instance_id, actor_tenant, actor_group, actor_employee);

  for participant_key, step_key in
    select * from (values
      ('requester', 'requester-step'), ('manager', 'manager-step'), ('hr', 'hr-step'), ('observer', 'observer-step')
    ) as fixture(participant_key, step_key)
  loop
    step_id := extensions.gen_random_uuid();
    work_item_id := extensions.gen_random_uuid();
    insert into public.process_step_instances (
      id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, activation_number, status
    ) values (
      step_id, actor_tenant, actor_group, process_instance_id, process_version_id, step_key, 1, 'ACTIVE'
    );
    insert into public.process_work_items (
      id, tenant_id, hr_group_id, process_instance_id, step_instance_id, process_version_id,
      step_key, participant_key, assignment_mode, status, assignee_employee_id, allow_self_assignment
    ) values (
      work_item_id, actor_tenant, actor_group, process_instance_id, step_id, process_version_id,
      step_key, participant_key, 'ANY_ONE', 'OPEN', actor_employee, true
    );
    perform set_config('app.p5_four_' || participant_key || '_work_item_id', work_item_id::text, true);
  end loop;
  perform set_config('app.p5_four_actor_user_id', actor_user::text, true);
  perform set_config('app.p5_four_document_id', document_id::text, true);
end;
$fixture$;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('app.p5_four_actor_user_id'))::text, true);
set local role authenticated;

do $projection$
declare
  requester_projection jsonb;
  manager_projection jsonb;
  hr_projection jsonb;
  observer_projection jsonb;
  document_save jsonb;
  visible_count integer;
begin
  requester_projection := public.get_process_form_projection(current_setting('app.p5_four_requester_work_item_id')::uuid, 'nl');
  manager_projection := public.get_process_form_projection(current_setting('app.p5_four_manager_work_item_id')::uuid, 'nl');
  hr_projection := public.get_process_form_projection(current_setting('app.p5_four_hr_work_item_id')::uuid, 'en');
  observer_projection := public.get_process_form_projection(current_setting('app.p5_four_observer_work_item_id')::uuid, 'nl');

  select count(*) into visible_count from jsonb_array_elements((requester_projection -> 'sections' -> 0) -> 'fields');
  if visible_count <> 2
    or not exists (select 1 from jsonb_array_elements((requester_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'requesterOnly')
    or exists (select 1 from jsonb_array_elements((requester_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'hiddenForRequester') then
    raise exception 'P5_REQUESTER_PROJECTION_INVALID: %', requester_projection;
  end if;

  select count(*) into visible_count from jsonb_array_elements((manager_projection -> 'sections' -> 0) -> 'fields');
  if visible_count <> 3
    or not exists (select 1 from jsonb_array_elements((manager_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'managerOnly' and field ->> 'accessMode' = 'READ')
    or not exists (select 1 from jsonb_array_elements((manager_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'hiddenForRequester') then
    raise exception 'P5_MANAGER_PROJECTION_INVALID: %', manager_projection;
  end if;

  select count(*) into visible_count from jsonb_array_elements((hr_projection -> 'sections' -> 0) -> 'fields');
  if visible_count <> 4
    or not exists (select 1 from jsonb_array_elements((hr_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'conditionalForHr')
    or not exists (select 1 from jsonb_array_elements((hr_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'documentRef')
    or not exists (select 1 from jsonb_array_elements((hr_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'label' = 'HR') then
    raise exception 'P5_HR_PROJECTION_INVALID: %', hr_projection;
  end if;

  select count(*) into visible_count from jsonb_array_elements((observer_projection -> 'sections' -> 0) -> 'fields');
  if visible_count <> 2
    or not exists (select 1 from jsonb_array_elements((observer_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' = 'observerOnly')
    or exists (select 1 from jsonb_array_elements((observer_projection -> 'sections' -> 0) -> 'fields') field where field ->> 'key' in ('requesterOnly', 'managerOnly', 'hrOnly', 'documentRef')) then
    raise exception 'P5_OBSERVER_PROJECTION_INVALID: %', observer_projection;
  end if;

  begin
    perform public.save_process_form_response(
      current_setting('app.p5_four_hr_work_item_id')::uuid, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('documentRef', 'not-a-uuid')),
      'p5-document-invalid', null, 'en'
    );
    raise exception 'P5_DOCUMENT_REFERENCE_INVALID_ACCEPTED';
  exception when others then
    if sqlerrm <> 'INVALID_FORM_VALUE' then raise; end if;
  end;

  begin
    perform public.save_process_form_response(
      current_setting('app.p5_four_hr_work_item_id')::uuid, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('documentRef', extensions.gen_random_uuid())),
      'p5-document-missing', null, 'en'
    );
    raise exception 'P5_DOCUMENT_REFERENCE_MISSING_ACCEPTED';
  exception when others then
    if sqlerrm <> 'INVALID_FORM_VALUE' then raise; end if;
  end;

  document_save := public.save_process_form_response(
    current_setting('app.p5_four_hr_work_item_id')::uuid, 0, 0,
    jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('documentRef', current_setting('app.p5_four_document_id')::uuid)),
    'p5-document-valid', null, 'en'
  );
  if (document_save ->> 'revision')::bigint <> 1
    or not exists (
      select 1
      from jsonb_array_elements((document_save -> 'sections' -> 0) -> 'fields') field
      where field ->> 'key' = 'documentRef'
        and field -> 'newValue' = to_jsonb(current_setting('app.p5_four_document_id')::text)
    ) then
    raise exception 'P5_DOCUMENT_REFERENCE_SAVE_INVALID: %', document_save;
  end if;
end;
$projection$;

rollback;
