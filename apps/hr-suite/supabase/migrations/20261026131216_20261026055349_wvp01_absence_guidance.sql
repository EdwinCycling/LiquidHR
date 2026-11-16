begin;

-- Eén traject per canonieke casus; herstel en capaciteit blijven in absence_*.
create table public.absence_guidance (
  case_id uuid primary key references public.absence_cases(id) on delete restrict,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  process_instance_id uuid not null unique,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, hr_group_id, case_id) references public.absence_cases(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, administration_id) references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, process_instance_id) references public.process_instances(tenant_id, hr_group_id, id) on delete restrict deferrable initially deferred
);
create index absence_guidance_scope_idx on public.absence_guidance(tenant_id, hr_group_id, administration_id);

-- Gestructureerde, append-only gebeurtenissen. Geen vrije tekst of medische data.
create table public.absence_guidance_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.absence_guidance(case_id) on delete restrict,
  event_type text not null check (event_type in ('STARTED','MILESTONE','AGREEMENT','ACKNOWLEDGED','CLOSED')),
  occurred_on date not null,
  task_id uuid references public.absence_tasks(id) on delete restrict,
  agreement_code text check (agreement_code in ('UNCHANGED','ADAPTED_DUTIES','ADAPTED_HOURS','GRADUAL_BUILDUP','OTHER_SUITABLE_WORK')),
  review_on date,
  agreement_id uuid references public.absence_guidance_events(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(case_id, idempotency_key)
);
create index absence_guidance_events_case_idx on public.absence_guidance_events(case_id, created_at);
create index absence_guidance_events_task_idx on public.absence_guidance_events(task_id);
create index absence_guidance_events_agreement_idx on public.absence_guidance_events(agreement_id);
create index absence_guidance_events_actor_idx on public.absence_guidance_events(actor_user_id);

create function internal_security.wvp_case_access(c public.absence_cases, writing boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.uid() is not null
    and internal_security.has_hr_group_access(c.tenant_id,c.hr_group_id)
    and c.archived_at is null
    and (
      (not writing and c.employee_id = internal_security.current_employee_id(c.tenant_id,c.hr_group_id)
        and not internal_security.current_employee_is_preboarding(c.tenant_id,c.hr_group_id)
        and internal_security.current_employee_has_permission('self:absence:read'))
      or (internal_security.can_manage_employee(c.employee_id,case when writing then 'absence:write' else 'absence:read' end)
        and internal_security.process_scope_has_permission(c.tenant_id,c.hr_group_id,'ADMINISTRATION',c.administration_id,case when writing then 'absence:write' else 'absence:read' end))
    ),false);
$$;
revoke all on function internal_security.wvp_case_access(public.absence_cases,boolean) from public,anon;
grant execute on function internal_security.wvp_case_access(public.absence_cases,boolean) to authenticated;

alter table public.absence_guidance enable row level security;
alter table public.absence_guidance_events enable row level security;
create policy absence_guidance_read on public.absence_guidance for select to authenticated
using (exists (select 1 from public.absence_cases c where c.id=case_id and internal_security.wvp_case_access(c,false)));
create policy absence_guidance_events_read on public.absence_guidance_events for select to authenticated
using (exists (select 1 from public.absence_cases c where c.id=case_id and internal_security.wvp_case_access(c,false)));
revoke all on public.absence_guidance,public.absence_guidance_events from public,anon,authenticated;
grant select on public.absence_guidance,public.absence_guidance_events to authenticated;

create function internal_security.wvp_sync_tasks(requested_case_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.absence_cases%rowtype; analysis_on date; plan_due date;
begin
  select * into c from public.absence_cases where id=requested_case_id for update;
  if not exists(select 1 from public.absence_guidance where case_id=c.id and closed_at is null) then return; end if;
  select min(e.occurred_on) into analysis_on from public.absence_guidance_events e join public.absence_tasks t on t.id=e.task_id
  where e.case_id=c.id and e.event_type='MILESTONE' and t.milestone_code='WVP_WEEK_6';
  plan_due := least(c.effective_clock_start_on+56,coalesce(analysis_on+14,c.effective_clock_start_on+56));
  insert into public.absence_tasks(tenant_id,hr_group_id,case_id,milestone_code,milestone_type,due_on,human_confirmation_required,source_version)
  select c.tenant_id,c.hr_group_id,c.id,d.code,d.kind,d.due,true,'WVP01_V1' from (
    select 'WVP_WEEK_6' code,'STATUTORY_CANDIDATE' kind,c.effective_clock_start_on+42 due
    union all select 'WVP_WEEK_8','STATUTORY_CANDIDATE',plan_due
    union all select 'WVP_WEEK_42','STATUTORY_CANDIDATE',c.effective_clock_start_on+294
    union all select 'WVP_FIRST_YEAR_REVIEW','STATUTORY_CANDIDATE',c.effective_clock_start_on+364
    union all select 'WVP_FINAL_EVALUATION','STATUTORY_CANDIDATE',c.effective_clock_start_on+637
    union all select 'WVP_WIA_APPLICATION','STATUTORY_CANDIDATE',c.effective_clock_start_on+651
    union all select 'WVP_EVALUATION_6W_'||lpad(n::text,2,'0'),'REVIEW',plan_due+n*42 from generate_series(1,16) n
  ) d
  on conflict(tenant_id,hr_group_id,case_id,milestone_code) do update
    set due_on=excluded.due_on,source_version=excluded.source_version
    where absence_tasks.status='OPEN' and (absence_tasks.due_on,absence_tasks.source_version) is distinct from (excluded.due_on,excluded.source_version);
  -- PMUX-deadlines blijven immutable snapshots bij stapactivatie. Nieuwe
  -- stappen lezen de actuele domeindeadline; een herstelgat herschrijft geen historie.
end;
$$;
revoke all on function internal_security.wvp_sync_tasks(uuid) from public,anon,authenticated;

create function internal_security.wvp_clock_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform internal_security.wvp_sync_tasks(new.id);
  return new;
end;
$$;
revoke all on function internal_security.wvp_clock_changed() from public,anon,authenticated;
create trigger wvp_clock_changed after update of effective_clock_start_on on public.absence_cases for each row execute function internal_security.wvp_clock_changed();

create function internal_security.wvp_command(requested_tenant_id uuid,requested_hr_group_id uuid,requested_administration_id uuid,command jsonb)
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
revoke all on function internal_security.wvp_command(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function internal_security.wvp_command(uuid,uuid,uuid,jsonb) to authenticated;
create function public.wvp_command(requested_tenant_id uuid,requested_hr_group_id uuid,requested_administration_id uuid,command jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select internal_security.wvp_command(requested_tenant_id,requested_hr_group_id,requested_administration_id,command);
$$;
revoke all on function public.wvp_command(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.wvp_command(uuid,uuid,uuid,jsonb) to authenticated;

-- Een generieke PMUX-start mag geen ongekoppeld WVP-traject aanmaken.
create function internal_security.wvp_guard_start() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.process_definitions d where d.id=new.process_definition_id and d.key like 'wvp01-%')
    and not exists(select 1 from public.absence_guidance a join public.absence_cases c on c.id=a.case_id
      where c.tenant_id=new.tenant_id and c.hr_group_id=new.hr_group_id
        and new.idempotency_key='wvp01:'||c.id::text
        and not exists(select 1 from public.process_instances i where i.id=a.process_instance_id)
        and internal_security.wvp_case_access(c,true)) then raise exception 'WVP_CASE_LINK_REQUIRED'; end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_guard_start() from public,anon,authenticated;
create trigger wvp_guard_start before insert on public.process_instances for each row execute function internal_security.wvp_guard_start();

-- Een generieke PMUX-route mag de domeinvoorwaarden niet omzeilen.
create function internal_security.wvp_guard_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status and new.status::text in ('COMPLETED','CANCELLED','REJECTED')
    and exists(select 1 from public.absence_guidance a join public.absence_cases c on c.id=a.case_id
      where a.process_instance_id=new.id and (c.status<>'CLOSED' or new.status::text<>'COMPLETED'
        or not exists(select 1 from public.absence_guidance_events e where e.case_id=c.id and e.event_type='CLOSED'))) then
    raise exception 'WVP_RECOVERY_WINDOW_OPEN';
  end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_guard_completion() from public,anon,authenticated;
create trigger wvp_guard_completion before update of status on public.process_instances for each row execute function internal_security.wvp_guard_completion();

-- Voorkom dat het oudere endpoint medische vrije tekst in een WVP01-taak schrijft.
create function internal_security.wvp_guard_task() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.absence_guidance where case_id=new.case_id) and new.completion_note is not null then raise exception 'WVP_FREE_TEXT_FORBIDDEN'; end if;
  if new.status='COMPLETED' and old.status<>'COMPLETED' and not exists(select 1 from public.absence_guidance_events e where e.case_id=new.case_id and e.task_id=new.id and e.event_type='MILESTONE') then raise exception 'WVP_DOMAIN_ACTION_REQUIRED'; end if;
  if old.status='COMPLETED' and new is distinct from old then raise exception 'WVP_HISTORY_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_guard_task() from public,anon,authenticated;
create trigger wvp_guard_task before update on public.absence_tasks for each row when (old.source_version='WVP01_V1') execute function internal_security.wvp_guard_task();
create trigger audit_absence_guidance after insert or update on public.absence_guidance for each row execute function internal_security.audit_hr_change('absence_guidance');
create trigger audit_absence_guidance_events after insert on public.absence_guidance_events for each row execute function internal_security.audit_hr_change('absence_guidance_event');

-- Deze trigger loopt na de bestaande PMUX-materializer en vóór de INSERT.
-- Er wordt geen bestaande deadline of werkkalenderrevisie aangepast.
create function internal_security.wvp_materialize_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.absence_cases%rowtype; boundary date; code text;
begin
  select c0.* into c from public.absence_cases c0 join public.process_instances i
    on i.id=new.process_instance_id and i.tenant_id=c0.tenant_id and i.hr_group_id=c0.hr_group_id
    and i.idempotency_key='wvp01:'||c0.id::text;
  if c.id is null then return new; end if;
  code:=upper(replace(new.step_key,'-','_'));
  select due_on into boundary from public.absence_tasks where case_id=c.id and milestone_code=code;
  if boundary is null and code='WVP_WEEK_6' then boundary:=c.effective_clock_start_on+42; end if;
  if boundary is null and new.step_key<>'guidance' then raise exception 'WVP_MILESTONE_NOT_FOUND'; end if;
  select (boundary+1)::timestamp at time zone time_zone into new.deadline_at from public.hr_groups where id=c.hr_group_id;
  return new;
end;
$$;
revoke all on function internal_security.wvp_materialize_deadline() from public,anon,authenticated;
create trigger zz_wvp_materialize_deadline before insert on public.process_step_instances for each row execute function internal_security.wvp_materialize_deadline();

create function internal_security.wvp_guard_step() returns trigger language plpgsql security definer set search_path='' as $$
declare linked_case_id uuid;
begin
  select a.case_id into linked_case_id from public.absence_guidance a where a.process_instance_id=new.process_instance_id;
  if linked_case_id is null or new.status::text not in ('COMPLETED','CANCELLED') or new.status is not distinct from old.status then return new; end if;
  if not exists(select 1 from public.absence_guidance_events e where e.case_id=linked_case_id and (e.event_type='CLOSED'
      or (e.event_type='MILESTONE' and e.task_id in (select t.id from public.absence_tasks t where t.case_id=linked_case_id and lower(replace(t.milestone_code,'_','-'))=new.step_key)))) then
    raise exception 'WVP_DOMAIN_ACTION_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_guard_step() from public,anon,authenticated;
create trigger wvp_guard_step before update of status on public.process_step_instances for each row execute function internal_security.wvp_guard_step();

create function internal_security.wvp_guard_note() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.absence_guidance a join public.process_work_items w on w.process_instance_id=a.process_instance_id where w.id=new.work_item_id) then raise exception 'WVP_FREE_TEXT_FORBIDDEN'; end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_guard_note() from public,anon,authenticated;
create trigger wvp_guard_note before insert or update on public.process_work_item_notes for each row execute function internal_security.wvp_guard_note();

create function internal_security.wvp_case_for_process(requested_process_instance_id uuid) returns uuid language sql stable security definer set search_path='' as $$
  select a.case_id from public.absence_guidance a join public.absence_cases c on c.id=a.case_id
    where a.process_instance_id=requested_process_instance_id and internal_security.wvp_case_access(c,false);
$$;
revoke all on function internal_security.wvp_case_for_process(uuid) from public,anon;
grant execute on function internal_security.wvp_case_for_process(uuid) to authenticated;
create function public.wvp_case_for_process(requested_process_instance_id uuid) returns uuid language sql stable security invoker set search_path='' as $$
  select internal_security.wvp_case_for_process(requested_process_instance_id);
$$;
revoke all on function public.wvp_case_for_process(uuid) from public,anon;
grant execute on function public.wvp_case_for_process(uuid) to authenticated;

create function internal_security.wvp_events_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'WVP_HISTORY_IMMUTABLE'; end;
$$;
revoke all on function internal_security.wvp_events_immutable() from public,anon,authenticated;
create trigger wvp_events_immutable before update or delete on public.absence_guidance_events for each row execute function internal_security.wvp_events_immutable();

create function internal_security.wvp_guard_version() returns trigger language plpgsql security definer set search_path='' as $$
declare content jsonb;
begin
  if not exists(select 1 from public.process_definitions where id=new.process_definition_id and key like 'wvp01-%') then return new; end if;
  content:=coalesce(new.definition_json->'content',new.definition_json);
  if content ? 'output' or exists(select 1 from jsonb_array_elements(content->'forms') f,
      jsonb_array_elements(f->'sections') s,jsonb_array_elements(s->'fields') field
      where field->>'type' is distinct from 'BOOLEAN' or field->>'key' is distinct from 'confirmed'
        or field#>>'{binding,kind}' is distinct from 'PROCESS_ONLY') then raise exception 'WVP_FREE_TEXT_FORBIDDEN'; end if;
  return new;
end;
$$;
revoke all on function internal_security.wvp_guard_version() from public,anon,authenticated;
create trigger wvp_guard_version before insert on public.process_versions for each row execute function internal_security.wvp_guard_version();

create function internal_security.wvp_list(requested_tenant_id uuid,requested_hr_group_id uuid,requested_administration_id uuid,requested_case_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(item order by item->>'firstAbsenceOn' desc),'[]'::jsonb) from (
    select jsonb_build_object(
      'id',c.id,'employeeId',c.employee_id,'employmentId',c.employment_id,'administrationId',c.administration_id,
      'name',e.first_name||' '||e.birth_name,'status',c.status,'firstAbsenceOn',c.first_absence_on,'clockStartOn',c.effective_clock_start_on,
      'pendingConfirmation',c.pending_confirmation,'processInstanceId',a.process_instance_id,'closedAt',a.closed_at,
      'currentMilestone',(select upper(replace(w.step_key,'-','_')) from public.process_work_items w where w.process_instance_id=a.process_instance_id and w.status in ('OPEN','CLAIMED') limit 1),
      'canManage',internal_security.wvp_case_access(c,true),'isSelf',c.employee_id=internal_security.current_employee_id(c.tenant_id,c.hr_group_id),
      'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'code',t.milestone_code,'dueOn',t.due_on,'status',t.status,'completedAt',t.completed_at) order by t.due_on,t.milestone_code) from public.absence_tasks t where t.case_id=c.id),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'type',v.event_type,'occurredOn',v.occurred_on,'createdAt',v.created_at,'actorUserId',v.actor_user_id,'taskId',v.task_id,'agreement',v.agreement_code,'reviewOn',v.review_on,'agreementId',v.agreement_id) order by v.created_at,v.id) from public.absence_guidance_events v where v.case_id=c.id),'[]'::jsonb),
      'capacity',coalesce((select jsonb_agg(jsonb_build_object('effectiveOn',x.effective_on,'absencePercentage',x.absence_percentage,'reviewOn',x.expected_next_review_on) order by x.effective_on) from public.absence_capacity_changes x join public.absence_spells s on s.id=x.spell_id where s.case_id=c.id),'[]'::jsonb),
      'spells',coalesce((select jsonb_agg(jsonb_build_object('startedOn',s.started_on,'recoveredOn',s.recovered_on) order by s.started_on) from public.absence_spells s where s.case_id=c.id),'[]'::jsonb)
    ) item
    from public.absence_cases c join public.employees e on e.id=c.employee_id
    left join public.absence_guidance a on a.case_id=c.id
    where c.tenant_id=requested_tenant_id and c.hr_group_id=requested_hr_group_id
      and (requested_administration_id is null or c.administration_id=requested_administration_id)
      and (requested_case_id is null or c.id=requested_case_id)
      and internal_security.wvp_case_access(c,false)
    order by c.first_absence_on desc,c.id limit 250
  ) scoped;
$$;
revoke all on function internal_security.wvp_list(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function internal_security.wvp_list(uuid,uuid,uuid,uuid) to authenticated;
create function public.wvp_list(requested_tenant_id uuid,requested_hr_group_id uuid,requested_administration_id uuid,requested_case_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select internal_security.wvp_list(requested_tenant_id,requested_hr_group_id,requested_administration_id,requested_case_id);
$$;
revoke all on function public.wvp_list(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.wvp_list(uuid,uuid,uuid,uuid) to authenticated;
commit;
