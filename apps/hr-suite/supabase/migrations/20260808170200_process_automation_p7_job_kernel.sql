begin;

create or replace function internal_security.audit_process_automation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_id_value uuid := coalesce(new.tenant_id, old.tenant_id);
  administration_id_value uuid := coalesce(new.administration_id, old.administration_id);
  entity_id_value uuid := coalesce(new.id, old.id);
  correlation_id_value uuid;
  changes_value jsonb;
begin
  if TG_TABLE_NAME = 'workflow_jobs' then
    correlation_id_value := coalesce(new.correlation_id, old.correlation_id);
    changes_value := jsonb_build_object(
      'jobType', coalesce(new.job_type, old.job_type),
      'status', coalesce(new.status, old.status),
      'attempts', coalesce(new.attempts, old.attempts),
      'lastErrorCode', coalesce(new.last_error_code, old.last_error_code),
      'correlationId', correlation_id_value
    );
  elsif TG_TABLE_NAME = 'process_outputs' then
    changes_value := jsonb_build_object(
      'outputKey', coalesce(new.output_key, old.output_key),
      'status', coalesce(new.status, old.status),
      'documentId', coalesce(new.document_id, old.document_id),
      'lastErrorCode', coalesce(new.last_error_code, old.last_error_code)
    );
  else
    return new;
  end if;

  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id,
    action, changes, correlation_id
  ) values (
    tenant_id_value, administration_id_value, TG_TABLE_NAME, entity_id_value,
    auth.uid(), case when TG_OP = 'INSERT' then 'CREATE' else 'UPDATE' end,
    changes_value, correlation_id_value
  );
  return new;
end;
$$;

revoke all on function internal_security.audit_process_automation_change() from public, anon, authenticated;

create or replace function internal_security.claim_workflow_job(requested_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_worker_id is null then
    raise exception 'WORKER_ID_REQUIRED' using errcode = '22023';
  end if;

  update public.workflow_jobs
  set status = 'RETRY'::public.workflow_job_status,
      available_at = timezone('utc', now()),
      locked_at = null,
      locked_by = null,
      last_error_code = coalesce(last_error_code, 'WORKER_TIMEOUT'),
      last_error_at = coalesce(last_error_at, timezone('utc', now()))
  where status = 'RUNNING'::public.workflow_job_status
    and locked_at < timezone('utc', now()) - interval '15 minutes';

  select job.* into job_row
  from public.workflow_jobs job
  where job.status in ('READY'::public.workflow_job_status, 'RETRY'::public.workflow_job_status)
    and job.available_at <= timezone('utc', now())
    and job.attempts < job.max_attempts
    and internal_security.process_scope_has_permission(
      job.tenant_id,
      job.hr_group_id,
      (select instance.scope_type from public.process_instances instance where instance.id = job.process_instance_id),
      job.administration_id,
      'process-operations:write'
    )
  order by job.available_at, job.created_at, job.id
  limit 1
  for update skip locked;

  if job_row.id is null then
    return null;
  end if;

  update public.workflow_jobs
  set status = 'RUNNING'::public.workflow_job_status,
      attempts = attempts + 1,
      locked_at = timezone('utc', now()),
      locked_by = requested_worker_id,
      last_attempt_at = timezone('utc', now()),
      last_error_code = null,
      last_error_at = null
  where id = job_row.id;

  return jsonb_build_object(
    'id', job_row.id,
    'jobType', job_row.job_type,
    'tenantId', job_row.tenant_id,
    'hrGroupId', job_row.hr_group_id,
    'administrationId', job_row.administration_id,
    'processInstanceId', job_row.process_instance_id,
    'stepInstanceId', job_row.step_instance_id,
    'workItemId', job_row.work_item_id,
    'attempts', job_row.attempts + 1,
    'maxAttempts', job_row.max_attempts,
    'payload', job_row.payload,
    'correlationId', job_row.correlation_id
  );
end;
$$;

revoke all on function internal_security.claim_workflow_job(uuid) from public, anon, authenticated;

create or replace function public.claim_workflow_job(requested_worker_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.claim_workflow_job(requested_worker_id);
$$;

revoke all on function public.claim_workflow_job(uuid) from public, anon;
grant execute on function public.claim_workflow_job(uuid) to authenticated;

create or replace function internal_security.finish_workflow_job(
  requested_job_id uuid,
  requested_worker_id uuid,
  requested_outcome text,
  requested_error_code text default null,
  requested_result_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.workflow_jobs%rowtype;
  normalized_error_code text := nullif(regexp_replace(upper(coalesce(requested_error_code, 'WORKFLOW_JOB_FAILED')), '[^A-Z0-9_]+', '_', 'g'), '');
  next_status public.workflow_job_status;
  next_available_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_outcome not in ('SUCCEEDED', 'FAILED') then
    raise exception 'WORKFLOW_JOB_OUTCOME_INVALID' using errcode = '22023';
  end if;

  select job.* into job_row
  from public.workflow_jobs job
  where job.id = requested_job_id
    and job.locked_by = requested_worker_id
    and job.status = 'RUNNING'::public.workflow_job_status
  for update;
  if job_row.id is null then
    raise exception 'WORKFLOW_JOB_NOT_OWNED' using errcode = '42501';
  end if;

  if requested_outcome = 'SUCCEEDED' then
    next_status := 'SUCCEEDED'::public.workflow_job_status;
    next_available_at := timezone('utc', now());
  elsif job_row.attempts >= job_row.max_attempts then
    next_status := 'DEAD_LETTER'::public.workflow_job_status;
    next_available_at := timezone('utc', now());
  else
    next_status := 'RETRY'::public.workflow_job_status;
    next_available_at := timezone('utc', now()) + least(make_interval(secs => (power(2, greatest(job_row.attempts - 1, 0)) * 30)::integer), interval '1 hour');
  end if;

  update public.workflow_jobs
  set status = next_status,
      available_at = next_available_at,
      locked_at = null,
      locked_by = null,
      result_reference_id = case when requested_outcome = 'SUCCEEDED' then requested_result_reference_id else result_reference_id end,
      last_error_code = case when requested_outcome = 'SUCCEEDED' then null else normalized_error_code end,
      last_error_at = case when requested_outcome = 'SUCCEEDED' then null else timezone('utc', now()) end
  where id = job_row.id;

  return jsonb_build_object(
    'id', job_row.id,
    'status', next_status,
    'availableAt', next_available_at,
    'attempts', job_row.attempts
  );
end;
$$;

revoke all on function internal_security.finish_workflow_job(uuid, uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public.finish_workflow_job(
  requested_job_id uuid,
  requested_worker_id uuid,
  requested_outcome text,
  requested_error_code text default null,
  requested_result_reference_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.finish_workflow_job(
    requested_job_id, requested_worker_id, requested_outcome,
    requested_error_code, requested_result_reference_id
  );
$$;

revoke all on function public.finish_workflow_job(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.finish_workflow_job(uuid, uuid, text, text, uuid) to authenticated;

commit;
