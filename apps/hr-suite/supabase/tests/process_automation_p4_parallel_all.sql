-- P4 parallel ALL gate: two branches, two candidates per branch, deferred join.
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
      'startStepKey', 'fork',
      'participants', jsonb_build_array(jsonb_build_object(
        'key', 'all-approvers',
        'permission', 'self:process-task:act',
        'assignmentMode', 'ALL',
        'selector', jsonb_build_object(
          'type', 'PERMISSION_WORK_QUEUE',
          'permission', 'process-task:act',
          'queueKey', 'all-approvers',
          'resolutionDatePolicy', 'STEP_ACTIVATED_AT'
        )
      )),
      'steps', jsonb_build_array(
        jsonb_build_object('key', 'fork', 'type', 'PARALLEL_FORK'),
        jsonb_build_object('key', 'branch-a', 'type', 'ACKNOWLEDGEMENT', 'participantKey', 'all-approvers', 'allowedActions', jsonb_build_array('COMPLETE')),
        jsonb_build_object('key', 'branch-b', 'type', 'ACKNOWLEDGEMENT', 'participantKey', 'all-approvers', 'allowedActions', jsonb_build_array('COMPLETE')),
        jsonb_build_object('key', 'join', 'type', 'PARALLEL_JOIN'),
        jsonb_build_object('key', 'done', 'type', 'END', 'terminalOutcome', 'COMPLETED')
      ),
      'transitions', jsonb_build_array(
        jsonb_build_object('key', 'fork-a', 'fromStepKey', 'fork', 'action', 'COMPLETE', 'toStepKey', 'branch-a'),
        jsonb_build_object('key', 'fork-b', 'fromStepKey', 'fork', 'action', 'COMPLETE', 'toStepKey', 'branch-b'),
        jsonb_build_object('key', 'branch-a-join', 'fromStepKey', 'branch-a', 'action', 'COMPLETE', 'toStepKey', 'join'),
        jsonb_build_object('key', 'branch-b-join', 'fromStepKey', 'branch-b', 'action', 'COMPLETE', 'toStepKey', 'join'),
        jsonb_build_object('key', 'join-done', 'fromStepKey', 'join', 'action', 'COMPLETE', 'toStepKey', 'done')
      )
    )
  );
begin
  update public.employees
  set auth_user_id = 'f9157157-6527-4348-8200-57ef57e28df1'::uuid
  where id = '01c349f0-be6f-01dc-4d96-b5bf66085a56'::uuid
    and tenant_id = actor_tenant
    and hr_group_id = actor_group
    and auth_user_id is null;
  update public.user_hr_group_access
  set management_role_id = 'dcebe348-61ca-4d42-8409-e4b2495e26d6'::uuid
  where user_id = 'f9157157-6527-4348-8200-57ef57e28df1'::uuid
    and tenant_id = actor_tenant
    and hr_group_id = actor_group;

  insert into public.process_definitions (
    id, tenant_id, hr_group_id, scope_type, key, title, description, status, created_by_user_id, updated_by_user_id
  ) values (
    process_definition_id, actor_tenant, actor_group, 'TENANT', 'p4-parallel-all',
    jsonb_build_object('nl', 'P4 parallel ALL', 'en', 'P4 parallel ALL'),
    jsonb_build_object('nl', 'Test', 'en', 'Test'), 'PUBLISHED', actor_user, actor_user
  );
  insert into public.process_versions (
    id, tenant_id, hr_group_id, process_definition_id, version_number, schema_version,
    compiler_version, definition_json, definition_hash, published_by_user_id
  ) values (
    process_version_id, actor_tenant, actor_group, process_definition_id, 1, 1,
    'p4-parallel-test', process_definition, repeat('d', 64), actor_user
  );
  perform set_config('app.p4_parallel_process_definition_id', process_definition_id::text, true);
  perform set_config('app.p4_parallel_actor_user_id', actor_user::text, true);
end;
$fixture$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', current_setting('app.p4_parallel_actor_user_id'))::text,
  true
);
set local role authenticated;

do $start$
declare
  result jsonb;
begin
  result := public.start_process(
    current_setting('app.p4_parallel_process_definition_id')::uuid,
    '6f2e2302-748f-8684-0ce6-1b29702d5d92'::uuid,
    null,
    current_date,
    'p4-parallel-start',
    null
  );
  perform set_config('app.p4_parallel_instance_id', result ->> 'processInstanceId', true);
  if result ->> 'status' <> 'RUNNING' then raise exception 'P4_PARALLEL_START_INVALID: %', result; end if;
end;
$start$;

set local role postgres;
do $inspect$
declare
  branch_a_actor_item uuid;
  branch_a_second_item uuid;
  branch_b_actor_item uuid;
  branch_b_second_item uuid;
  candidate_count integer;
begin
  select count(*) into candidate_count
  from public.process_work_item_candidates candidate
  join public.process_work_items item on item.id = candidate.work_item_id
  where item.process_instance_id = current_setting('app.p4_parallel_instance_id')::uuid
    and item.step_key in ('branch-a', 'branch-b')
    and candidate.is_eligible;
  if candidate_count <> 4 then raise exception 'P4_PARALLEL_CANDIDATE_COUNT_INVALID: %', candidate_count; end if;

  select item.id into branch_a_actor_item
  from public.process_work_items item
  join public.process_work_item_candidates candidate on candidate.work_item_id = item.id
  where item.process_instance_id = current_setting('app.p4_parallel_instance_id')::uuid
    and item.step_key = 'branch-a'
    and candidate.candidate_user_id = 'f9157157-6527-4348-8200-57ef57e28df1'::uuid
    and candidate.is_eligible;
  select item.id into branch_a_second_item
  from public.process_work_items item
  join public.process_work_item_candidates candidate on candidate.work_item_id = item.id
  where item.process_instance_id = current_setting('app.p4_parallel_instance_id')::uuid
    and item.step_key = 'branch-a'
    and candidate.candidate_user_id = '71e35860-95c9-4ba3-ac9a-6b366096d8ec'::uuid
    and candidate.is_eligible;
  select item.id into branch_b_actor_item
  from public.process_work_items item
  join public.process_work_item_candidates candidate on candidate.work_item_id = item.id
  where item.process_instance_id = current_setting('app.p4_parallel_instance_id')::uuid
    and item.step_key = 'branch-b'
    and candidate.candidate_user_id = 'f9157157-6527-4348-8200-57ef57e28df1'::uuid
    and candidate.is_eligible;
  select item.id into branch_b_second_item
  from public.process_work_items item
  join public.process_work_item_candidates candidate on candidate.work_item_id = item.id
  where item.process_instance_id = current_setting('app.p4_parallel_instance_id')::uuid
    and item.step_key = 'branch-b'
    and candidate.candidate_user_id = '71e35860-95c9-4ba3-ac9a-6b366096d8ec'::uuid
    and candidate.is_eligible;
  if branch_a_actor_item is null or branch_a_second_item is null or branch_b_actor_item is null or branch_b_second_item is null then
    raise exception 'P4_PARALLEL_CANDIDATE_FIXTURE_INVALID';
  end if;
  perform set_config('app.p4_parallel_a_actor_item', branch_a_actor_item::text, true);
  perform set_config('app.p4_parallel_a_second_item', branch_a_second_item::text, true);
  perform set_config('app.p4_parallel_b_actor_item', branch_b_actor_item::text, true);
  perform set_config('app.p4_parallel_b_second_item', branch_b_second_item::text, true);
end;
$inspect$;

select set_config('request.jwt.claims', jsonb_build_object('sub', 'f9157157-6527-4348-8200-57ef57e28df1')::text, true);
set local role authenticated;
do $a1$
declare result jsonb;
begin
  result := public.perform_process_work_item_action(current_setting('app.p4_parallel_a_actor_item')::uuid, 'COMPLETE', 1, 1, 'p4-parallel-a-actor', null);
  if result ->> 'status' <> 'RUNNING' then raise exception 'P4_PARALLEL_FIRST_BRANCH_ACTION_INVALID: %', result; end if;
end;
$a1$;

select set_config('request.jwt.claims', jsonb_build_object('sub', '71e35860-95c9-4ba3-ac9a-6b366096d8ec')::text, true);
do $a2$
declare result jsonb;
begin
  result := public.perform_process_work_item_action(current_setting('app.p4_parallel_a_second_item')::uuid, 'COMPLETE', 1, 2, 'p4-parallel-a-second', null);
  if result ->> 'status' <> 'RUNNING' then raise exception 'P4_PARALLEL_SECOND_A_ACTION_INVALID: %', result; end if;
end;
$a2$;

select set_config('request.jwt.claims', jsonb_build_object('sub', 'f9157157-6527-4348-8200-57ef57e28df1')::text, true);
do $b1$
declare result jsonb;
begin
  result := public.perform_process_work_item_action(current_setting('app.p4_parallel_b_actor_item')::uuid, 'COMPLETE', 1, 1, 'p4-parallel-b-actor', null);
  if result ->> 'status' <> 'RUNNING' then raise exception 'P4_PARALLEL_FIRST_B_BRANCH_ACTION_INVALID: %', result; end if;
end;
$b1$;

select set_config('request.jwt.claims', jsonb_build_object('sub', '71e35860-95c9-4ba3-ac9a-6b366096d8ec')::text, true);
do $b2$
declare result jsonb;
begin
  result := public.perform_process_work_item_action(current_setting('app.p4_parallel_b_second_item')::uuid, 'COMPLETE', 1, 2, 'p4-parallel-b-second', null);
  if result ->> 'status' <> 'COMPLETED' then raise exception 'P4_PARALLEL_TERMINAL_STATUS_INVALID: %', result; end if;
end;
$b2$;

rollback;
