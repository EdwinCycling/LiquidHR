begin;

create or replace function internal_security.get_process_automation_operations(requested_process_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  instance_row public.process_instances%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = requested_process_instance_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'process-operations:read'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  return pg_catalog.jsonb_build_object(
    'processInstanceId', instance_row.id,
    'jobs', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', job.id,
        'jobType', job.job_type,
        'status', job.status,
        'attempts', job.attempts,
        'maxAttempts', job.max_attempts,
        'availableAt', job.available_at,
        'lastAttemptAt', job.last_attempt_at,
        'lastErrorCode', job.last_error_code,
        'lastErrorAt', job.last_error_at,
        'canRecover', coalesce(job.status in ('RETRY'::public.workflow_job_status, 'DEAD_LETTER'::public.workflow_job_status)
          and coalesce(internal_security.process_scope_has_permission(
            instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
            instance_row.administration_id, 'process-operations:write'
          ), false)
          and (
            (job.job_type = 'PROCESS_DOCUMENT_OUTPUT'::public.workflow_job_type
              and instance_row.status = 'COMPLETED'::public.process_instance_status)
            or (job.job_type = 'PROCESS_REMINDER'::public.workflow_job_type
              and instance_row.status = 'RUNNING'::public.process_instance_status
              and exists (
                select 1
                from public.process_work_items item
                join public.process_step_instances step
                  on step.tenant_id = item.tenant_id
                 and step.hr_group_id = item.hr_group_id
                 and step.process_instance_id = item.process_instance_id
                 and step.id = item.step_instance_id
                where item.tenant_id = job.tenant_id
                  and item.hr_group_id = job.hr_group_id
                  and item.id = job.work_item_id
                  and item.process_instance_id = instance_row.id
                  and item.step_instance_id = job.step_instance_id
                  and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
                  and step.status = 'ACTIVE'::public.process_step_instance_status
              ))
          ), false)
      ) order by job.created_at desc)
      from public.workflow_jobs job
      where job.tenant_id = instance_row.tenant_id
        and job.hr_group_id = instance_row.hr_group_id
        and job.process_instance_id = instance_row.id
    ), '[]'::jsonb),
    'outputs', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', output.id,
        'outputKey', output.output_key,
        'status', output.status,
        'documentId', output.document_id,
        'lastErrorCode', output.last_error_code,
        'generatedAt', output.generated_at
      ) order by output.created_at desc)
      from public.process_outputs output
      where output.tenant_id = instance_row.tenant_id
        and output.hr_group_id = instance_row.hr_group_id
        and output.process_instance_id = instance_row.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function internal_security.get_process_operations_inbox(
  requested_search text default null,
  requested_filter text default 'ALL',
  requested_page integer default 1,
  requested_page_size integer default 25,
  requested_language text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_filter text := upper(coalesce(requested_filter, 'ALL'));
  normalized_search text := nullif(pg_catalog.btrim(requested_search), '');
  normalized_language text := coalesce(requested_language, 'nl');
  result_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_page is null or requested_page not between 1 and 100000
    or requested_page_size is null or requested_page_size not between 1 and 100
    or (normalized_search is not null and pg_catalog.char_length(normalized_search) > 100)
    or normalized_filter not in ('ALL', 'BLOCKED', 'OVERDUE', 'RETRY', 'FAILED')
    or normalized_language not in ('nl', 'en') then
    raise exception 'PROCESS_OPERATIONS_FILTER_INVALID' using errcode = '22023';
  end if;

  with scoped_instances as materialized (
    select
      instance.id,
      instance.tenant_id,
      instance.hr_group_id,
      instance.scope_type,
      instance.administration_id,
      instance.process_definition_id,
      instance.process_version_id,
      instance.status,
      instance.current_step_key,
      instance.updated_at,
      definition.key as process_key,
      internal_security.process_localized_text(definition.title, normalized_language, definition.key) as process_title,
      version.definition_json
    from public.process_instances instance
    join public.process_definitions definition
      on definition.tenant_id = instance.tenant_id
     and definition.hr_group_id = instance.hr_group_id
     and definition.id = instance.process_definition_id
    join public.process_versions version
      on version.tenant_id = instance.tenant_id
     and version.hr_group_id = instance.hr_group_id
     and version.process_definition_id = instance.process_definition_id
     and version.id = instance.process_version_id
    where internal_security.process_scope_has_permission(
      instance.tenant_id,
      instance.hr_group_id,
      instance.scope_type,
      instance.administration_id,
      'process-operations:read'
    )
  ),
  blocked_rows as (
    select
      'BLOCKED_PROCESS'::text as problem_key,
      null::text as job_type,
      coalesce(blocked_item.id, blocked_step.id, instance.id) as source_id,
      null::uuid as job_id,
      instance.id as process_instance_id,
      blocked_item.id as work_item_id,
      instance.tenant_id,
      instance.hr_group_id,
      instance.process_definition_id,
      instance.process_version_id,
      instance.process_key,
      instance.process_title,
      coalesce(blocked_step.step_key, blocked_item.step_key, instance.current_step_key) as step_key,
      coalesce(blocked_item.status::text, blocked_step.status::text, instance.status::text) as status,
      nullif(pg_catalog.concat_ws(' ', employee.first_name, employee.birth_name), '') as responsible_label,
      blocked_item.deadline_at,
      coalesce(blocked_item.updated_at, blocked_step.updated_at, instance.updated_at) as occurred_at,
      null::timestamptz as last_attempt_at,
      null::timestamptz as next_retry_at,
      null::text as last_error_code,
      false as can_recover,
      instance.definition_json,
      coalesce(blocked_item.created_at, blocked_step.updated_at, instance.updated_at) as created_at
    from scoped_instances instance
    left join lateral (
      select step.id, step.step_key, step.status, step.updated_at
      from public.process_step_instances step
      where step.tenant_id = instance.tenant_id
        and step.hr_group_id = instance.hr_group_id
        and step.process_instance_id = instance.id
        and step.status = 'BLOCKED'::public.process_step_instance_status
      order by step.updated_at desc, step.id
      limit 1
    ) blocked_step on true
    left join lateral (
      select item.id, item.step_instance_id, item.step_key, item.status,
        item.assignee_employee_id, item.claimed_by_user_id, item.deadline_at,
        item.created_at, item.updated_at
      from public.process_work_items item
      where item.tenant_id = instance.tenant_id
        and item.hr_group_id = instance.hr_group_id
        and item.process_instance_id = instance.id
        and item.status = 'BLOCKED'::public.process_work_item_status
        and (blocked_step.id is null or item.step_instance_id = blocked_step.id)
      order by item.updated_at desc, item.id
      limit 1
    ) blocked_item on true
    left join public.employees employee
      on employee.tenant_id = instance.tenant_id
     and employee.hr_group_id = instance.hr_group_id
     and employee.deleted_at is null
     and employee.id = coalesce(
       (select claimed_employee.id
        from public.employees claimed_employee
        where claimed_employee.tenant_id = instance.tenant_id
          and claimed_employee.hr_group_id = instance.hr_group_id
          and claimed_employee.auth_user_id = blocked_item.claimed_by_user_id
          and claimed_employee.deleted_at is null
        limit 1),
       blocked_item.assignee_employee_id
     )
    where instance.status = 'BLOCKED'::public.process_instance_status
      or blocked_step.id is not null
      or blocked_item.id is not null
  ),
  overdue_rows as (
    select
      'OVERDUE_WORK_ITEM'::text as problem_key,
      null::text as job_type,
      item.id as source_id,
      null::uuid as job_id,
      instance.id as process_instance_id,
      item.id as work_item_id,
      instance.tenant_id,
      instance.hr_group_id,
      instance.process_definition_id,
      instance.process_version_id,
      instance.process_key,
      instance.process_title,
      item.step_key,
      item.status::text as status,
      nullif(pg_catalog.concat_ws(' ', employee.first_name, employee.birth_name), '') as responsible_label,
      item.deadline_at,
      item.deadline_at as occurred_at,
      null::timestamptz as last_attempt_at,
      null::timestamptz as next_retry_at,
      null::text as last_error_code,
      false as can_recover,
      instance.definition_json,
      item.created_at
    from scoped_instances instance
    join public.process_work_items item
      on item.tenant_id = instance.tenant_id
     and item.hr_group_id = instance.hr_group_id
     and item.process_instance_id = instance.id
    left join public.employees employee
      on employee.tenant_id = instance.tenant_id
     and employee.hr_group_id = instance.hr_group_id
     and employee.deleted_at is null
     and employee.id = coalesce(
       (select claimed_employee.id
        from public.employees claimed_employee
        where claimed_employee.tenant_id = instance.tenant_id
          and claimed_employee.hr_group_id = instance.hr_group_id
          and claimed_employee.auth_user_id = item.claimed_by_user_id
          and claimed_employee.deleted_at is null
        limit 1),
       item.assignee_employee_id
     )
    where instance.status in ('RUNNING'::public.process_instance_status, 'WAITING'::public.process_instance_status, 'BLOCKED'::public.process_instance_status)
      and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
      and item.deadline_at < pg_catalog.now()
  ),
  job_rows as (
    select
      case job.status
        when 'RETRY'::public.workflow_job_status then 'AUTOMATION_RETRY'::text
        else 'AUTOMATION_FAILED'::text
      end as problem_key,
      job.job_type::text as job_type,
      job.id as source_id,
      job.id as job_id,
      instance.id as process_instance_id,
      item.id as work_item_id,
      instance.tenant_id,
      instance.hr_group_id,
      instance.process_definition_id,
      instance.process_version_id,
      instance.process_key,
      instance.process_title,
      coalesce(item.step_key, step.step_key) as step_key,
      job.status::text as status,
      nullif(pg_catalog.concat_ws(' ', employee.first_name, employee.birth_name), '') as responsible_label,
      item.deadline_at,
      coalesce(job.last_error_at, job.last_attempt_at, job.updated_at) as occurred_at,
      job.last_attempt_at,
      case when job.status = 'RETRY'::public.workflow_job_status then job.available_at else null end as next_retry_at,
      job.last_error_code,
      case
        when job.status not in ('RETRY'::public.workflow_job_status, 'DEAD_LETTER'::public.workflow_job_status)
          or not coalesce(internal_security.process_scope_has_permission(
            instance.tenant_id, instance.hr_group_id, instance.scope_type,
            instance.administration_id, 'process-operations:write'
          ), false) then false
        when job.job_type = 'PROCESS_DOCUMENT_OUTPUT'::public.workflow_job_type then instance.status = 'COMPLETED'::public.process_instance_status
        when job.job_type = 'PROCESS_REMINDER'::public.workflow_job_type then coalesce(instance.status = 'RUNNING'::public.process_instance_status
          and step.status = 'ACTIVE'::public.process_step_instance_status
          and item.process_instance_id = instance.id
          and item.step_instance_id = job.step_instance_id
          and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status), false)
        else false
      end as can_recover,
      instance.definition_json,
      job.created_at
    from scoped_instances instance
    join public.workflow_jobs job
      on job.tenant_id = instance.tenant_id
     and job.hr_group_id = instance.hr_group_id
     and job.process_instance_id = instance.id
    left join public.process_work_items item
      on item.tenant_id = job.tenant_id
     and item.hr_group_id = job.hr_group_id
     and item.id = job.work_item_id
    left join public.process_step_instances step
      on step.tenant_id = job.tenant_id
     and step.hr_group_id = job.hr_group_id
     and step.id = job.step_instance_id
    left join public.employees employee
      on employee.tenant_id = instance.tenant_id
     and employee.hr_group_id = instance.hr_group_id
     and employee.deleted_at is null
     and employee.id = coalesce(
       (select claimed_employee.id
        from public.employees claimed_employee
        where claimed_employee.tenant_id = instance.tenant_id
          and claimed_employee.hr_group_id = instance.hr_group_id
          and claimed_employee.auth_user_id = item.claimed_by_user_id
          and claimed_employee.deleted_at is null
        limit 1),
       item.assignee_employee_id
     )
    where job.status in ('RETRY'::public.workflow_job_status, 'DEAD_LETTER'::public.workflow_job_status)
  ),
  raw_rows as (
    select * from blocked_rows
    union all
    select * from overdue_rows
    union all
    select * from job_rows
  ),
  formatted_rows as (
    select
      issue.problem_key,
      issue.job_type,
      issue.source_id,
      issue.job_id,
      issue.process_instance_id,
      issue.work_item_id,
      issue.process_title,
      case when step_definition.value is null then null
        else internal_security.process_localized_text(step_definition.value -> 'title', normalized_language, issue.step_key)
      end as step_title,
      issue.status,
      issue.responsible_label,
      issue.deadline_at,
      issue.occurred_at,
      issue.last_attempt_at,
      issue.next_retry_at,
      issue.last_error_code,
      issue.can_recover,
      issue.created_at
    from raw_rows issue
    left join lateral pg_catalog.jsonb_array_elements(
      coalesce(internal_security.process_definition_content(issue.definition_json) -> 'steps', '[]'::jsonb)
    ) step_definition(value)
      on step_definition.value ->> 'key' = issue.step_key
  ),
  summary as (
    select
      count(*) filter (where issue.problem_key = 'BLOCKED_PROCESS')::integer as blocked_processes,
      count(*) filter (where issue.problem_key = 'OVERDUE_WORK_ITEM')::integer as overdue_tasks,
      count(*) filter (where issue.problem_key = 'AUTOMATION_FAILED')::integer as failed_automations,
      count(*) filter (where issue.problem_key = 'AUTOMATION_RETRY')::integer as retrying_automations
    from formatted_rows issue
  ),
  filtered as (
    select issue.*,
      case issue.problem_key
        when 'AUTOMATION_FAILED' then 0
        when 'BLOCKED_PROCESS' then 1
        when 'OVERDUE_WORK_ITEM' then 2
        else 3
      end as priority
    from formatted_rows issue
    where (
      normalized_filter = 'ALL'
      or (normalized_filter = 'BLOCKED' and issue.problem_key = 'BLOCKED_PROCESS')
      or (normalized_filter = 'OVERDUE' and issue.problem_key = 'OVERDUE_WORK_ITEM')
      or (normalized_filter = 'RETRY' and issue.problem_key = 'AUTOMATION_RETRY')
      or (normalized_filter = 'FAILED' and issue.problem_key = 'AUTOMATION_FAILED')
    )
      and (normalized_search is null or pg_catalog.strpos(
        pg_catalog.lower(issue.process_title || ' ' || coalesce(issue.step_title, '') || ' ' || issue.problem_key),
        pg_catalog.lower(normalized_search)
      ) > 0)
  ),
  page_count as (
    select count(*)::integer as total from filtered
  ),
  page_selection as (
    select
      total,
      case when total = 0 then 1 else least(requested_page, greatest(1, pg_catalog.ceil(total::numeric / requested_page_size)::integer)) end as page
    from page_count
  ),
  ranked_filtered as (
    select issue.*,
      pg_catalog.row_number() over (
        order by issue.priority, issue.deadline_at asc nulls last, issue.occurred_at desc, issue.created_at desc, issue.source_id
      ) as row_position
    from filtered issue
  ),
  page_rows as (
    select issue.*
    from ranked_filtered issue
    cross join page_selection
    where issue.row_position > (page_selection.page - 1) * requested_page_size
      and issue.row_position <= page_selection.page * requested_page_size
  )
  select pg_catalog.jsonb_build_object(
    'summary', pg_catalog.jsonb_build_object(
      'blockedProcesses', summary.blocked_processes,
      'overdueTasks', summary.overdue_tasks,
      'failedAutomations', summary.failed_automations,
      'retryingAutomations', summary.retrying_automations
    ),
    'page', page_selection.page,
    'pageSize', requested_page_size,
    'total', page_selection.total,
    'totalPages', case when page_selection.total = 0 then 0 else pg_catalog.ceil(page_selection.total::numeric / requested_page_size)::integer end,
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'problemKey', issue.problem_key,
        'jobType', issue.job_type,
        'sourceId', issue.source_id,
        'jobId', issue.job_id,
        'processInstanceId', issue.process_instance_id,
        'workItemId', issue.work_item_id,
        'processTitle', issue.process_title,
        'stepTitle', issue.step_title,
        'status', issue.status,
        'responsibleLabel', issue.responsible_label,
        'deadlineAt', issue.deadline_at,
        'occurredAt', issue.occurred_at,
        'lastAttemptAt', issue.last_attempt_at,
        'nextRetryAt', issue.next_retry_at,
        'lastErrorCode', issue.last_error_code,
        'canRecover', issue.can_recover
      ) order by issue.priority, issue.deadline_at asc nulls last, issue.occurred_at desc, issue.created_at desc, issue.source_id)
      from page_rows issue
    ), '[]'::jsonb)
  ) into result_value
  from summary
  cross join page_selection;

  return result_value;
end;
$$;

revoke all on function internal_security.get_process_operations_inbox(text, text, integer, integer, text) from public, anon, authenticated;

create or replace function public.get_process_operations_inbox(
  requested_search text default null,
  requested_filter text default 'ALL',
  requested_page integer default 1,
  requested_page_size integer default 25,
  requested_language text default 'nl'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select internal_security.get_process_operations_inbox(
    requested_search,
    requested_filter,
    requested_page,
    requested_page_size,
    requested_language
  );
$$;

revoke all on function public.get_process_operations_inbox(text, text, integer, integer, text) from public, anon;
grant execute on function public.get_process_operations_inbox(text, text, integer, integer, text) to authenticated;

commit;
