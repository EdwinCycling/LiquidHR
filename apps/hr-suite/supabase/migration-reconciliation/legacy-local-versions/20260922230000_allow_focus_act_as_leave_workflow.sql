begin;

-- The Focus act-as route is still employee-scoped at the application boundary,
-- but the authenticated database actor is the HR administrator. Keep normal
-- ESS requests self-scoped while allowing an explicitly authorized MSS actor
-- to start the same workflow for an employee in the active HR group.
create or replace function internal_security.start_leave_request_workflow_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_administration_id uuid,
  requested_employee_id uuid,
  requested_employment_id uuid,
  requested_mode public.leave_request_mode,
  requested_priority_rule_id uuid,
  requested_leave_type_id uuid,
  requested_start_date date,
  requested_end_date date,
  requested_time_mode public.leave_request_time_mode,
  requested_specific_start time,
  requested_specific_end time,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_employee_id uuid;
  employment_row public.employments%rowtype;
  definition_row public.process_definitions%rowtype;
  existing_request public.leave_requests%rowtype;
  request_id uuid;
  instance_id uuid;
  request_item public.process_work_items%rowtype;
  active_item public.process_work_items%rowtype;
  step_expected_version bigint;
  type_ids uuid[];
  total_minutes integer;
  start_result jsonb;
  action_result jsonb;
  event_id uuid;
  correlation_id uuid := coalesce(requested_correlation_id, extensions.gen_random_uuid());
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_idempotency_key is null
     or length(btrim(requested_idempotency_key)) < 8
     or length(btrim(requested_idempotency_key)) > 160 then
    raise exception 'LEAVE_IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;

  if internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'self:leave:request'
  ) then
    actor_employee_id := internal_security.current_employee_id(
      requested_tenant_id, requested_hr_group_id
    );
    if (actor_employee_id is null or actor_employee_id <> requested_employee_id)
       and not internal_security.current_user_has_hr_group_permission(
         requested_tenant_id, requested_hr_group_id, 'leave:request'
       ) then
      raise exception 'LEAVE_SELF_SCOPE_REQUIRED' using errcode = '42501';
    end if;
  elsif not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'leave:request'
  ) then
    raise exception 'LEAVE_REQUEST_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  select request.* into existing_request
  from public.leave_requests request
  where request.tenant_id = requested_tenant_id
    and request.hr_group_id = requested_hr_group_id
    and request.idempotency_key = btrim(requested_idempotency_key)
  for update;
  if existing_request.id is not null then
    if existing_request.actor_user_id <> actor_id
       or existing_request.employee_id <> requested_employee_id
       or existing_request.employment_id <> requested_employment_id
       or existing_request.request_mode <> requested_mode
       or existing_request.start_date <> requested_start_date
       or existing_request.end_date <> requested_end_date
       or existing_request.time_mode <> requested_time_mode
       or existing_request.leave_type_id is distinct from requested_leave_type_id
       or existing_request.priority_rule_id is distinct from requested_priority_rule_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    select link.process_instance_id into instance_id
    from public.process_leave_subjects link
    where link.tenant_id = existing_request.tenant_id
      and link.hr_group_id = existing_request.hr_group_id
      and link.leave_request_id = existing_request.id;
    if instance_id is null then
      raise exception 'LEAVE_WORKFLOW_LINK_MISSING' using errcode = 'P0001';
    end if;
    select event.id into event_id
    from public.process_events event
    where event.tenant_id = existing_request.tenant_id
      and event.hr_group_id = existing_request.hr_group_id
      and event.process_instance_id = instance_id
      and event.idempotency_key = btrim(requested_idempotency_key)
    order by event.sequence_number
    limit 1;
    select item.* into active_item
    from public.process_work_items item
    where item.tenant_id = existing_request.tenant_id
      and item.hr_group_id = existing_request.hr_group_id
      and item.process_instance_id = instance_id
      and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
    order by item.created_at desc, item.id
    limit 1;
    return internal_security.process_runtime_result(
      existing_request.tenant_id,
      existing_request.hr_group_id,
      instance_id,
      event_id
    ) || jsonb_build_object(
      'requestId', existing_request.id,
      'workItemId', active_item.id,
      'businessStatus', case existing_request.status
        when 'PENDING'::public.leave_request_status then 'WAITING'
        when 'CHANGES_REQUESTED'::public.leave_request_status then 'CHANGES_REQUESTED'
        when 'APPROVED'::public.leave_request_status then 'COMPLETED'
        when 'REJECTED'::public.leave_request_status then 'REJECTED'
        when 'CANCELLED'::public.leave_request_status then 'CANCELLED'
      end,
      'existing', true
    );
  end if;

  select employment.* into employment_row
  from public.employments employment
  where employment.tenant_id = requested_tenant_id
    and employment.hr_group_id = requested_hr_group_id
    and employment.employee_id = requested_employee_id
    and employment.id = requested_employment_id
    and employment.administration_id = requested_administration_id
    and employment.record_status = 'CONFIRMED'
    and employment.deleted_at is null
  for update;
  if employment_row.id is null then
    raise exception 'LEAVE_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if requested_end_date < requested_start_date
     or requested_start_date < employment_row.starts_on
     or (employment_row.ends_on is not null and requested_end_date > employment_row.ends_on) then
    raise exception 'LEAVE_EMPLOYMENT_DATE_INVALID' using errcode = '22023';
  end if;

  total_minutes := internal_security.calculate_leave_workflow_minutes(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    requested_end_date,
    requested_time_mode,
    requested_specific_start,
    requested_specific_end
  );
  type_ids := internal_security.leave_workflow_type_ids(
    requested_tenant_id,
    requested_hr_group_id,
    requested_employment_id,
    requested_mode,
    requested_priority_rule_id,
    requested_leave_type_id,
    requested_start_date,
    requested_end_date
  );

  select definition.* into definition_row
  from public.process_definitions definition
  where definition.tenant_id = requested_tenant_id
    and definition.hr_group_id = requested_hr_group_id
    and definition.status = 'PUBLISHED'::public.process_definition_status
    and definition.business_type = 'LEAVE'
    and definition.scope_type = 'ADMINISTRATION'::public.access_scope_type
    and definition.administration_id = requested_administration_id
  order by
    case when definition.scope_type = 'ADMINISTRATION'::public.access_scope_type then 0 else 1 end,
    definition.updated_at desc,
    definition.id
  limit 1;
  if definition_row.id is null then
    raise exception 'LEAVE_WORKFLOW_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  insert into public.leave_requests (
    tenant_id,
    hr_group_id,
    administration_id,
    employee_id,
    employment_id,
    request_mode,
    priority_rule_id,
    leave_type_id,
    start_date,
    end_date,
    time_mode,
    specific_start,
    specific_end,
    requested_minutes,
    status,
    source,
    idempotency_key,
    actor_user_id
  )
  values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_administration_id,
    requested_employee_id,
    requested_employment_id,
    requested_mode,
    requested_priority_rule_id,
    requested_leave_type_id,
    requested_start_date,
    requested_end_date,
    requested_time_mode,
    requested_specific_start,
    requested_specific_end,
    total_minutes,
    'PENDING'::public.leave_request_status,
    'ESS_PROCESS_AUTOMATION',
    btrim(requested_idempotency_key),
    actor_id
  )
  returning id into request_id;

  select internal_security.start_process(
    definition_row.id,
    requested_employee_id,
    requested_employment_id,
    requested_start_date,
    btrim(requested_idempotency_key),
    correlation_id
  ) into start_result;
  instance_id := (start_result ->> 'processInstanceId')::uuid;

  insert into public.process_leave_subjects (
    process_instance_id,
    tenant_id,
    hr_group_id,
    administration_id,
    leave_request_id
  )
  values (
    instance_id,
    requested_tenant_id,
    requested_hr_group_id,
    requested_administration_id,
    request_id
  );

  select item.* into request_item
  from public.process_work_items item
  where item.tenant_id = requested_tenant_id
    and item.hr_group_id = requested_hr_group_id
    and item.process_instance_id = instance_id
    and item.step_key = 'request'
    and item.status = 'OPEN'::public.process_work_item_status
  order by item.created_at desc, item.id
  limit 1;
  if request_item.id is null then
    raise exception 'LEAVE_WORKFLOW_REQUEST_STEP_MISSING' using errcode = 'P0001';
  end if;
  select step.expected_version into step_expected_version
  from public.process_step_instances step
  where step.id = request_item.step_instance_id;

  select internal_security.perform_process_work_item_action(
    request_item.id,
    'ACKNOWLEDGE',
    request_item.expected_version,
    step_expected_version,
    btrim(requested_idempotency_key) || ':submitted',
    correlation_id
  ) into action_result;

  select item.* into active_item
  from public.process_work_items item
  where item.tenant_id = requested_tenant_id
    and item.hr_group_id = requested_hr_group_id
    and item.process_instance_id = instance_id
    and item.status in ('OPEN'::public.process_work_item_status, 'CLAIMED'::public.process_work_item_status)
  order by item.created_at desc, item.id
  limit 1;
  return action_result || jsonb_build_object(
    'requestId', request_id,
    'workItemId', active_item.id,
    'businessStatus', 'WAITING',
    'existing', false,
    'requestedMinutes', total_minutes,
    'leaveTypeIds', to_jsonb(type_ids)
  );
end;
$$;

commit;
