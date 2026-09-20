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


commit;