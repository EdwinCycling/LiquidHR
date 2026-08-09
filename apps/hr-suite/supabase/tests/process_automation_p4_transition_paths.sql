-- P4 transition-path gate: request changes, reject, cancel and rollback.
-- Alle fixtures worden in dezelfde transactie aangemaakt en teruggedraaid.

begin;

set local role postgres;

do $fixture$
declare
  actor_user uuid := 'b86f6a66-276d-4f3d-a985-230f2cca9fdb';
  actor_tenant uuid := '07249eb9-545c-883b-b26b-d52f83b4f4a1';
  actor_group uuid := '6ba6f1df-e376-40f2-abff-ffdf000172e1';
  process_definition_id uuid := extensions.gen_random_uuid();
  process_version_id uuid := extensions.gen_random_uuid();
  process_definition jsonb := jsonb_build_object(
    'content', jsonb_build_object(
      'startStepKey', 'request',
      'participants', jsonb_build_array(jsonb_build_object(
        'key', 'requester',
        'permission', 'self:process-task:act',
        'assignmentMode', 'EXACTLY_ONE',
        'selector', jsonb_build_object('type', 'INITIATOR', 'resolutionDatePolicy', 'STEP_ACTIVATED_AT')
      )),
      'steps', jsonb_build_array(
        jsonb_build_object(
          'key', 'request', 'type', 'ACKNOWLEDGEMENT', 'participantKey', 'requester',
          'allowedActions', jsonb_build_array('REQUEST_CHANGES', 'REJECT', 'CANCEL', 'COMPLETE')
        ),
        jsonb_build_object('key', 'rejected', 'type', 'END', 'terminalOutcome', 'REJECTED'),
        jsonb_build_object('key', 'cancelled', 'type', 'END', 'terminalOutcome', 'CANCELLED')
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object('key', 'request-changes', 'fromStepKey', 'request', 'action', 'REQUEST_CHANGES', 'toStepKey', 'request'),
        jsonb_build_object('key', 'reject', 'fromStepKey', 'request', 'action', 'REJECT', 'toStepKey', 'rejected'),
        jsonb_build_object('key', 'cancel', 'fromStepKey', 'request', 'action', 'CANCEL', 'toStepKey', 'cancelled'),
        jsonb_build_object('key', 'half-failure', 'fromStepKey', 'request', 'action', 'COMPLETE', 'toStepKey', 'missing-step')
      )
    )
  );
begin
  insert into public.process_definitions (
    id, tenant_id, hr_group_id, scope_type, key, title, description, status, created_by_user_id, updated_by_user_id
  ) values (
    process_definition_id, actor_tenant, actor_group, 'TENANT', 'p4-transition-paths',
    jsonb_build_object('nl', 'P4 overgangspaden', 'en', 'P4 transition paths'),
    jsonb_build_object('nl', 'Test', 'en', 'Test'), 'PUBLISHED', actor_user, actor_user
  );
  insert into public.process_versions (
    id, tenant_id, hr_group_id, process_definition_id, version_number, schema_version,
    compiler_version, definition_json, definition_hash, published_by_user_id
  ) values (
    process_version_id, actor_tenant, actor_group, process_definition_id, 1, 1,
    'p4-transition-test', process_definition, repeat('c', 64), actor_user
  );
  perform set_config('app.p4_transition_process_definition_id', process_definition_id::text, true);
  perform set_config('app.p4_transition_actor_user_id', actor_user::text, true);
end;
$fixture$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('app.p4_transition_actor_user_id'))::text,
  true
);
set local role authenticated;

do $runtime$
declare
  request_changes_result jsonb;
  reject_result jsonb;
  cancel_result jsonb;
  failed_instance_result jsonb;
  failed_projection jsonb;
  process_definition_id uuid := current_setting('app.p4_transition_process_definition_id')::uuid;
  actor_employee uuid := '6f2e2302-748f-8684-0ce6-1b29702d5d92';
  request_changes_instance_id uuid;
  reject_instance_id uuid;
  cancel_instance_id uuid;
  failed_instance_id uuid;
  request_changes_item_id uuid;
  reject_item_id uuid;
  cancel_item_id uuid;
  failed_item_id uuid;
  request_changes_projection jsonb;
begin
  request_changes_result := public.start_process(process_definition_id, actor_employee, null, current_date, 'p4-request-changes', null);
  request_changes_instance_id := (request_changes_result ->> 'processInstanceId')::uuid;
  request_changes_projection := public.get_process_instance_projection(request_changes_instance_id);
  request_changes_item_id := ((request_changes_projection -> 'workItems' -> 0) ->> 'id')::uuid;
  request_changes_result := public.perform_process_work_item_action(
    request_changes_item_id, 'REQUEST_CHANGES', 1, 1, 'p4-request-changes-action', null
  );
  if request_changes_result ->> 'status' <> 'RUNNING' then
    raise exception 'P4_REQUEST_CHANGES_STATUS_INVALID: %', request_changes_result;
  end if;
  request_changes_projection := public.get_process_instance_projection(request_changes_instance_id);
  if (select count(*) from jsonb_array_elements(request_changes_projection -> 'workItems')) <> 2
    or (select count(*) from jsonb_array_elements(request_changes_projection -> 'workItems') item where item ->> 'status' = 'OPEN') <> 1
    or (request_changes_projection ->> 'currentStepKey') <> 'request' then
    raise exception 'P4_REQUEST_CHANGES_PATH_INVALID: %', request_changes_projection;
  end if;

  reject_result := public.start_process(process_definition_id, actor_employee, null, current_date, 'p4-reject', null);
  reject_instance_id := (reject_result ->> 'processInstanceId')::uuid;
  reject_item_id := (((public.get_process_instance_projection(reject_instance_id)) -> 'workItems' -> 0) ->> 'id')::uuid;
  reject_result := public.perform_process_work_item_action(reject_item_id, 'REJECT', 1, 1, 'p4-reject-action', null);
  if reject_result ->> 'status' <> 'REJECTED' then raise exception 'P4_REJECT_STATUS_INVALID: %', reject_result; end if;

  cancel_result := public.start_process(process_definition_id, actor_employee, null, current_date, 'p4-cancel', null);
  cancel_instance_id := (cancel_result ->> 'processInstanceId')::uuid;
  cancel_item_id := (((public.get_process_instance_projection(cancel_instance_id)) -> 'workItems' -> 0) ->> 'id')::uuid;
  cancel_result := public.perform_process_work_item_action(cancel_item_id, 'CANCEL', 1, 1, 'p4-cancel-action', null);
  if cancel_result ->> 'status' <> 'CANCELLED' then raise exception 'P4_CANCEL_STATUS_INVALID: %', cancel_result; end if;

  failed_instance_result := public.start_process(process_definition_id, actor_employee, null, current_date, 'p4-half-failure', null);
  failed_instance_id := (failed_instance_result ->> 'processInstanceId')::uuid;
  failed_item_id := (((public.get_process_instance_projection(failed_instance_id)) -> 'workItems' -> 0) ->> 'id')::uuid;
  begin
    perform public.perform_process_work_item_action(failed_item_id, 'COMPLETE', 1, 1, 'p4-half-failure-action', null);
    raise exception 'P4_HALF_FAILURE_ACCEPTED';
  exception when others then
    if sqlerrm <> 'STEP_NOT_FOUND' then raise; end if;
  end;
  failed_projection := public.get_process_instance_projection(failed_instance_id);
  if failed_projection ->> 'status' <> 'RUNNING'
    or (failed_projection ->> 'currentStepKey') <> 'request'
    or (select count(*) from jsonb_array_elements(failed_projection -> 'workItems') item where item ->> 'status' = 'OPEN') <> 1
    or exists (
      select 1 from public.process_events event
      where event.process_instance_id = failed_instance_id
        and event.idempotency_key = 'p4-half-failure-action'
    ) then
    raise exception 'P4_HALF_FAILURE_ROLLBACK_INVALID: %', failed_projection;
  end if;
end;
$runtime$;

rollback;
