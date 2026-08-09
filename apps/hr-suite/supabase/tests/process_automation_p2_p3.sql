-- Voer dit script uit met Supabase SQL Editor of supabase_execute_sql.
-- Alle runtime-fixtures staan in één transactie en worden aan het einde teruggedraaid.

begin;

do $$
declare
  expected_table_count integer := 13;
  protected_table_count integer;
  unprotected_table_count integer;
  policy_count integer;
  direct_mutation_grant_count integer;
  actor_tenant uuid;
  actor_group uuid;
  actor_employee uuid;
  actor_user uuid;
  subject_employee uuid;
  definition_id uuid := gen_random_uuid();
  version_id uuid := gen_random_uuid();
  instance_id uuid := gen_random_uuid();
  step_id uuid := gen_random_uuid();
  work_item_id uuid := gen_random_uuid();
  result jsonb;
  event_count integer;
begin
  select count(*) into protected_table_count
  from pg_class relation
  join pg_namespace schema on schema.oid = relation.relnamespace
  where schema.nspname = 'public'
    and relation.relname in (
      'process_definitions', 'process_definition_drafts', 'process_versions',
      'form_definitions', 'form_definition_drafts', 'form_versions',
      'process_instances', 'process_employee_subjects', 'process_employment_subjects',
      'process_step_instances', 'process_work_items', 'process_work_item_candidates',
      'process_events'
    )
    and relation.relrowsecurity;
  if protected_table_count <> expected_table_count then
    raise exception 'P2_RLS_TABLE_COUNT_INVALID: %', protected_table_count;
  end if;

  select count(*) into unprotected_table_count
  from pg_class relation
  join pg_namespace schema on schema.oid = relation.relnamespace
  where schema.nspname = 'public'
    and relation.relname in (
      'process_definitions', 'process_definition_drafts', 'process_versions',
      'form_definitions', 'form_definition_drafts', 'form_versions',
      'process_instances', 'process_employee_subjects', 'process_employment_subjects',
      'process_step_instances', 'process_work_items', 'process_work_item_candidates',
      'process_events'
    )
    and not relation.relrowsecurity;
  if unprotected_table_count <> 0 then raise exception 'P2_RLS_DISABLED'; end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'process_definitions', 'process_definition_drafts', 'process_versions',
      'form_definitions', 'form_definition_drafts', 'form_versions',
      'process_instances', 'process_employee_subjects', 'process_employment_subjects',
      'process_step_instances', 'process_work_items', 'process_work_item_candidates',
      'process_events'
    );
  if policy_count <> expected_table_count then raise exception 'P2_RLS_POLICY_COUNT_INVALID: %', policy_count; end if;

  select count(*) into direct_mutation_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and table_name in (
      'process_definitions', 'process_definition_drafts', 'process_versions',
      'form_definitions', 'form_definition_drafts', 'form_versions',
      'process_instances', 'process_employee_subjects', 'process_employment_subjects',
      'process_step_instances', 'process_work_items', 'process_work_item_candidates',
      'process_events'
    )
    and privilege_type <> 'SELECT';
  if direct_mutation_grant_count <> 0 then raise exception 'P2_DIRECT_MUTATION_GRANTS_PRESENT: %', direct_mutation_grant_count; end if;

  if not exists (
    select 1 from pg_constraint
    where conname in ('process_instances_pinned_version_fkey', 'process_employment_subjects_instance_fkey', 'process_employment_subjects_employment_fkey')
  ) then raise exception 'P2_TYPED_SCOPE_CONSTRAINTS_MISSING'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'process_versions_immutable') then raise exception 'P2_IMMUTABLE_TRIGGER_MISSING'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'process_events_append_only') then raise exception 'P2_EVENT_APPEND_TRIGGER_MISSING'; end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'claim_process_work_item') then raise exception 'P3_CLAIM_RPC_MISSING'; end if;

  select employee.tenant_id, employee.hr_group_id, employee.id, employee.auth_user_id
    into actor_tenant, actor_group, actor_employee, actor_user
  from public.employees employee
  join public.user_hr_group_access access
    on access.tenant_id = employee.tenant_id
   and access.hr_group_id = employee.hr_group_id
   and access.user_id = employee.auth_user_id
   and access.is_active
  join public.management_roles role on role.id = access.management_role_id
  where employee.auth_user_id is not null
    and employee.deleted_at is null
    and employee.is_active
    and role.code = 'TENANT_ADMIN'
  limit 1;
  if actor_user is null then raise exception 'P3_TEST_ACTOR_NOT_FOUND'; end if;

  select employee.id into subject_employee
  from public.employees employee
  where employee.tenant_id = actor_tenant
    and employee.hr_group_id = actor_group
    and employee.id <> actor_employee
    and employee.deleted_at is null
  limit 1;
  if subject_employee is null then raise exception 'P3_TEST_SUBJECT_NOT_FOUND'; end if;

  insert into public.process_definitions (id, tenant_id, hr_group_id, scope_type, key, title, status)
  values (definition_id, actor_tenant, actor_group, 'TENANT', 'p3-contract-test', '{"nl":"P3 test","en":"P3 test"}'::jsonb, 'PUBLISHED');
  insert into public.process_versions (id, tenant_id, hr_group_id, process_definition_id, version_number, schema_version, compiler_version, definition_json, definition_hash, published_by_user_id)
  values (version_id, actor_tenant, actor_group, definition_id, 1, 1, 'contract-test', '{"steps":[]}'::jsonb, repeat('a', 64), actor_user);
  insert into public.process_instances (id, tenant_id, hr_group_id, scope_type, process_definition_id, process_version_id, status, initiator_user_id, initiator_employee_id, started_at)
  values (instance_id, actor_tenant, actor_group, 'TENANT', definition_id, version_id, 'RUNNING', actor_user, actor_employee, timezone('utc', now()));
  insert into public.process_employee_subjects (process_instance_id, tenant_id, hr_group_id, employee_id)
  values (instance_id, actor_tenant, actor_group, subject_employee);
  insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_key, status)
  values (step_id, actor_tenant, actor_group, instance_id, version_id, 'contract-step', 'ACTIVE');
  insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, process_version_id, step_instance_id, step_key, participant_key, assignment_mode, status, expected_version)
  values (work_item_id, actor_tenant, actor_group, instance_id, version_id, step_id, 'contract-step', 'contract-assignee', 'ANY_ONE', 'OPEN', 1);
  insert into public.process_work_item_candidates (tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id, resolution_revision, resolution_date, resolution_policy, resolution_source, evidence, is_eligible)
  values (actor_tenant, actor_group, work_item_id, actor_employee, actor_user, 1, current_date, 'STEP_ACTIVATED_AT', 'queue', '{}'::jsonb, true);

  begin
    insert into public.process_employee_subjects (process_instance_id, tenant_id, hr_group_id, employee_id)
    values (gen_random_uuid(), gen_random_uuid(), actor_group, subject_employee);
    raise exception 'P2_CROSS_TENANT_FK_NOT_BLOCKED';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.process_instances (id, tenant_id, hr_group_id, scope_type, administration_id, process_definition_id, process_version_id, status, initiator_user_id)
    values (gen_random_uuid(), actor_tenant, actor_group, 'TENANT', gen_random_uuid(), definition_id, version_id, 'DRAFT', actor_user);
    raise exception 'P2_CROSS_ADMIN_SCOPE_NOT_BLOCKED';
  exception when others then
    if position('process_instances_scope_check' in sqlerrm) = 0
       and position('process_instances_administration_fkey' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    update public.process_versions set definition_hash = repeat('b', 64) where id = version_id;
    raise exception 'P2_IMMUTABLE_UPDATE_NOT_BLOCKED';
  exception when others then
    if position('PROCESS_PUBLISHED_VERSION_IMMUTABLE' in sqlerrm) = 0 then raise; end if;
  end;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000000"}', true);
  execute 'set local role authenticated';
  if (select count(*) from public.process_definitions where id = definition_id) <> 0 then
    raise exception 'P2_RLS_HIDDEN_ROW_VISIBLE';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_user)::text, true);

  select public.claim_process_work_item(work_item_id, 1) into result;
  if result->>'status' <> 'CLAIMED' or (result->>'expectedVersion')::integer <> 2 then raise exception 'P3_CLAIM_RESULT_INVALID: %', result; end if;
  begin
    perform public.claim_process_work_item(work_item_id, 1);
    raise exception 'P3_SECOND_CLAIM_NOT_BLOCKED';
  exception when others then
    if position('ALREADY_CLAIMED' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    perform public.release_process_work_item(work_item_id, 1);
    raise exception 'P3_STALE_RELEASE_NOT_BLOCKED';
  exception when others then
    if position('STALE_ASSIGNMENT' in sqlerrm) = 0 then raise; end if;
  end;
  select public.release_process_work_item(work_item_id, 2) into result;
  if result->>'status' <> 'OPEN' or (result->>'expectedVersion')::integer <> 3 then raise exception 'P3_RELEASE_RESULT_INVALID: %', result; end if;
  select count(*) into event_count from public.process_events where process_instance_id = instance_id;
  if event_count <> 2 then raise exception 'P3_EVENT_COUNT_INVALID: %', event_count; end if;

  begin
    insert into public.process_work_items (tenant_id, hr_group_id, process_instance_id, process_version_id, step_instance_id, step_key, participant_key, assignment_mode)
    values (actor_tenant, actor_group, instance_id, version_id, step_id, 'contract-step', 'unauthorized', 'ANY_ONE');
    raise exception 'P2_DIRECT_INSERT_NOT_BLOCKED';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
