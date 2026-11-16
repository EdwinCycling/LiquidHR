begin;

-- WVP02-SEC01 keeps process-instance:start enforced by the existing PMUX kernel.
create or replace function internal_security.wvp_command(requested_tenant_id uuid,requested_hr_group_id uuid,requested_administration_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.absence_cases%rowtype; a public.absence_guidance%rowtype; t public.absence_tasks%rowtype;
  action text:=command->>'action'; event_id uuid; existing public.absence_guidance_events%rowtype;
  occurred date; review_date date; instance_id uuid; definition_id uuid; w public.process_work_items%rowtype;
  agreement public.absence_guidance_events%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'WVP_FORBIDDEN' using errcode='42501'; end if;
  select * into c from public.absence_cases where id=(command->>'caseId')::uuid for update;
  if c.id is null or c.tenant_id<>requested_tenant_id or c.hr_group_id<>requested_hr_group_id
    or (requested_administration_id is not null and c.administration_id<>requested_administration_id)
    or not internal_security.wvp_case_access(c,action<>'ACKNOWLEDGE') then raise exception 'WVP_FORBIDDEN' using errcode='42501'; end if;
  if exists(select 1 from jsonb_object_keys(command) k where k not in ('action','caseId','taskId','occurredOn','confirmed','idempotencyKey','agreement','reviewOn','agreementId','processDefinitionId')) then
    raise exception 'WVP_INVALID_INPUT' using errcode='22023'; end if;
  select * into a from public.absence_guidance where case_id=c.id;
  if action='START' then
    -- Check definition permissions before idempotent return or any WVP mutation.
    if internal_security.process_scope_has_permission(
      c.tenant_id,c.hr_group_id,'ADMINISTRATION'::public.access_scope_type,
      c.administration_id,'process-definition:write'
    ) is not true or internal_security.process_scope_has_permission(
      c.tenant_id,c.hr_group_id,'ADMINISTRATION'::public.access_scope_type,
      c.administration_id,'process-definition:publish'
    ) is not true then
      raise exception 'WVP_FORBIDDEN' using errcode='42501';
    end if;
    if a.case_id is not null then return a.process_instance_id; end if;
    if c.status<>'ACTIVE' or c.pending_confirmation then raise exception 'WVP_CASE_NOT_ACTIVE'; end if;
    definition_id:=(command->>'processDefinitionId')::uuid;
    if not exists(select 1 from public.process_definitions d where d.id=definition_id and d.tenant_id=c.tenant_id and d.hr_group_id=c.hr_group_id
      and d.administration_id=c.administration_id and d.key='wvp01-'||replace(c.administration_id::text,'-','') and d.status='PUBLISHED') then raise exception 'WVP_DEFINITION_REQUIRED'; end if;
    -- De tijdelijke referentie is uitsluitend binnen deze transactie zichtbaar.
    -- De deferred FK eist bij commit de echte, door de kernel gemaakte instantie.
    insert into public.absence_guidance(case_id,tenant_id,hr_group_id,administration_id,process_instance_id) values(c.id,c.tenant_id,c.hr_group_id,c.administration_id,gen_random_uuid());
    result:=public.start_process(definition_id,c.employee_id,c.employment_id,c.first_absence_on,'wvp01:'||c.id::text,null);
    instance_id:=(result->>'processInstanceId')::uuid;
    update public.absence_guidance set process_instance_id=instance_id where case_id=c.id;
    insert into public.absence_guidance_events(case_id,event_type,occurred_on,actor_user_id,idempotency_key) values(c.id,'STARTED',current_date,auth.uid(),'start');
    perform internal_security.wvp_sync_tasks(c.id);
    return instance_id;
  end if;
  if a.case_id is null then raise exception 'WVP_NOT_STARTED'; end if;
  if coalesce(command->>'idempotencyKey','')='' then raise exception 'WVP_INVALID_INPUT'; end if;
  select * into existing from public.absence_guidance_events where case_id=c.id and idempotency_key=command->>'idempotencyKey';
  if existing.id is not null then
    if existing.actor_user_id<>auth.uid() or existing.event_type<>(case action when 'ACKNOWLEDGE' then 'ACKNOWLEDGED' when 'CLOSE' then 'CLOSED' else action end)
      or existing.task_id is distinct from (command->>'taskId')::uuid or existing.agreement_code is distinct from command->>'agreement'
      or existing.agreement_id is distinct from (command->>'agreementId')::uuid
      or (action in ('MILESTONE','AGREEMENT') and existing.occurred_on is distinct from (command->>'occurredOn')::date)
      or existing.review_on is distinct from (command->>'reviewOn')::date then raise exception 'WVP_IDEMPOTENCY_CONFLICT'; end if;
    return existing.id;
  end if;
  if a.closed_at is not null then raise exception 'WVP_CLOSED'; end if;
  occurred:=coalesce((command->>'occurredOn')::date,current_date);
  if occurred<c.first_absence_on or occurred>current_date then raise exception 'WVP_INVALID_DATE'; end if;
  if action='MILESTONE' then
    if coalesce((command->>'confirmed')::boolean,false) is not true then raise exception 'WVP_CONFIRMATION_REQUIRED'; end if;
    select * into t from public.absence_tasks where id=(command->>'taskId')::uuid and case_id=c.id for update;
    if t.id is null or t.status='CANCELLED' then raise exception 'WVP_TASK_NOT_PENDING'; end if;
    select * into w from public.process_work_items where process_instance_id=a.process_instance_id and status in ('OPEN','CLAIMED') for update;
    if w.id is null or w.step_key<>lower(replace(t.milestone_code,'_','-')) then raise exception 'WVP_TASK_SEQUENCE'; end if;
    -- Eerst de domeinevidence, dan de bestaande PMUX-kernel; alles in één transactie.
    insert into public.absence_guidance_events(case_id,event_type,occurred_on,task_id,actor_user_id,idempotency_key)
      values(c.id,'MILESTONE',occurred,t.id,auth.uid(),command->>'idempotencyKey') returning id into event_id;
    update public.absence_tasks set status='COMPLETED',completed_at=now(),completed_by_user_id=auth.uid(),completion_note=null where id=t.id and status='OPEN';
    perform internal_security.wvp_sync_tasks(c.id);
    if w.status='OPEN' then
      perform public.claim_process_work_item(w.id,w.expected_version);
      select * into w from public.process_work_items where id=w.id;
    end if;
    perform public.perform_process_work_item_action(w.id,'SUBMIT',w.expected_version,null,'wvp01:'||event_id::text,null);
    return event_id;
  elsif action='AGREEMENT' then
    review_date:=(command->>'reviewOn')::date;
    if command->>'agreement' is null or review_date is null or review_date<occurred or review_date>occurred+42 then raise exception 'WVP_INVALID_INPUT'; end if;
  elsif action='ACKNOWLEDGE' then
    if c.employee_id is distinct from internal_security.current_employee_id(c.tenant_id,c.hr_group_id) then raise exception 'WVP_FORBIDDEN' using errcode='42501'; end if;
    select * into agreement from public.absence_guidance_events where id=(command->>'agreementId')::uuid and case_id=c.id and event_type='AGREEMENT';
    if agreement.id is null then raise exception 'WVP_INVALID_INPUT'; end if;
    if exists(select 1 from public.absence_guidance_events where agreement_id=agreement.id and event_type='ACKNOWLEDGED') then return agreement.id; end if;
  elsif action='CLOSE' then
    if c.status<>'CLOSED' then raise exception 'WVP_RECOVERY_WINDOW_OPEN'; end if;
    if exists(select 1 from public.absence_tasks task where task.case_id=c.id and task.status='OPEN'
      and task.due_on<=coalesce((select max(recovered_on) from public.absence_spells where case_id=c.id),current_date)) then raise exception 'WVP_DUE_TASKS_OPEN'; end if;
    insert into public.absence_guidance_events(case_id,event_type,occurred_on,actor_user_id,idempotency_key)
      values(c.id,'CLOSED',occurred,auth.uid(),command->>'idempotencyKey') returning id into event_id;
    select * into w from public.process_work_items where process_instance_id=a.process_instance_id and status in ('OPEN','CLAIMED') for update;
    if w.id is null then raise exception 'WVP_WORK_ITEM_UNAVAILABLE'; end if;
    if w.status='OPEN' then
      perform public.claim_process_work_item(w.id,w.expected_version);
      select * into w from public.process_work_items where id=w.id;
    end if;
    perform public.perform_process_work_item_action(w.id,'CANCEL',w.expected_version,null,'wvp01-close:'||c.id::text,null);
    update public.absence_guidance set closed_at=now() where case_id=c.id;
    update public.absence_tasks set status='CANCELLED' where case_id=c.id and status='OPEN';
    return event_id;
  else raise exception 'WVP_INVALID_INPUT'; end if;
  insert into public.absence_guidance_events(case_id,event_type,occurred_on,task_id,agreement_code,review_on,agreement_id,actor_user_id,idempotency_key)
  values(c.id,case action when 'ACKNOWLEDGE' then 'ACKNOWLEDGED' when 'CLOSE' then 'CLOSED' else action end,occurred,t.id,command->>'agreement',review_date,agreement.id,auth.uid(),command->>'idempotencyKey') returning id into event_id;
  perform internal_security.wvp_sync_tasks(c.id);
  return event_id;
end;
$$;

commit;
