-- Voer dit script uit met Supabase SQL Editor of supabase_execute_sql.
-- Dit contractscript leest alleen catalogus- en deterministische functie-uitkomsten.

do $$
declare
  protected_table_count integer;
  policy_count integer;
  direct_grant_count integer;
  secure_function_count integer;
  public_wrapper_count integer;
  deadline_result timestamptz;
  constraint_definition text;
  function_definition text;
begin
  select count(*) into protected_table_count
  from pg_class relation
  join pg_namespace schema on schema.oid = relation.relnamespace
  where schema.nspname = 'public'
    and relation.relname in ('workflow_jobs', 'process_outputs', 'process_reminder_deliveries')
    and relation.relrowsecurity;
  if protected_table_count <> 3 then
    raise exception 'P7_RLS_TABLE_COUNT_INVALID: %', protected_table_count;
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('workflow_jobs', 'process_outputs', 'process_reminder_deliveries');
  if policy_count <> 3 then
    raise exception 'P7_POLICY_COUNT_INVALID: %', policy_count;
  end if;

  select count(*) into direct_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name in ('workflow_jobs', 'process_outputs', 'process_reminder_deliveries');
  if direct_grant_count <> 0 then
    raise exception 'P7_DIRECT_TABLE_GRANTS_PRESENT: %', direct_grant_count;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workflow_jobs'::regclass
      and conname = 'workflow_jobs_payload_check'
  ) then
    raise exception 'P7_SAFE_PAYLOAD_CONSTRAINT_MISSING';
  end if;
  select pg_get_constraintdef(oid) into constraint_definition
  from pg_constraint
  where conrelid = 'public.workflow_jobs'::regclass
    and conname = 'workflow_jobs_payload_check';
  if constraint_definition is null
     or constraint_definition not ilike '%current%'
     or constraint_definition not ilike '%new%'
     or constraint_definition not ilike '%bsn%'
     or constraint_definition not ilike '%salary%'
     or constraint_definition not ilike '%payload ?|%' then
    raise exception 'P7_SAFE_PAYLOAD_CONSTRAINT_UNEXPECTED';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workflow_jobs'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%idempotency_key%'
  ) then
    raise exception 'P7_JOB_IDEMPOTENCY_CONSTRAINT_MISSING';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.process_reminder_deliveries'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%step_instance_id%'
  ) then
    raise exception 'P7_REMINDER_IDEMPOTENCY_CONSTRAINT_MISSING';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.process_outputs'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%process_instance_id%'
  ) then
    raise exception 'P7_OUTPUT_IDEMPOTENCY_CONSTRAINT_MISSING';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'audit_workflow_jobs')
     or not exists (select 1 from pg_trigger where tgname = 'audit_process_outputs') then
    raise exception 'P7_AUDIT_TRIGGERS_MISSING';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'process_step_deadline_before')
     or not exists (select 1 from pg_trigger where tgname = 'process_work_item_deadline_before') then
    raise exception 'P7_DEADLINE_TRIGGERS_MISSING';
  end if;

  select count(*) into secure_function_count
  from pg_proc function_row
  join pg_namespace schema on schema.oid = function_row.pronamespace
  where schema.nspname = 'internal_security'
    and function_row.proname in (
      'claim_workflow_job', 'finish_workflow_job', 'create_process_deadline_reminder',
      'begin_process_output', 'attach_process_output_document', 'complete_process_output',
      'requeue_workflow_job', 'get_process_output_projection', 'get_process_automation_operations',
      'process_output_source',
      'get_process_work_projection', 'get_process_work_item_detail',
      'get_process_work_projection_with_administration', 'get_process_output_download_context'
    )
    and function_row.prosecdef;
  if secure_function_count <> 14 then
    raise exception 'P6_P7_INTERNAL_FUNCTION_SECURITY_INVALID: %', secure_function_count;
  end if;

  select count(*) into public_wrapper_count
  from pg_proc function_row
  join pg_namespace schema on schema.oid = function_row.pronamespace
  where schema.nspname = 'public'
    and function_row.proname in (
      'claim_workflow_job', 'finish_workflow_job', 'create_process_deadline_reminder',
      'begin_process_output', 'attach_process_output_document', 'complete_process_output',
      'requeue_workflow_job', 'get_process_output_projection', 'get_process_automation_operations',
      'get_process_work_projection', 'get_process_work_item_detail',
      'get_process_work_projection_with_administration', 'get_process_output_download_context',
      'add_process_output_document_audiences'
    )
    and has_function_privilege('authenticated', function_row.oid, 'EXECUTE')
    and not has_function_privilege('anon', function_row.oid, 'EXECUTE')
    and not function_row.prosecdef;
  if public_wrapper_count <> 14 then
    raise exception 'P6_P7_PUBLIC_WRAPPER_GRANTS_INVALID: %', public_wrapper_count;
  end if;

  select internal_security.process_deadline_at(
    '2026-08-07 10:00:00+00'::timestamptz,
    '{"duration":{"amount":2,"unit":"DAYS"},"businessDays":true}'::jsonb
  ) into deadline_result;
  if deadline_result <> '2026-08-11 10:00:00+00'::timestamptz then
    raise exception 'P7_BUSINESS_DAY_DEADLINE_INVALID: %', deadline_result;
  end if;
  if internal_security.process_deadline_at(
    '2026-08-07 10:00:00+00'::timestamptz,
    '{"duration":{"amount":0,"unit":"DAYS"}}'::jsonb
  ) is not null then
    raise exception 'P7_INVALID_DEADLINE_ACCEPTED';
  end if;

  select pg_get_functiondef(function_row.oid) into function_definition
  from pg_proc function_row
  join pg_namespace schema on schema.oid = function_row.pronamespace
  where schema.nspname = 'internal_security'
    and function_row.proname = 'audit_process_automation_change'
  limit 1;
  if function_definition is null
     or function_definition like '%current_values%'
     or function_definition like '%new_values%' then
    raise exception 'P7_AUDIT_SENSITIVE_PAYLOAD_PRESENT';
  end if;
end;
$$;
