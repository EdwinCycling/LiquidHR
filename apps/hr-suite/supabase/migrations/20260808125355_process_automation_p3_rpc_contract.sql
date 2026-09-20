begin;

create or replace function internal_security.release_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  actor_employee_id uuid;
  resulting_version bigint;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id
  from public.employees employee
  where employee.auth_user_id = auth.uid()
    and employee.deleted_at is null
  order by employee.created_at, employee.id
  limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;

  select instance.* into instance_row
  from public.process_instances instance
  join public.process_work_items item
    on item.tenant_id = instance.tenant_id
   and item.hr_group_id = instance.hr_group_id
   and item.process_instance_id = instance.id
   and item.id = requested_work_item_id
  for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;

  select item.* into item_row
  from public.process_work_items item
  where item.tenant_id = instance_row.tenant_id
    and item.hr_group_id = instance_row.hr_group_id
    and item.id = requested_work_item_id
  for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status <> 'CLAIMED' then raise exception 'WORK_ITEM_NOT_CLAIMED' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if item_row.claimed_by_user_id <> auth.uid()
     and not internal_security.process_scope_has_permission(
       instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
       instance_row.administration_id, 'process-task:reassign'
     ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'OPEN',
      assignee_employee_id = case when assignment_mode = 'EXACTLY_ONE' then assignee_employee_id else null end,
      claimed_by_user_id = null,
      claimed_at = null,
      expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'WORK_ITEM_RELEASED',
    jsonb_build_object('expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version),
    auth.uid(), actor_employee_id
  );
  return jsonb_build_object(
    'workItemId', item_row.id,
    'status', 'OPEN',
    'assigneeEmployeeId', case when item_row.assignment_mode = 'EXACTLY_ONE' then item_row.assignee_employee_id else null end,
    'expectedVersion', resulting_version,
    'eventId', event_id
  );
end;
$$;

commit;
