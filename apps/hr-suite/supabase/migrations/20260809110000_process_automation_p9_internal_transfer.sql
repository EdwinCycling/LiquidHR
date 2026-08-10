begin;

-- P9: the certified internal-transfer showcase is catalog data, not a
-- hard-coded runtime branch. Tenants activate a copy into their own draft;
-- the published process still runs through the generic P4-P8 engine.

create table if not exists public.process_recipe_catalog (
  id uuid primary key default gen_random_uuid(),
  recipe_key text not null,
  recipe_version integer not null,
  title jsonb not null,
  description jsonb not null,
  adapter_key text not null,
  definition_json jsonb not null,
  status text not null default 'PUBLISHED',
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_recipe_catalog_identity_unique unique (recipe_key, recipe_version),
  constraint process_recipe_catalog_version_positive check (recipe_version > 0),
  constraint process_recipe_catalog_status_check check (status in ('PUBLISHED', 'RETIRED')),
  constraint process_recipe_catalog_definition_object check (jsonb_typeof(definition_json) = 'object')
);

create table if not exists public.process_recipe_activations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_recipe_id uuid not null references public.process_recipe_catalog(id),
  process_definition_id uuid not null references public.process_definitions(id),
  activated_by_user_id uuid not null default auth.uid(),
  activated_at timestamptz not null default timezone('utc', now()),
  constraint process_recipe_activation_unique unique (tenant_id, hr_group_id, process_recipe_id),
  constraint process_recipe_activation_definition_unique unique (process_definition_id)
);

create index if not exists process_recipe_activations_scope_idx
  on public.process_recipe_activations (tenant_id, hr_group_id, activated_at desc);

create table if not exists public.process_domain_commits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_instance_id uuid not null references public.process_instances(id),
  work_item_id uuid not null references public.process_work_items(id),
  adapter_key text not null,
  organization_placement_id uuid,
  correlation_id uuid,
  idempotency_key text not null,
  result jsonb not null,
  created_by_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_domain_commit_unique unique (process_instance_id, adapter_key),
  constraint process_domain_commit_idempotency_unique unique (idempotency_key)
);

create index if not exists process_domain_commits_correlation_idx
  on public.process_domain_commits (correlation_id);

create table if not exists public.process_work_item_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_instance_id uuid not null references public.process_instances(id),
  work_item_id uuid not null references public.process_work_items(id),
  action text not null,
  body text not null,
  actor_user_id uuid not null default auth.uid(),
  correlation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_work_item_note_action_check check (action in ('REQUEST_CHANGES', 'REJECT', 'CANCEL')),
  constraint process_work_item_note_body_check check (length(btrim(body)) between 1 and 4000)
);

create index if not exists process_work_item_notes_work_item_idx
  on public.process_work_item_notes (tenant_id, hr_group_id, work_item_id, created_at desc);

alter table public.process_recipe_catalog enable row level security;
alter table public.process_recipe_activations enable row level security;
alter table public.process_domain_commits enable row level security;
alter table public.process_work_item_notes enable row level security;

drop policy if exists process_recipe_catalog_no_direct_access on public.process_recipe_catalog;
create policy process_recipe_catalog_no_direct_access
  on public.process_recipe_catalog for all to authenticated using (false) with check (false);
drop policy if exists process_recipe_activations_no_direct_access on public.process_recipe_activations;
create policy process_recipe_activations_no_direct_access
  on public.process_recipe_activations for all to authenticated using (false) with check (false);
drop policy if exists process_domain_commits_no_direct_access on public.process_domain_commits;
create policy process_domain_commits_no_direct_access
  on public.process_domain_commits for all to authenticated using (false) with check (false);
drop policy if exists process_work_item_notes_no_direct_access on public.process_work_item_notes;
create policy process_work_item_notes_no_direct_access
  on public.process_work_item_notes for all to authenticated using (false) with check (false);

revoke all on table public.process_recipe_catalog from public, anon, authenticated;
revoke all on table public.process_recipe_activations from public, anon, authenticated;
revoke all on table public.process_domain_commits from public, anon, authenticated;
revoke all on table public.process_work_item_notes from public, anon, authenticated;

insert into public.process_recipe_catalog (
  recipe_key, recipe_version, title, description, adapter_key, definition_json
)
values (
  'internal-transfer',
  1,
  '{"nl":"Interne overplaatsing","en":"Internal transfer"}'::jsonb,
  '{"nl":"Een gecertificeerde wijziging van afdeling en functie zonder salarisvelden of salaris-schrijfweg.","en":"A certified department and job change without salary fields or a salary write path."}'::jsonb,
  'INTERNAL_TRANSFER_ORGANIZATION',
  $$
  {
    "schemaVersion": 1,
    "key": "internal-transfer",
    "status": "DRAFT",
    "title": {"nl": "Interne overplaatsing", "en": "Internal transfer"},
    "description": {"nl": "Een gecertificeerde wijziging van afdeling en functie zonder salariswijziging.", "en": "A certified department and job change without a salary change."},
    "enabledLanguages": ["nl", "en"],
    "startStepKey": "request",
    "participants": [
      {"key":"initiator","label":{"nl":"Aanvrager","en":"Initiator"},"selector":{"type":"INITIATOR","resolutionDatePolicy":"STEP_ACTIVATED_AT"},"assignmentMode":"EXACTLY_ONE","permission":"self:process-instance:start"},
      {"key":"source-manager","label":{"nl":"Huidige manager","en":"Current manager"},"selector":{"type":"DIRECT_MANAGER_OF_SUBJECT","resolutionDatePolicy":"BUSINESS_EFFECTIVE_DATE"},"assignmentMode":"EXACTLY_ONE","permission":"process-task:act"},
      {"key":"target-manager","label":{"nl":"Nieuwe manager","en":"New manager"},"selector":{"type":"MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT","roleCode":"DIRECT_MANAGER","departmentFieldKey":"target-department","resolutionDatePolicy":"BUSINESS_EFFECTIVE_DATE"},"assignmentMode":"EXACTLY_ONE","permission":"process-task:act"},
      {"key":"hr-queue","label":{"nl":"HR-werkvoorraad","en":"HR work queue"},"selector":{"type":"PERMISSION_WORK_QUEUE","permission":"process-task:act","queueKey":"hr-processes","resolutionDatePolicy":"STEP_ACTIVATED_AT"},"assignmentMode":"ANY_ONE","permission":"process-task:act"}
    ],
    "forms": [
      {"key":"internal-transfer-form","version":1,"title":{"nl":"Gegevens interne overplaatsing","en":"Internal transfer details"},"sections":[
        {"key":"proposal","title":{"nl":"Voorstel","en":"Proposal"},"fields":[
          {"key":"current-department","label":{"nl":"Huidige afdeling","en":"Current department"},"type":"DEPARTMENT_REFERENCE","binding":{"kind":"DOMAIN_READ","key":"employee.current.department"},"access":[{"participantKey":"initiator","mode":"READ"},{"participantKey":"source-manager","mode":"READ"},{"participantKey":"target-manager","mode":"READ"},{"participantKey":"hr-queue","mode":"READ"}]},
          {"key":"current-job","label":{"nl":"Huidige functie","en":"Current job"},"type":"JOB_REFERENCE","binding":{"kind":"DOMAIN_READ","key":"employee.current.job"},"access":[{"participantKey":"initiator","mode":"READ"},{"participantKey":"source-manager","mode":"READ"},{"participantKey":"target-manager","mode":"READ"},{"participantKey":"hr-queue","mode":"READ"}]},
          {"key":"target-department","label":{"nl":"Nieuwe afdeling","en":"Target department"},"type":"DEPARTMENT_REFERENCE","binding":{"kind":"DOMAIN_PROPOSAL","key":"employment.organizationChange.targetDepartment"},"access":[{"participantKey":"initiator","mode":"WRITE_REQUIRED"},{"participantKey":"source-manager","mode":"READ"},{"participantKey":"target-manager","mode":"READ"},{"participantKey":"hr-queue","mode":"WRITE_OPTIONAL"}]},
          {"key":"target-job","label":{"nl":"Nieuwe functie","en":"Target job"},"type":"JOB_REFERENCE","binding":{"kind":"DOMAIN_PROPOSAL","key":"employment.organizationChange.targetJob"},"access":[{"participantKey":"initiator","mode":"WRITE_REQUIRED"},{"participantKey":"source-manager","mode":"READ"},{"participantKey":"target-manager","mode":"READ"},{"participantKey":"hr-queue","mode":"WRITE_OPTIONAL"}]},
          {"key":"effective-on","label":{"nl":"Ingangsdatum","en":"Effective date"},"type":"DATE","binding":{"kind":"DOMAIN_PROPOSAL","key":"employment.organizationChange.effectiveOn"},"access":[{"participantKey":"initiator","mode":"WRITE_REQUIRED"},{"participantKey":"source-manager","mode":"READ"},{"participantKey":"target-manager","mode":"READ"},{"participantKey":"hr-queue","mode":"WRITE_OPTIONAL"}]},
          {"key":"reason","label":{"nl":"Reden","en":"Reason"},"helpText":{"nl":"Beschrijf kort de aanleiding.","en":"Briefly describe the reason."},"type":"LONG_TEXT","binding":{"kind":"PROCESS_ONLY"},"access":[{"participantKey":"initiator","mode":"WRITE_OPTIONAL"},{"participantKey":"source-manager","mode":"READ"},{"participantKey":"target-manager","mode":"READ"},{"participantKey":"hr-queue","mode":"READ"}]}
        ]}
      ]}],
    "steps": [
      {"key":"request","type":"FORM","title":{"nl":"Aanvraag invullen","en":"Complete request"},"participantKey":"initiator","formKey":"internal-transfer-form","allowedActions":["SUBMIT","CANCEL"],"sla":{"duration":{"amount":2,"unit":"DAYS"},"businessDays":true,"onBreach":"ESCALATE","escalationParticipantKey":"hr-queue"}},
      {"key":"source-approval","type":"DECISION","title":{"nl":"Goedkeuring huidige manager","en":"Current manager approval"},"participantKey":"source-manager","allowedActions":["APPROVE","REJECT","REQUEST_CHANGES","CANCEL"],"sla":{"duration":{"amount":2,"unit":"DAYS"},"businessDays":true,"onBreach":"NOTIFY"}},
      {"key":"target-approval","type":"DECISION","title":{"nl":"Goedkeuring nieuwe manager","en":"New manager approval"},"participantKey":"target-manager","allowedActions":["APPROVE","REJECT","REQUEST_CHANGES","CANCEL"],"sla":{"duration":{"amount":2,"unit":"DAYS"},"businessDays":true,"onBreach":"NOTIFY"}},
      {"key":"hr-validation","type":"DECISION","title":{"nl":"HR-controle","en":"HR validation"},"participantKey":"hr-queue","allowedActions":["APPROVE","REJECT","REQUEST_CHANGES","CANCEL"],"sla":{"duration":{"amount":3,"unit":"DAYS"},"businessDays":true,"onBreach":"NOTIFY"}},
      {"key":"completed","type":"END","title":{"nl":"Afgerond","en":"Completed"},"allowedActions":[],"terminalOutcome":"COMPLETED"},
      {"key":"rejected","type":"END","title":{"nl":"Afgewezen","en":"Rejected"},"allowedActions":[],"terminalOutcome":"REJECTED"},
      {"key":"cancelled","type":"END","title":{"nl":"Geannuleerd","en":"Cancelled"},"allowedActions":[],"terminalOutcome":"CANCELLED"}
    ],
    "transitions": [
      {"key":"request-submit","fromStepKey":"request","toStepKey":"source-approval","action":"SUBMIT","kind":"FORWARD","label":{"nl":"Verstuur aanvraag","en":"Submit request"}},
      {"key":"request-cancel","fromStepKey":"request","toStepKey":"cancelled","action":"CANCEL","kind":"FORWARD","label":{"nl":"Annuleer","en":"Cancel"}},
      {"key":"source-approve","fromStepKey":"source-approval","toStepKey":"target-approval","action":"APPROVE","kind":"FORWARD","label":{"nl":"Goedkeuren","en":"Approve"}},
      {"key":"source-reject","fromStepKey":"source-approval","toStepKey":"rejected","action":"REJECT","kind":"FORWARD","label":{"nl":"Afwijzen","en":"Reject"}},
      {"key":"source-changes","fromStepKey":"source-approval","toStepKey":"request","action":"REQUEST_CHANGES","kind":"RECOVERY","label":{"nl":"Wijzigingen vragen","en":"Request changes"}},
      {"key":"source-cancel","fromStepKey":"source-approval","toStepKey":"cancelled","action":"CANCEL","kind":"FORWARD","label":{"nl":"Annuleer","en":"Cancel"}},
      {"key":"target-approve","fromStepKey":"target-approval","toStepKey":"hr-validation","action":"APPROVE","kind":"FORWARD","label":{"nl":"Goedkeuren","en":"Approve"}},
      {"key":"target-reject","fromStepKey":"target-approval","toStepKey":"rejected","action":"REJECT","kind":"FORWARD","label":{"nl":"Afwijzen","en":"Reject"}},
      {"key":"target-changes","fromStepKey":"target-approval","toStepKey":"request","action":"REQUEST_CHANGES","kind":"RECOVERY","label":{"nl":"Wijzigingen vragen","en":"Request changes"}},
      {"key":"target-cancel","fromStepKey":"target-approval","toStepKey":"cancelled","action":"CANCEL","kind":"FORWARD","label":{"nl":"Annuleer","en":"Cancel"}},
      {"key":"hr-approve","fromStepKey":"hr-validation","toStepKey":"completed","action":"APPROVE","kind":"FORWARD","label":{"nl":"Afronden","en":"Complete"}},
      {"key":"hr-reject","fromStepKey":"hr-validation","toStepKey":"rejected","action":"REJECT","kind":"FORWARD","label":{"nl":"Afwijzen","en":"Reject"}},
      {"key":"hr-changes","fromStepKey":"hr-validation","toStepKey":"request","action":"REQUEST_CHANGES","kind":"RECOVERY","label":{"nl":"Wijzigingen vragen","en":"Request changes"}},
      {"key":"hr-cancel","fromStepKey":"hr-validation","toStepKey":"cancelled","action":"CANCEL","kind":"FORWARD","label":{"nl":"Annuleer","en":"Cancel"}}
    ],
    "output":{"key":"transfer-dossier","title":{"nl":"Dossier interne overplaatsing","en":"Internal transfer dossier"},"format":"PDF","dossierCategoryKey":"process-internal-transfer","fieldKeys":["current-department","current-job","target-department","target-job","effective-on","reason"]}
  }
  $$::jsonb
)
on conflict (recipe_key, recipe_version) do update
set title = excluded.title,
    description = excluded.description,
    adapter_key = excluded.adapter_key,
    definition_json = excluded.definition_json,
    status = excluded.status;

create or replace function internal_security.get_process_recipe_catalog_internal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', recipe.id,
      'recipeKey', recipe.recipe_key,
      'recipeVersion', recipe.recipe_version,
      'title', recipe.title,
      'description', recipe.description,
      'adapterKey', recipe.adapter_key,
      'status', recipe.status
    ) order by recipe.recipe_key, recipe.recipe_version desc)
    from public.process_recipe_catalog recipe
    where recipe.status = 'PUBLISHED'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_process_recipe_catalog()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_process_recipe_catalog_internal();
$$;

create or replace function internal_security.activate_process_recipe_internal(
  requested_recipe_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  recipe_row public.process_recipe_catalog%rowtype;
  activation_row public.process_recipe_activations%rowtype;
  definition_result jsonb;
  definition_id uuid;
  definition_key text;
  definition_json jsonb;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id, requested_hr_group_id, 'process-definition:write'
  ) then raise exception 'PROCESS_RECIPE_FORBIDDEN' using errcode = '42501'; end if;

  select recipe.* into recipe_row
  from public.process_recipe_catalog recipe
  where recipe.id = requested_recipe_id
    and recipe.status = 'PUBLISHED';
  if recipe_row.id is null then raise exception 'PROCESS_RECIPE_NOT_FOUND' using errcode = 'P0002'; end if;

  select activation.* into activation_row
  from public.process_recipe_activations activation
  where activation.tenant_id = requested_tenant_id
    and activation.hr_group_id = requested_hr_group_id
    and activation.process_recipe_id = requested_recipe_id;
  if activation_row.id is not null then
    return jsonb_build_object(
      'activationId', activation_row.id,
      'processDefinitionId', activation_row.process_definition_id,
      'recipeId', recipe_row.id,
      'recipeKey', recipe_row.recipe_key,
      'recipeVersion', recipe_row.recipe_version,
      'existing', true
    );
  end if;

  definition_key := coalesce(nullif(btrim(requested_key), ''), recipe_row.recipe_key || '-v' || recipe_row.recipe_version::text);
  if definition_key !~ '^[a-z][a-z0-9_-]*$' then raise exception 'PROCESS_RECIPE_INVALID_KEY' using errcode = '22023'; end if;
  definition_json := jsonb_set(recipe_row.definition_json, '{key}', to_jsonb(definition_key), true);
  select public.create_process_definition_draft(
    requested_tenant_id,
    requested_hr_group_id,
    requested_scope_type,
    requested_administration_id,
    definition_key,
    recipe_row.title,
    recipe_row.description,
    definition_json,
    jsonb_build_object('source', 'CERTIFIED_RECIPE', 'recipeKey', recipe_row.recipe_key, 'recipeVersion', recipe_row.recipe_version, 'adapterKey', recipe_row.adapter_key)
  ) into definition_result;
  definition_id := (definition_result ->> 'id')::uuid;

  insert into public.process_recipe_activations (
    tenant_id, hr_group_id, process_recipe_id, process_definition_id, activated_by_user_id
  ) values (
    requested_tenant_id, requested_hr_group_id, requested_recipe_id, definition_id, actor_id
  ) returning * into activation_row;

  insert into public.audit_logs (
    tenant_id, entity_name, entity_id, actor_user_id, action, changes
  ) values (
    requested_tenant_id, 'process_recipe_activation', activation_row.id, actor_id, 'CREATE',
    jsonb_build_object('recipeKey', recipe_row.recipe_key, 'recipeVersion', recipe_row.recipe_version, 'processDefinitionId', definition_id)
  );

  return jsonb_build_object(
    'activationId', activation_row.id,
    'processDefinitionId', definition_id,
    'recipeId', recipe_row.id,
    'recipeKey', recipe_row.recipe_key,
    'recipeVersion', recipe_row.recipe_version,
    'definitionKey', definition_key,
    'existing', false
  );
end;
$$;

create or replace function public.activate_process_recipe(
  requested_recipe_id uuid,
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.activate_process_recipe_internal(
    requested_recipe_id, requested_tenant_id, requested_hr_group_id,
    requested_scope_type, requested_administration_id, requested_key
  );
$$;

create or replace function internal_security.get_process_recipe_start_context_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_recipe_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_row public.process_definitions%rowtype;
  recipe_row public.process_recipe_catalog%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not (
    internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'process-instance:start')
    or internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'self:process-instance:start')
  ) then
    raise exception 'PROCESS_RECIPE_START_FORBIDDEN' using errcode = '42501';
  end if;
  select recipe.* into recipe_row
  from public.process_recipe_catalog recipe
  where recipe.recipe_key = requested_recipe_key and recipe.status = 'PUBLISHED'
  order by recipe.recipe_version desc limit 1;
  if recipe_row.id is null then raise exception 'PROCESS_RECIPE_NOT_FOUND' using errcode = 'P0002'; end if;
  select definition.* into definition_row
  from public.process_definitions definition
  join public.process_recipe_activations activation
    on activation.process_definition_id = definition.id
   and activation.tenant_id = requested_tenant_id
   and activation.hr_group_id = requested_hr_group_id
   and activation.process_recipe_id = recipe_row.id
  where definition.status = 'PUBLISHED'
  order by definition.updated_at desc limit 1;
  if definition_row.id is null then raise exception 'PROCESS_RECIPE_NOT_ACTIVATED' using errcode = '40901'; end if;
  return jsonb_build_object(
    'recipeId', recipe_row.id,
    'recipeKey', recipe_row.recipe_key,
    'recipeVersion', recipe_row.recipe_version,
    'adapterKey', recipe_row.adapter_key,
    'processDefinitionId', definition_row.id,
    'definitionKey', definition_row.key,
    'title', definition_row.title,
    'description', definition_row.description
  );
end;
$$;

create or replace function public.get_process_recipe_start_context(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_recipe_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.get_process_recipe_start_context_internal(
    requested_tenant_id, requested_hr_group_id, requested_recipe_key
  );
$$;

create or replace function internal_security.internal_transfer_projection(requested_work_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  employment_row public.employments%rowtype;
  placement_row public.employee_organizations%rowtype;
  fields jsonb := '{}'::jsonb;
  target_department_id uuid;
  target_job_id uuid;
  effective_on date;
  target_department_code text;
  target_department_name text;
  target_job_code text;
  target_job_name text;
  current_department_code text;
  current_department_name text;
  current_job_code text;
  current_job_name text;
  current_manager_name text;
  target_manager_name text;
  target_manager_id uuid;
  target_manager_count integer := 0;
  blockers jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  status text;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row
  from public.process_instances instance
  where instance.id = item_row.process_instance_id
    and instance.tenant_id = item_row.tenant_id
    and instance.hr_group_id = item_row.hr_group_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type,
    instance_row.administration_id, 'organization-placement:write'
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select coalesce(response.current_values, '{}'::jsonb) || coalesce(response.new_values, '{}'::jsonb)
    into fields
  from public.process_form_responses response
  where response.tenant_id = instance_row.tenant_id
    and response.hr_group_id = instance_row.hr_group_id
    and response.process_instance_id = instance_row.id
  order by response.revision desc
  limit 1;

  begin
    if coalesce(fields ->> 'effective-on', '') ~ '^\\d{4}-\\d{2}-\\d{2}$' then
      effective_on := (fields ->> 'effective-on')::date;
    else
      effective_on := instance_row.business_effective_date;
    end if;
  exception when others then
    effective_on := null;
  end;
  target_department_id := case
    when coalesce(fields ->> 'target-department', fields -> 'target-department' ->> 'id') ~ '^[0-9a-fA-F-]{36}$'
    then coalesce(fields ->> 'target-department', fields -> 'target-department' ->> 'id')::uuid
    else null end;
  target_job_id := case
    when coalesce(fields ->> 'target-job', fields -> 'target-job' ->> 'id') ~ '^[0-9a-fA-F-]{36}$'
    then coalesce(fields ->> 'target-job', fields -> 'target-job' ->> 'id')::uuid
    else null end;

  select employment.* into employment_row
  from public.process_employment_subjects subject
  join public.employments employment
    on employment.tenant_id = subject.tenant_id
   and employment.hr_group_id = subject.hr_group_id
   and employment.id = subject.employment_id
  where subject.tenant_id = instance_row.tenant_id
    and subject.hr_group_id = instance_row.hr_group_id
    and subject.process_instance_id = instance_row.id
  limit 1;
  if employment_row.id is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','SUBJECT_EMPLOYMENT_NOT_FOUND')); end if;
  if effective_on is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','INVALID_BUSINESS_DATE')); end if;

  if employment_row.id is not null and effective_on is not null then
    select placement.* into placement_row
    from public.employee_organizations placement
    where placement.tenant_id = employment_row.tenant_id
      and placement.hr_group_id = employment_row.hr_group_id
      and placement.employment_id = employment_row.id
      and placement.effective_from <= effective_on
      and (placement.effective_to is null or placement.effective_to >= effective_on)
    order by placement.effective_from desc
    limit 1;
    if placement_row.id is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','PLACEMENT_CHAIN_GAP')); end if;
    if effective_on <= employment_row.starts_on or (employment_row.ends_on is not null and effective_on > employment_row.ends_on) then
      blockers := blockers || jsonb_build_array(jsonb_build_object('code','PLACEMENT_EFFECTIVE_DATE_INVALID'));
    end if;
  end if;

  if placement_row.id is not null then
    select department.code, department.name into current_department_code, current_department_name
    from public.departments department where department.id = placement_row.department_id;
    select job.code, revision.name into current_job_code, current_job_name
    from public.jobs job
    left join lateral (
      select value.name from public.job_revisions value
      where value.job_id = job.id and value.valid_from <= coalesce(effective_on, current_date)
        and (value.valid_until is null or value.valid_until > coalesce(effective_on, current_date))
      order by value.valid_from desc limit 1
    ) revision on true
    where job.id = placement_row.job_id;
    select employee.first_name || ' ' || employee.birth_name into current_manager_name
    from public.employees employee where employee.id = placement_row.direct_manager_id;
  end if;

  if target_department_id is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','TARGET_DEPARTMENT_REQUIRED'));
  else
    select department.code, department.name into target_department_code, target_department_name
    from public.departments department
    where department.id = target_department_id
      and department.tenant_id = instance_row.tenant_id
      and department.hr_group_id = instance_row.hr_group_id
      and department.is_active;
    if target_department_code is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','DEPARTMENT_NOT_FOUND')); end if;
    if placement_row.id is not null and target_department_id = placement_row.department_id then blockers := blockers || jsonb_build_array(jsonb_build_object('code','TARGET_DEPARTMENT_UNCHANGED')); end if;
  end if;

  if target_job_id is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','TARGET_JOB_REQUIRED'));
  else
    select job.code, revision.name into target_job_code, target_job_name
    from public.jobs job
    join lateral (
      select value.name from public.job_revisions value
      where value.job_id = job.id and value.valid_from <= coalesce(effective_on, current_date)
        and (value.valid_until is null or value.valid_until > coalesce(effective_on, current_date))
      order by value.valid_from desc limit 1
    ) revision on true
    where job.id = target_job_id
      and job.tenant_id = instance_row.tenant_id
      and job.hr_group_id = instance_row.hr_group_id
      and job.is_active;
    if target_job_code is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','JOB_NOT_FOUND')); end if;
    if placement_row.id is not null and target_job_id = placement_row.job_id then warnings := warnings || jsonb_build_array(jsonb_build_object('code','SALARY_UNCHANGED')); end if;
  end if;

  if placement_row.direct_manager_id is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','NO_SOURCE_MANAGER'));
  end if;
  if target_department_id is not null then
    select count(*)::integer, min(management.employee_id) into target_manager_count, target_manager_id
    from public.department_management management
    join public.management_roles role on role.id = management.management_role_id and role.code = 'DIRECT_MANAGER' and role.is_active
    join public.employees employee on employee.id = management.employee_id and employee.is_active and employee.is_archived = false and employee.deleted_at is null
    where management.tenant_id = instance_row.tenant_id
      and management.hr_group_id = instance_row.hr_group_id
      and management.department_id = target_department_id
      and management.effective_from <= coalesce(effective_on, current_date)
      and (management.effective_to is null or management.effective_to >= coalesce(effective_on, current_date));
    if target_manager_count = 0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','NO_ASSIGNEE')); end if;
    if target_manager_count > 1 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','AMBIGUOUS_ASSIGNEE','candidateCount',target_manager_count)); end if;
    select employee.first_name || ' ' || employee.birth_name into target_manager_name from public.employees employee where employee.id = target_manager_id;
  end if;

  status := case when jsonb_array_length(blockers) > 0 then 'BLOCKING' when jsonb_array_length(warnings) > 0 then 'WARNING' else 'SUCCESS' end;
  return jsonb_build_object(
    'adapterKey','INTERNAL_TRANSFER_ORGANIZATION',
    'processInstanceId',instance_row.id,
    'workItemId',item_row.id,
    'status',status,
    'writesPerformed',false,
    'effectiveOn',effective_on,
    'employee',jsonb_build_object('id',employment_row.employee_id,'employmentId',employment_row.id),
    'current',jsonb_build_object('placementId',placement_row.id,'departmentId',placement_row.department_id,'departmentCode',current_department_code,'departmentName',current_department_name,'jobId',placement_row.job_id,'jobCode',current_job_code,'jobName',current_job_name,'managerId',placement_row.direct_manager_id,'managerName',current_manager_name),
    'proposed',jsonb_build_object('departmentId',target_department_id,'departmentCode',target_department_code,'departmentName',target_department_name,'jobId',target_job_id,'jobCode',target_job_code,'jobName',target_job_name,'managerId',target_manager_id,'managerName',target_manager_name),
    'blockers',blockers,
    'warnings',warnings,
    'reason',coalesce(fields ->> 'reason','')
  );
end;
$$;

create or replace function public.get_internal_transfer_preview(requested_work_item_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.internal_transfer_projection(requested_work_item_id);
$$;

create or replace function internal_security.commit_internal_transfer(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  preview jsonb;
  existing_commit public.process_domain_commits%rowtype;
  placement_id uuid;
  action_result jsonb;
  result_json jsonb;
  actor_id uuid := auth.uid();
  correlation_id uuid;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if requested_idempotency_key is null or btrim(requested_idempotency_key) = '' then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id for update;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = item_row.process_instance_id for update;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.process_scope_has_permission(instance_row.tenant_id, instance_row.hr_group_id, instance_row.scope_type, instance_row.administration_id, 'organization-placement:write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select commit_row.* into existing_commit
  from public.process_domain_commits commit_row
  where commit_row.process_instance_id = instance_row.id and commit_row.adapter_key = 'INTERNAL_TRANSFER_ORGANIZATION'
  for update;
  if existing_commit.id is not null then return existing_commit.result; end if;
  if item_row.step_key <> 'hr-validation' then raise exception 'INTERNAL_TRANSFER_HR_STEP_REQUIRED' using errcode = '42501'; end if;
  preview := internal_security.internal_transfer_projection(requested_work_item_id);
  if preview ->> 'status' = 'BLOCKING' then raise exception 'INTERNAL_TRANSFER_VALIDATION_BLOCKED' using errcode = '22023'; end if;

  placement_id := public.manage_employment_organization_timeline(
    (preview -> 'employee' ->> 'employmentId')::uuid,
    null,
    (preview ->> 'effectiveOn')::date,
    (preview -> 'proposed' ->> 'departmentId')::uuid,
    (preview -> 'proposed' ->> 'jobId')::uuid
  );
  update public.employee_organizations
  set direct_manager_id = (preview -> 'proposed' ->> 'managerId')::uuid
  where id = placement_id
    and employment_id = (preview -> 'employee' ->> 'employmentId')::uuid;
  if not found then raise exception 'PLACEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id);
  insert into public.audit_logs (
    tenant_id, administration_id, entity_name, entity_id, actor_user_id, action,
    changes, subject_employee_id, employment_id, correlation_id
  ) values (
    instance_row.tenant_id, instance_row.administration_id, 'employee_organization', placement_id, actor_id, 'CREATE',
    jsonb_build_object('adapterKey','INTERNAL_TRANSFER_ORGANIZATION','current',preview -> 'current','proposed',preview -> 'proposed','effectiveOn',preview ->> 'effectiveOn'),
    (preview -> 'employee' ->> 'id')::uuid,
    (preview -> 'employee' ->> 'employmentId')::uuid,
    correlation_id
  );

  action_result := internal_security.perform_process_work_item_action(
    requested_work_item_id, 'APPROVE', requested_expected_version,
    requested_step_expected_version, btrim(requested_idempotency_key), correlation_id
  );
  result_json := action_result || jsonb_build_object(
    'adapterKey','INTERNAL_TRANSFER_ORGANIZATION',
    'organizationPlacementId',placement_id,
    'preview',preview,
    'writesPerformed',true,
    'correlationId',correlation_id
  );
  insert into public.process_domain_commits (
    tenant_id, hr_group_id, process_instance_id, work_item_id, adapter_key,
    organization_placement_id, correlation_id, idempotency_key, result, created_by_user_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id, 'INTERNAL_TRANSFER_ORGANIZATION',
    placement_id, correlation_id, btrim(requested_idempotency_key), result_json, actor_id
  );
  return result_json;
end;
$$;

create or replace function public.commit_internal_transfer(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.commit_internal_transfer(
    requested_work_item_id, requested_expected_version, requested_step_expected_version,
    requested_idempotency_key, requested_correlation_id
  );
$$;

create or replace function internal_security.request_process_work_item_changes(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.process_work_items%rowtype;
  instance_row public.process_instances%rowtype;
  note_row public.process_work_item_notes%rowtype;
  action_result jsonb;
  actor_id uuid := auth.uid();
  correlation_id uuid;
begin
  if actor_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if length(btrim(coalesce(requested_body,''))) < 1 then raise exception 'REQUEST_CHANGES_REASON_REQUIRED' using errcode = '22023'; end if;
  select item.* into item_row from public.process_work_items item where item.id = requested_work_item_id;
  if item_row.id is null then raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  select instance.* into instance_row from public.process_instances instance where instance.id = item_row.process_instance_id;
  if instance_row.id is null then raise exception 'PROCESS_INSTANCE_NOT_FOUND' using errcode = 'P0002'; end if;
  correlation_id := coalesce(requested_correlation_id, instance_row.correlation_id);
  action_result := internal_security.perform_process_work_item_action(
    requested_work_item_id, 'REQUEST_CHANGES', requested_expected_version,
    requested_step_expected_version, btrim(requested_idempotency_key), correlation_id
  );
  insert into public.process_work_item_notes (
    tenant_id, hr_group_id, process_instance_id, work_item_id, action, body, actor_user_id, correlation_id
  ) values (
    instance_row.tenant_id, instance_row.hr_group_id, instance_row.id, item_row.id,
    'REQUEST_CHANGES', btrim(requested_body), actor_id, correlation_id
  ) returning * into note_row;
  insert into public.audit_logs (
    tenant_id, entity_id, entity_name, actor_user_id, action, changes, correlation_id
  ) values (
    instance_row.tenant_id, note_row.id, 'process_work_item_note', actor_id, 'CREATE',
    jsonb_build_object('workItemId', item_row.id, 'action', 'REQUEST_CHANGES'), correlation_id
  );
  return action_result || jsonb_build_object('noteId', note_row.id, 'correlationId', correlation_id);
end;
$$;

create or replace function public.request_process_work_item_changes(
  requested_work_item_id uuid,
  requested_expected_version bigint,
  requested_step_expected_version bigint,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_body text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.request_process_work_item_changes(
    requested_work_item_id, requested_expected_version, requested_step_expected_version,
    requested_idempotency_key, requested_correlation_id, requested_body
  );
$$;

revoke all on function internal_security.get_process_recipe_catalog_internal() from public, anon, authenticated;
revoke all on function internal_security.activate_process_recipe_internal(uuid, uuid, uuid, public.access_scope_type, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.get_process_recipe_start_context_internal(uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.internal_transfer_projection(uuid) from public, anon, authenticated;
revoke all on function internal_security.commit_internal_transfer(uuid, bigint, bigint, text, uuid) from public, anon, authenticated;
revoke all on function internal_security.request_process_work_item_changes(uuid, bigint, bigint, text, uuid, text) from public, anon, authenticated;

revoke all on function public.get_process_recipe_catalog() from public, anon;
revoke all on function public.activate_process_recipe(uuid, uuid, uuid, public.access_scope_type, uuid, text) from public, anon;
revoke all on function public.get_process_recipe_start_context(uuid, uuid, text) from public, anon;
revoke all on function public.get_internal_transfer_preview(uuid) from public, anon;
revoke all on function public.commit_internal_transfer(uuid, bigint, bigint, text, uuid) from public, anon;
revoke all on function public.request_process_work_item_changes(uuid, bigint, bigint, text, uuid, text) from public, anon;

grant execute on function public.get_process_recipe_catalog() to authenticated;
grant execute on function public.activate_process_recipe(uuid, uuid, uuid, public.access_scope_type, uuid, text) to authenticated;
grant execute on function public.get_process_recipe_start_context(uuid, uuid, text) to authenticated;
grant execute on function public.get_internal_transfer_preview(uuid) to authenticated;
grant execute on function public.commit_internal_transfer(uuid, bigint, bigint, text, uuid) to authenticated;
grant execute on function public.request_process_work_item_changes(uuid, bigint, bigint, text, uuid, text) to authenticated;

comment on table public.process_recipe_catalog is 'P9 immutable catalogue of certified, versioned process starters.';
comment on table public.process_recipe_activations is 'P9 tenant activation links a certified recipe to an independent process draft.';
comment on table public.process_domain_commits is 'P9 idempotent domain adapter commits correlated with a process instance.';
comment on function public.get_internal_transfer_preview(uuid) is 'P9 read-only HR validation and current/new organization-placement preview.';
comment on function public.commit_internal_transfer(uuid, bigint, bigint, text, uuid) is 'P9 atomic, idempotent HR commit through the existing organization placement write path.';

commit;
