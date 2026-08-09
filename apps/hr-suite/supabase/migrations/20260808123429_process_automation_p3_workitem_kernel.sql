begin;

create or replace function internal_security.append_process_event(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid,
  requested_work_item_id uuid,
  requested_event_type text,
  requested_payload jsonb,
  requested_actor_user_id uuid,
  requested_actor_employee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_sequence bigint;
  event_id uuid;
begin
  perform 1
  from public.process_instances instance
  where instance.tenant_id = requested_tenant_id
    and instance.hr_group_id = requested_hr_group_id
    and instance.id = requested_process_instance_id
  for update;
  if not found then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;

  select coalesce(max(event.sequence_number), 0) + 1
    into next_sequence
  from public.process_events event
  where event.tenant_id = requested_tenant_id
    and event.hr_group_id = requested_hr_group_id
    and event.process_instance_id = requested_process_instance_id;

  insert into public.process_events (
    tenant_id, hr_group_id, process_instance_id, work_item_id,
    sequence_number, event_type, actor_user_id, actor_employee_id, payload
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_process_instance_id, requested_work_item_id,
    next_sequence, requested_event_type, requested_actor_user_id, requested_actor_employee_id,
    coalesce(requested_payload, '{}'::jsonb)
  ) returning id into event_id;

  return event_id;
end;
$$;

revoke all on function internal_security.append_process_event(uuid, uuid, uuid, uuid, text, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function internal_security.append_process_event(uuid, uuid, uuid, uuid, text, jsonb, uuid, uuid)
  to authenticated;

create or replace function internal_security.process_instance_actor_is_subject(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_process_instance_id uuid,
  requested_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.process_employee_subjects subject
    where subject.tenant_id = requested_tenant_id
      and subject.hr_group_id = requested_hr_group_id
      and subject.process_instance_id = requested_process_instance_id
      and subject.employee_id = requested_employee_id
  )
  or exists (
    select 1
    from public.process_employment_subjects subject
    join public.employments employment
      on employment.tenant_id = subject.tenant_id
     and employment.hr_group_id = subject.hr_group_id
     and employment.administration_id = subject.administration_id
     and employment.id = subject.employment_id
    where subject.tenant_id = requested_tenant_id
      and subject.hr_group_id = requested_hr_group_id
      and subject.process_instance_id = requested_process_instance_id
      and employment.employee_id = requested_employee_id
  );
$$;

revoke all on function internal_security.process_instance_actor_is_subject(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function internal_security.process_instance_actor_is_subject(uuid, uuid, uuid, uuid)
  to authenticated;

create or replace function internal_security.claim_process_work_item(
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
  candidate_ok boolean;
  actor_is_subject boolean;
  event_id uuid;
  resulting_version bigint;
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
  if item_row.status = 'CLAIMED' then raise exception 'ALREADY_CLAIMED' using errcode = 'P0001'; end if;
  if item_row.status <> 'OPEN' then raise exception 'WORK_ITEM_NOT_OPEN' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;

  if not internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'process-task:act'
  ) then
    select exists (
      select 1
      from public.process_work_item_candidates candidate
      where candidate.tenant_id = item_row.tenant_id
        and candidate.hr_group_id = item_row.hr_group_id
        and candidate.work_item_id = item_row.id
        and candidate.employee_id = actor_employee_id
        and candidate.candidate_user_id = auth.uid()
        and candidate.is_eligible
        and candidate.resolution_revision = (
          select max(latest.resolution_revision)
          from public.process_work_item_candidates latest
          where latest.tenant_id = item_row.tenant_id
            and latest.hr_group_id = item_row.hr_group_id
            and latest.work_item_id = item_row.id
        )
    ) into candidate_ok;
    if not candidate_ok or not internal_security.process_scope_has_permission(
      instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
      instance_row.administration_id, 'self:process-task:act'
    ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  end if;

  actor_is_subject := internal_security.process_instance_actor_is_subject(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, actor_employee_id
  );
  if actor_is_subject and not item_row.allow_self_assignment then
    raise exception 'SELF_ASSIGNMENT_FORBIDDEN' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = actor_employee_id
      and candidate.candidate_user_id = auth.uid()
      and candidate.is_eligible
      and candidate.resolution_revision = (
        select max(latest.resolution_revision)
        from public.process_work_item_candidates latest
        where latest.tenant_id = item_row.tenant_id
          and latest.hr_group_id = item_row.hr_group_id
          and latest.work_item_id = item_row.id
      )
  ) into candidate_ok;
  if not candidate_ok then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'CLAIMED',
      assignee_employee_id = actor_employee_id,
      claimed_by_user_id = auth.uid(),
      claimed_at = timezone('utc', now()),
      expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;

  event_id := internal_security.append_process_event(
    item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id,
    'WORK_ITEM_CLAIMED',
    jsonb_build_object('expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version, 'assignmentMode', item_row.assignment_mode::text),
    auth.uid(), actor_employee_id
  );

  return jsonb_build_object(
    'workItemId', item_row.id,
    'status', 'CLAIMED',
    'assigneeEmployeeId', actor_employee_id,
    'expectedVersion', resulting_version,
    'eventId', event_id
  );
end;
$$;

revoke all on function internal_security.claim_process_work_item(uuid, bigint) from public, anon, authenticated;
grant execute on function internal_security.claim_process_work_item(uuid, bigint) to authenticated;

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
  select employee.id into actor_employee_id from public.employees employee where employee.auth_user_id = auth.uid() and employee.deleted_at is null order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance join public.process_work_items item on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id and item.process_instance_id = instance.id and item.id = requested_work_item_id for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select item.* into item_row from public.process_work_items item where item.tenant_id = instance_row.tenant_id and item.hr_group_id = instance_row.hr_group_id and item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status <> 'CLAIMED' then raise exception 'WORK_ITEM_NOT_CLAIMED' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if item_row.claimed_by_user_id <> auth.uid() and not internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-task:reassign') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'OPEN',
      assignee_employee_id = case when assignment_mode = 'EXACTLY_ONE' then assignee_employee_id else null end,
      claimed_by_user_id = null,
      claimed_at = null,
      expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id, 'WORK_ITEM_RELEASED', jsonb_build_object('expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version), auth.uid(), actor_employee_id);
  return jsonb_build_object('workItemId', item_row.id, 'status', 'OPEN', 'expectedVersion', resulting_version, 'eventId', event_id);
end;
$$;

revoke all on function internal_security.release_process_work_item(uuid, bigint) from public, anon, authenticated;
grant execute on function internal_security.release_process_work_item(uuid, bigint) to authenticated;

create or replace function internal_security.reassign_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  target_employee public.employees%rowtype;
  actor_employee_id uuid;
  candidate_ok boolean;
  resulting_version bigint;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id from public.employees employee where employee.auth_user_id = auth.uid() and employee.deleted_at is null order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance join public.process_work_items item on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id and item.process_instance_id = instance.id and item.id = requested_work_item_id for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select item.* into item_row from public.process_work_items item where item.tenant_id = instance_row.tenant_id and item.hr_group_id = instance_row.hr_group_id and item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status in ('COMPLETED', 'CANCELLED', 'EXPIRED') then raise exception 'WORK_ITEM_NOT_REASSIGNABLE' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if not internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-task:reassign') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select employee.* into target_employee
  from public.employees employee
  where employee.tenant_id = item_row.tenant_id
    and employee.hr_group_id = item_row.hr_group_id
    and employee.id = requested_employee_id
    and employee.is_active
    and not employee.is_archived
    and employee.deleted_at is null
    and employee.auth_user_id is not null;
  if target_employee.id is null then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;
  if instance_row.scope_type = 'ADMINISTRATION'
     and not exists (
       select 1 from public.employments employment
       where employment.tenant_id = item_row.tenant_id
         and employment.hr_group_id = item_row.hr_group_id
         and employment.administration_id = instance_row.administration_id
         and employment.employee_id = target_employee.id
         and employment.deleted_at is null
     ) then raise exception 'CROSS_SCOPE_CANDIDATE' using errcode = '42501'; end if;
  if internal_security.process_instance_actor_is_subject(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, target_employee.id) and not item_row.allow_self_assignment then raise exception 'SELF_ASSIGNMENT_FORBIDDEN' using errcode = '42501'; end if;

  select exists (
    select 1 from public.process_work_item_candidates candidate
    where candidate.tenant_id = item_row.tenant_id
      and candidate.hr_group_id = item_row.hr_group_id
      and candidate.work_item_id = item_row.id
      and candidate.employee_id = target_employee.id
      and candidate.candidate_user_id = target_employee.auth_user_id
      and candidate.is_eligible
      and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id)
  ) into candidate_ok;
  if not candidate_ok then raise exception 'INELIGIBLE_ASSIGNEE' using errcode = '42501'; end if;

  update public.process_work_items
  set status = 'OPEN', assignee_employee_id = target_employee.id, claimed_by_user_id = null, claimed_at = null, blocked_code = null, expected_version = expected_version + 1
  where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id, 'WORK_ITEM_REASSIGNED', jsonb_build_object('targetEmployeeId', target_employee.id, 'expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version), auth.uid(), actor_employee_id);
  return jsonb_build_object('workItemId', item_row.id, 'status', 'OPEN', 'assigneeEmployeeId', target_employee.id, 'expectedVersion', resulting_version, 'eventId', event_id);
end;
$$;

revoke all on function internal_security.reassign_process_work_item(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function internal_security.reassign_process_work_item(uuid, bigint, uuid) to authenticated;

create or replace function internal_security.re_resolve_process_work_item(
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
  eligible_count integer;
  resulting_version bigint;
  resulting_assignee uuid;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select employee.id into actor_employee_id from public.employees employee where employee.auth_user_id = auth.uid() and employee.deleted_at is null order by employee.created_at, employee.id limit 1;
  if actor_employee_id is null then raise exception 'ACTOR_EMPLOYEE_NOT_FOUND' using errcode = '42501'; end if;
  select instance.* into instance_row from public.process_instances instance join public.process_work_items item on item.tenant_id = instance.tenant_id and item.hr_group_id = instance.hr_group_id and item.process_instance_id = instance.id and item.id = requested_work_item_id for update of instance;
  if instance_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select item.* into item_row from public.process_work_items item where item.tenant_id = instance_row.tenant_id and item.hr_group_id = instance_row.hr_group_id and item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item_row.status <> 'BLOCKED' then raise exception 'WORK_ITEM_NOT_BLOCKED' using errcode = 'P0001'; end if;
  if item_row.expected_version <> requested_expected_version then raise exception 'STALE_ASSIGNMENT' using errcode = 'P0001'; end if;
  if not (
    internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-operations:write')
    or internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'process-task:reassign')
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select count(*) into eligible_count
  from public.process_work_item_candidates candidate
  where candidate.tenant_id = item_row.tenant_id
    and candidate.hr_group_id = item_row.hr_group_id
    and candidate.work_item_id = item_row.id
    and candidate.is_eligible
    and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id);
  if eligible_count = 0 then raise exception 'NO_ASSIGNEE' using errcode = 'P0001'; end if;
  if item_row.assignment_mode = 'EXACTLY_ONE' and eligible_count <> 1 then raise exception 'AMBIGUOUS_ASSIGNEE' using errcode = 'P0001'; end if;

  resulting_assignee := case when item_row.assignment_mode = 'EXACTLY_ONE' then (select candidate.employee_id from public.process_work_item_candidates candidate where candidate.tenant_id = item_row.tenant_id and candidate.hr_group_id = item_row.hr_group_id and candidate.work_item_id = item_row.id and candidate.is_eligible and candidate.resolution_revision = (select max(latest.resolution_revision) from public.process_work_item_candidates latest where latest.tenant_id = item_row.tenant_id and latest.hr_group_id = item_row.hr_group_id and latest.work_item_id = item_row.id) limit 1) else null end;
  update public.process_work_items set status = 'OPEN', assignee_employee_id = resulting_assignee, claimed_by_user_id = null, claimed_at = null, blocked_code = null, expected_version = expected_version + 1 where id = item_row.id;
  resulting_version := item_row.expected_version + 1;
  event_id := internal_security.append_process_event(item_row.tenant_id, item_row.hr_group_id, item_row.process_instance_id, item_row.id, 'WORK_ITEM_RE_RESOLVED', jsonb_build_object('eligibleCandidateCount', eligible_count, 'expectedVersion', item_row.expected_version, 'resultingVersion', resulting_version), auth.uid(), actor_employee_id);
  return jsonb_build_object('workItemId', item_row.id, 'status', 'OPEN', 'assigneeEmployeeId', resulting_assignee, 'expectedVersion', resulting_version, 'eventId', event_id);
end;
$$;

revoke all on function internal_security.re_resolve_process_work_item(uuid, bigint) from public, anon, authenticated;
grant execute on function internal_security.re_resolve_process_work_item(uuid, bigint) to authenticated;

create or replace function public.claim_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$ select internal_security.claim_process_work_item(requested_work_item_id, requested_expected_version); $$;

create or replace function public.release_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$ select internal_security.release_process_work_item(requested_work_item_id, requested_expected_version); $$;

create or replace function public.reassign_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_employee_id uuid
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$ select internal_security.reassign_process_work_item(requested_work_item_id, requested_expected_version, requested_employee_id); $$;

create or replace function public.re_resolve_process_work_item(
  requested_work_item_id uuid,
  requested_expected_version bigint
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$ select internal_security.re_resolve_process_work_item(requested_work_item_id, requested_expected_version); $$;

revoke all on function public.claim_process_work_item(uuid, bigint) from public, anon;
revoke all on function public.release_process_work_item(uuid, bigint) from public, anon;
revoke all on function public.reassign_process_work_item(uuid, bigint, uuid) from public, anon;
revoke all on function public.re_resolve_process_work_item(uuid, bigint) from public, anon;
grant execute on function public.claim_process_work_item(uuid, bigint) to authenticated;
grant execute on function public.release_process_work_item(uuid, bigint) to authenticated;
grant execute on function public.reassign_process_work_item(uuid, bigint, uuid) to authenticated;
grant execute on function public.re_resolve_process_work_item(uuid, bigint) to authenticated;

commit;
