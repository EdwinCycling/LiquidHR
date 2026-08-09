-- P4/P5 transactionele runtime-gate.
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
  form_definition jsonb;
  process_definition jsonb;
begin
  form_definition := jsonb_build_object(
    'enabledLanguages', jsonb_build_array('nl', 'en'),
    'title', jsonb_build_object('nl', 'Contractformulier', 'en', 'Contract form'),
    'description', jsonb_build_object('nl', 'Testformulier', 'en', 'Test form'),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'key', 'details',
        'title', jsonb_build_object('nl', 'Details', 'en', 'Details'),
        'fields', jsonb_build_array(
          jsonb_build_object(
            'key', 'reason',
            'type', 'SHORT_TEXT',
            'label', jsonb_build_object('nl', 'Reden', 'en', 'Reason'),
            'access', jsonb_build_array(jsonb_build_object('participantKey', 'requester', 'mode', 'WRITE_REQUIRED'))
          ),
          jsonb_build_object(
            'key', 'optional',
            'type', 'SHORT_TEXT',
            'label', jsonb_build_object('nl', 'Optioneel', 'en', 'Optional'),
            'access', jsonb_build_array(jsonb_build_object('participantKey', 'requester', 'mode', 'WRITE_OPTIONAL'))
          ),
          jsonb_build_object(
            'key', 'readOnly',
            'type', 'SHORT_TEXT',
            'label', jsonb_build_object('nl', 'Alleen lezen', 'en', 'Read only'),
            'access', jsonb_build_array(jsonb_build_object('participantKey', 'requester', 'mode', 'READ'))
          ),
          jsonb_build_object(
            'key', 'conditional',
            'type', 'SHORT_TEXT',
            'label', jsonb_build_object('nl', 'Voorwaardelijk', 'en', 'Conditional'),
            'visibilityCondition', jsonb_build_object(
              'operator', 'equals',
              'left', jsonb_build_object('kind', 'FIELD', 'fieldKey', 'reason'),
              'right', jsonb_build_object('kind', 'LITERAL', 'value', 'show')
            ),
            'access', jsonb_build_array(jsonb_build_object('participantKey', 'requester', 'mode', 'WRITE_OPTIONAL'))
          ),
          jsonb_build_object(
            'key', 'secret',
            'type', 'SHORT_TEXT',
            'label', jsonb_build_object('nl', 'Geheim', 'en', 'Secret'),
            'access', jsonb_build_array(jsonb_build_object('participantKey', 'requester', 'mode', 'HIDDEN'))
          )
        )
      )
    )
  );

  insert into public.form_definitions (
    id, tenant_id, hr_group_id, scope_type, key, title, description, status, created_by_user_id, updated_by_user_id
  ) values (
    form_definition_id, actor_tenant, actor_group, 'TENANT', 'p4-p5-contract-form',
    form_definition -> 'title', form_definition -> 'description', 'PUBLISHED', actor_user, actor_user
  );

  insert into public.form_versions (
    id, tenant_id, hr_group_id, form_definition_id, version_number, schema_version,
    compiler_version, definition_json, definition_hash, published_by_user_id
  ) values (
    form_version_id, actor_tenant, actor_group, form_definition_id, 1, 1,
    'p4-p5-test', form_definition, repeat('a', 64), actor_user
  );

  process_definition := jsonb_build_object(
    'content', jsonb_build_object(
      'startStepKey', 'request',
      'participants', jsonb_build_array(
        jsonb_build_object(
          'key', 'requester',
          'permission', 'self:process-task:act',
          'assignmentMode', 'EXACTLY_ONE',
          'selector', jsonb_build_object('type', 'INITIATOR', 'resolutionDatePolicy', 'STEP_ACTIVATED_AT')
        )
      ),
      'forms', jsonb_build_array(
        jsonb_build_object('key', 'transfer', 'formVersionId', form_version_id)
      ),
      'steps', jsonb_build_array(
        jsonb_build_object(
          'key', 'request',
          'type', 'FORM',
          'participantKey', 'requester',
          'formKey', 'transfer',
          'allowedActions', jsonb_build_array('SUBMIT', 'CANCEL')
        ),
        jsonb_build_object('key', 'done', 'type', 'END', 'terminalOutcome', 'COMPLETED')
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object(
          'key', 'submit-request',
          'fromStepKey', 'request',
          'action', 'SUBMIT',
          'toStepKey', 'done'
        )
      )
    )
  );

  insert into public.process_definitions (
    id, tenant_id, hr_group_id, scope_type, key, title, description, status, created_by_user_id, updated_by_user_id
  ) values (
    process_definition_id, actor_tenant, actor_group, 'TENANT', 'p4-p5-contract-process',
    jsonb_build_object('nl', 'Contractproces', 'en', 'Contract process'),
    jsonb_build_object('nl', 'Test', 'en', 'Test'), 'PUBLISHED', actor_user, actor_user
  );

  insert into public.process_versions (
    id, tenant_id, hr_group_id, process_definition_id, version_number, schema_version,
    compiler_version, definition_json, definition_hash, published_by_user_id
  ) values (
    process_version_id, actor_tenant, actor_group, process_definition_id, 1, 1,
    'p4-p5-test', process_definition, repeat('b', 64), actor_user
  );

  perform set_config('app.p4_p5_test_process_definition_id', process_definition_id::text, true);
  perform set_config('app.p4_p5_test_subject_employee_id', actor_employee::text, true);
  perform set_config('app.p4_p5_test_actor_user_id', actor_user::text, true);
end;
$fixture$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('app.p4_p5_test_actor_user_id'))::text,
  true
);

set local role authenticated;

do $runtime$
declare
  start_result jsonb;
  repeat_start_result jsonb;
  instance_projection jsonb;
  form_projection jsonb;
  save_result jsonb;
  submit_result jsonb;
  repeat_submit_result jsonb;
  process_instance_id uuid;
  work_item_id uuid;
  visible_field_count integer;
  field_keys text[];
begin
  start_result := public.start_process(
    current_setting('app.p4_p5_test_process_definition_id')::uuid,
    current_setting('app.p4_p5_test_subject_employee_id')::uuid,
    null,
    current_date,
    'p4-p5-start-1',
    null
  );
  process_instance_id := (start_result ->> 'processInstanceId')::uuid;
  if (start_result ->> 'status') <> 'RUNNING' then
    raise exception 'P4_START_STATUS_INVALID: %', start_result;
  end if;

  instance_projection := public.get_process_instance_projection(process_instance_id);
  work_item_id := ((instance_projection -> 'workItems' -> 0) ->> 'id')::uuid;
  if work_item_id is null then raise exception 'P4_WORK_ITEM_NOT_MATERIALIZED'; end if;

  form_projection := public.get_process_form_projection(work_item_id, 'nl');
  select count(*), array_agg(value ->> 'key' order by value ->> 'key')
    into visible_field_count, field_keys
  from jsonb_array_elements((form_projection -> 'sections' -> 0) -> 'fields') value;
  if visible_field_count <> 3 or field_keys <> array['optional', 'readOnly', 'reason'] then
    raise exception 'P5_HIDDEN_FIELD_LEAK: %', form_projection;
  end if;
  if form_projection ? 'secret' or form_projection ->> 'htmlSummary' like '%Geheim%' then
    raise exception 'P5_HIDDEN_FIELD_SUMMARY_LEAK';
  end if;

  begin
    perform public.save_process_form_response(
      work_item_id, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('secret', 'leak')),
      'p4-p5-hidden-1', null, 'nl'
    );
    raise exception 'P5_HIDDEN_FIELD_ACCEPTED';
  exception when others then
    if sqlerrm <> 'HIDDEN_FIELD_SUBMITTED' then raise; end if;
  end;

  begin
    perform public.save_process_form_response(
      work_item_id, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('readOnly', 'tamper')),
      'p4-p5-read-only-1', null, 'nl'
    );
    raise exception 'P5_READ_ONLY_FIELD_ACCEPTED';
  exception when others then
    if sqlerrm <> 'FIELD_NOT_WRITABLE' then raise; end if;
  end;

  begin
    perform public.save_process_form_response(
      work_item_id, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('reason', 42)),
      'p4-p5-invalid-1', null, 'nl'
    );
    raise exception 'P5_INVALID_FORM_VALUE_ACCEPTED';
  exception when others then
    if sqlerrm <> 'INVALID_FORM_VALUE' then raise; end if;
  end;

  begin
    perform public.save_process_form_response(
      work_item_id, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('conditional', 'hidden')),
      'p4-p5-conditional-hidden-1', null, 'nl'
    );
    raise exception 'P5_CONDITIONAL_HIDDEN_FIELD_ACCEPTED';
  exception when others then
    if sqlerrm <> 'HIDDEN_FIELD_SUBMITTED' then raise; end if;
  end;

  begin
    perform public.save_process_form_response(
      work_item_id, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('reason', '')),
      'p4-p5-required-1', null, 'nl'
    );
    raise exception 'P5_REQUIRED_FIELD_ACCEPTED_EMPTY';
  exception when others then
    if sqlerrm <> 'REQUIRED_FORM_FIELD' then raise; end if;
  end;

  save_result := public.save_process_form_response(
    work_item_id, 0, 0,
    jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('reason', 'Approved transfer', 'optional', 'Extra context')),
    'p4-p5-save-1', null, 'nl'
  );
  if (save_result ->> 'revision')::bigint <> 1
    or (save_result ->> 'expectedVersion')::bigint <> 1 then
    raise exception 'P5_SAVE_VERSION_INVALID: %', save_result;
  end if;
  if not exists (
    select 1 from jsonb_array_elements((save_result -> 'sections' -> 0) -> 'fields') field_projection
    where field_projection ->> 'key' = 'reason'
      and field_projection ->> 'newValue' = 'Approved transfer'
  ) then raise exception 'P5_CURRENT_NEW_PROJECTION_INVALID: %', save_result; end if;

  begin
    perform public.save_process_form_response(
      work_item_id, 0, 0,
      jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('reason', 'Stale')),
      'p4-p5-save-stale', null, 'nl'
    );
    raise exception 'P5_STALE_SAVE_ACCEPTED';
  exception when others then
    if sqlerrm <> 'STALE_FORM_RESPONSE' then raise; end if;
  end;

  save_result := public.save_process_form_response(
    work_item_id, 1, 1,
    jsonb_build_object('current', '{}'::jsonb, 'new', jsonb_build_object('reason', 'show')),
    'p4-p5-save-2', null, 'nl'
  );
  if (save_result ->> 'revision')::bigint <> 2
    or (save_result ->> 'expectedVersion')::bigint <> 2
    or not exists (
      select 1 from jsonb_array_elements((save_result -> 'sections' -> 0) -> 'fields') field_projection
      where field_projection ->> 'key' = 'conditional'
    ) then
    raise exception 'P5_CONDITIONAL_RULE_INVALID: %', save_result;
  end if;

  begin
    perform public.perform_process_work_item_action(
      work_item_id, 'APPROVE', 1, 1, 'p4-p5-approve-1', null
    );
    raise exception 'P4_FORBIDDEN_ACTION_ACCEPTED';
  exception when others then
    if sqlerrm <> 'FORBIDDEN_ACTION' then raise; end if;
  end;

  begin
    perform public.perform_process_work_item_action(
      work_item_id, 'SUBMIT', 0, 1, 'p4-p5-submit-stale', null
    );
    raise exception 'P4_STALE_ACTION_ACCEPTED';
  exception when others then
    if sqlerrm <> 'STALE_STATE' then raise; end if;
  end;

  submit_result := public.perform_process_work_item_action(
    work_item_id, 'SUBMIT', 1, 1, 'p4-p5-submit-1', null
  );
  if (submit_result ->> 'status') <> 'COMPLETED' then
    raise exception 'P4_SUBMIT_STATUS_INVALID: %', submit_result;
  end if;

  repeat_submit_result := public.perform_process_work_item_action(
    work_item_id, 'SUBMIT', 999, 999, 'p4-p5-submit-1', null
  );
  if (repeat_submit_result ->> 'eventId') <> (submit_result ->> 'eventId') then
    raise exception 'P4_ACTION_IDEMPOTENCY_INVALID: % / %', submit_result, repeat_submit_result;
  end if;

  repeat_start_result := public.start_process(
    current_setting('app.p4_p5_test_process_definition_id')::uuid,
    current_setting('app.p4_p5_test_subject_employee_id')::uuid,
    null,
    current_date,
    'p4-p5-start-1',
    null
  );
  if repeat_start_result ->> 'processInstanceId' <> process_instance_id::text then
    raise exception 'P4_START_IDEMPOTENCY_INVALID: % / %', start_result, repeat_start_result;
  end if;
end;
$runtime$;

set local role postgres;

do $audit$
begin
  if exists (
    select 1
    from public.audit_logs
    where entity_name like 'process_%'
      and (changes ? 'current_values' or changes ? 'new_values')
  ) then
    raise exception 'P4_P5_AUDIT_FORM_VALUES_PRESENT';
  end if;
  if not exists (
    select 1
    from public.audit_logs
    where entity_name in ('process_instances', 'process_events', 'process_form_response', 'process_form_response_revision')
      and action in ('CREATE', 'UPDATE')
  ) then
    raise exception 'P4_P5_AUDIT_NOT_WRITTEN';
  end if;
end;
$audit$;

rollback;
