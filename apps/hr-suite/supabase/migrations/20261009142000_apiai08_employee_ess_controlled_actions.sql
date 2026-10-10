begin;

alter table public.ai_action_drafts
  drop constraint ai_action_drafts_action_type_check,
  add constraint ai_action_drafts_action_type_check
    check (action_type in (
      'PERSONAL_REMINDER',
      'EMPLOYEE_ADDRESS_CHANGE',
      'EMPLOYMENT_SALARY_CHANGE',
      'EMPLOYMENT_SCHEDULE_CHANGE',
      'ORGANIZATION_PLACEMENT_CHANGE',
      'TALENT_DEVELOPMENT_GOAL_CREATE',
      'TALENT_GOAL_CHECK_IN_CREATE',
      'EMPLOYEE_LEAVE_REQUEST_CREATE',
      'EMPLOYEE_PERSONAL_REMINDER_CREATE'
    ));

alter table public.ai_action_drafts
  drop constraint ai_action_drafts_tool_name_check,
  add constraint ai_action_drafts_tool_name_check
    check (tool_name in (
      'draft_personal_reminder',
      'draft_employee_address_change',
      'draft_employment_salary_change',
      'draft_employment_schedule_change',
      'draft_organization_placement_change',
      'draft_talent_development_goal',
      'draft_talent_goal_check_in',
      'draft_leave_request'
    ));

drop policy ai_action_drafts_owner_insert_legacy on public.ai_action_drafts;
create policy ai_action_drafts_owner_insert_legacy on public.ai_action_drafts
for insert to authenticated
with check (
  action_type not in (
    'TALENT_DEVELOPMENT_GOAL_CREATE',
    'TALENT_GOAL_CHECK_IN_CREATE',
    'EMPLOYEE_LEAVE_REQUEST_CREATE',
    'EMPLOYEE_PERSONAL_REMINDER_CREATE'
  )
  and owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_action_drafts.conversation_id
      and conversation.tenant_id = ai_action_drafts.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
);

drop policy ai_action_drafts_owner_update_legacy on public.ai_action_drafts;
create policy ai_action_drafts_owner_update_legacy on public.ai_action_drafts
for update to authenticated
using (
  action_type not in (
    'TALENT_DEVELOPMENT_GOAL_CREATE',
    'TALENT_GOAL_CHECK_IN_CREATE',
    'EMPLOYEE_LEAVE_REQUEST_CREATE',
    'EMPLOYEE_PERSONAL_REMINDER_CREATE'
  )
  and owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_action_drafts.conversation_id
      and conversation.tenant_id = ai_action_drafts.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
)
with check (
  action_type not in (
    'TALENT_DEVELOPMENT_GOAL_CREATE',
    'TALENT_GOAL_CHECK_IN_CREATE',
    'EMPLOYEE_LEAVE_REQUEST_CREATE',
    'EMPLOYEE_PERSONAL_REMINDER_CREATE'
  )
  and owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_action_drafts.conversation_id
      and conversation.tenant_id = ai_action_drafts.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
);

drop policy ai_action_drafts_owner_delete_legacy on public.ai_action_drafts;
create policy ai_action_drafts_owner_delete_legacy on public.ai_action_drafts
for delete to authenticated
using (
  action_type not in (
    'TALENT_DEVELOPMENT_GOAL_CREATE',
    'TALENT_GOAL_CHECK_IN_CREATE',
    'EMPLOYEE_LEAVE_REQUEST_CREATE',
    'EMPLOYEE_PERSONAL_REMINDER_CREATE'
  )
  and owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = ai_action_drafts.conversation_id
      and conversation.tenant_id = ai_action_drafts.tenant_id
      and conversation.owner_user_id = (select auth.uid())
  )
);

create or replace function internal_security.audit_controlled_action_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  audit_action text;
begin
  if new.action_type not in (
    'TALENT_DEVELOPMENT_GOAL_CREATE',
    'TALENT_GOAL_CHECK_IN_CREATE',
    'EMPLOYEE_LEAVE_REQUEST_CREATE',
    'EMPLOYEE_PERSONAL_REMINDER_CREATE'
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    event_name := 'PREPARED';
    audit_action := 'CREATE';
  elsif old.confirmed_at is null and new.confirmed_at is not null then
    event_name := 'CONFIRMED';
    audit_action := 'UPDATE';
  elsif old.status is distinct from new.status then
    event_name := case new.status
      when 'EXECUTING' then 'EXECUTION_STARTED'
      when 'SUCCEEDED' then 'EXECUTED'
      when 'FAILED' then 'FAILED'
      when 'CANCELLED' then 'CANCELLED'
      else 'STATE_CHANGED'
    end;
    audit_action := 'UPDATE';
  else
    return new;
  end if;

  insert into public.audit_logs (
    tenant_id,
    entity_name,
    entity_id,
    actor_user_id,
    action,
    changes,
    correlation_id
  ) values (
    new.tenant_id,
    'ai_controlled_action',
    new.id,
    coalesce(auth.uid(), nullif(new.control_payload ->> 'actorUserId', '')::uuid),
    audit_action,
    jsonb_build_object(
      'event', event_name,
      'action_type', new.action_type,
      'status', new.status::text,
      'idempotency_key', new.idempotency_key,
      'correlation_id', new.control_payload ->> 'correlationId',
      'source_channel', new.control_payload ->> 'sourceChannel'
    ),
    nullif(new.control_payload ->> 'correlationId', '')::uuid
  );
  return new;
end;
$$;

revoke all on function internal_security.audit_controlled_action_draft() from public, anon, authenticated;

commit;
