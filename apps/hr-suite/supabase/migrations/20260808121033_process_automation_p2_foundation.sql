begin;

create type public.process_definition_status as enum ('DRAFT', 'PUBLISHED', 'RETIRED');
create type public.process_instance_status as enum (
  'DRAFT', 'RUNNING', 'WAITING', 'BLOCKED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'
);
create type public.process_step_instance_status as enum (
  'PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'REJECTED', 'CANCELLED'
);
create type public.process_work_item_status as enum (
  'OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'BLOCKED'
);
create type public.process_assignment_mode as enum ('EXACTLY_ONE', 'ANY_ONE', 'ALL');

create table public.process_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  scope_type public.access_scope_type not null default 'TENANT',
  administration_id uuid,
  key text not null,
  title jsonb not null,
  description jsonb,
  status public.process_definition_status not null default 'DRAFT',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_definitions_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint process_definitions_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_definitions_scope_check check (
    (scope_type = 'TENANT' and administration_id is null)
    or (scope_type = 'ADMINISTRATION' and administration_id is not null)
  ),
  constraint process_definitions_key_check check (key ~ '^[a-z][a-z0-9_-]*$'),
  constraint process_definitions_title_object_check check (jsonb_typeof(title) = 'object'),
  constraint process_definitions_tenant_hr_group_key unique (tenant_id, hr_group_id, key),
  constraint process_definitions_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id)
);

create table public.process_definition_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_definition_id uuid not null,
  revision integer not null,
  definition_json jsonb not null,
  validation_report jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_definition_drafts_definition_fkey
    foreign key (tenant_id, hr_group_id, process_definition_id)
    references public.process_definitions(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_definition_drafts_revision_check check (revision > 0),
  constraint process_definition_drafts_json_object_check check (jsonb_typeof(definition_json) = 'object'),
  constraint process_definition_drafts_tenant_definition_revision_key
    unique (tenant_id, hr_group_id, process_definition_id, revision)
);

create table public.process_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_definition_id uuid not null,
  version_number integer not null,
  schema_version integer not null,
  compiler_version text not null,
  definition_json jsonb not null,
  definition_hash text not null,
  published_by_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_versions_definition_fkey
    foreign key (tenant_id, hr_group_id, process_definition_id)
    references public.process_definitions(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_versions_version_check check (version_number > 0 and schema_version > 0),
  constraint process_versions_json_object_check check (jsonb_typeof(definition_json) = 'object'),
  constraint process_versions_hash_check check (definition_hash ~ '^[0-9a-f]{64}$'),
  constraint process_versions_tenant_definition_version_key
    unique (tenant_id, hr_group_id, process_definition_id, version_number),
  constraint process_versions_tenant_definition_id_key
    unique (tenant_id, hr_group_id, process_definition_id, id)
);

create table public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  scope_type public.access_scope_type not null default 'TENANT',
  administration_id uuid,
  key text not null,
  title jsonb not null,
  description jsonb,
  status public.process_definition_status not null default 'DRAFT',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint form_definitions_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint form_definitions_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint form_definitions_scope_check check (
    (scope_type = 'TENANT' and administration_id is null)
    or (scope_type = 'ADMINISTRATION' and administration_id is not null)
  ),
  constraint form_definitions_key_check check (key ~ '^[a-z][a-z0-9_-]*$'),
  constraint form_definitions_title_object_check check (jsonb_typeof(title) = 'object'),
  constraint form_definitions_tenant_hr_group_key unique (tenant_id, hr_group_id, key),
  constraint form_definitions_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id)
);

create table public.form_definition_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  form_definition_id uuid not null,
  revision integer not null,
  definition_json jsonb not null,
  validation_report jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint form_definition_drafts_definition_fkey
    foreign key (tenant_id, hr_group_id, form_definition_id)
    references public.form_definitions(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint form_definition_drafts_revision_check check (revision > 0),
  constraint form_definition_drafts_json_object_check check (jsonb_typeof(definition_json) = 'object'),
  constraint form_definition_drafts_tenant_definition_revision_key
    unique (tenant_id, hr_group_id, form_definition_id, revision)
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  form_definition_id uuid not null,
  version_number integer not null,
  schema_version integer not null,
  compiler_version text not null,
  definition_json jsonb not null,
  definition_hash text not null,
  published_by_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint form_versions_definition_fkey
    foreign key (tenant_id, hr_group_id, form_definition_id)
    references public.form_definitions(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint form_versions_version_check check (version_number > 0 and schema_version > 0),
  constraint form_versions_json_object_check check (jsonb_typeof(definition_json) = 'object'),
  constraint form_versions_hash_check check (definition_hash ~ '^[0-9a-f]{64}$'),
  constraint form_versions_tenant_definition_version_key
    unique (tenant_id, hr_group_id, form_definition_id, version_number),
  constraint form_versions_tenant_definition_id_key
    unique (tenant_id, hr_group_id, form_definition_id, id)
);

create table public.process_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  scope_type public.access_scope_type not null,
  administration_id uuid,
  process_definition_id uuid not null,
  process_version_id uuid not null,
  status public.process_instance_status not null default 'DRAFT',
  initiator_user_id uuid not null references auth.users(id) on delete restrict,
  initiator_employee_id uuid,
  business_effective_date date,
  current_step_key text,
  instance_version bigint not null default 1,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_instances_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint process_instances_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_instances_definition_fkey
    foreign key (tenant_id, hr_group_id, process_definition_id)
    references public.process_definitions(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_instances_pinned_version_fkey
    foreign key (tenant_id, hr_group_id, process_definition_id, process_version_id)
    references public.process_versions(tenant_id, hr_group_id, process_definition_id, id)
    on delete restrict,
  constraint process_instances_initiator_employee_fkey
    foreign key (tenant_id, hr_group_id, initiator_employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_instances_scope_check check (
    (scope_type = 'TENANT' and administration_id is null)
    or (scope_type = 'ADMINISTRATION' and administration_id is not null)
  ),
  constraint process_instances_version_check check (instance_version > 0),
  constraint process_instances_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint process_instances_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id),
  constraint process_instances_tenant_hr_group_admin_id_key
    unique (tenant_id, hr_group_id, administration_id, id),
  constraint process_instances_tenant_hr_group_id_version_key
    unique (tenant_id, hr_group_id, id, process_version_id)
);

create table public.process_employee_subjects (
  process_instance_id uuid primary key,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  employee_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_employee_subjects_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_employee_subjects_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_employee_subjects_instance_employee_key
    unique (tenant_id, hr_group_id, process_instance_id, employee_id)
);

create unique index if not exists employments_tenant_hr_group_administration_id_key
  on public.employments (tenant_id, hr_group_id, administration_id, id);

create table public.process_employment_subjects (
  process_instance_id uuid primary key,
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  employment_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_employment_subjects_instance_fkey
    foreign key (tenant_id, hr_group_id, administration_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, administration_id, id)
    on delete cascade,
  constraint process_employment_subjects_employment_fkey
    foreign key (tenant_id, hr_group_id, administration_id, employment_id)
    references public.employments(tenant_id, hr_group_id, administration_id, id)
    on delete restrict
);

create table public.process_step_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_instance_id uuid not null,
  process_version_id uuid not null,
  step_key text not null,
  activation_number integer not null default 1,
  status public.process_step_instance_status not null default 'PENDING',
  activated_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  blocked_code text,
  expected_version bigint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_step_instances_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id, process_version_id)
    references public.process_instances(tenant_id, hr_group_id, id, process_version_id)
    on delete cascade,
  constraint process_step_instances_step_check check (step_key ~ '^[a-z][a-z0-9_-]*$'),
  constraint process_step_instances_activation_check check (activation_number > 0),
  constraint process_step_instances_expected_version_check check (expected_version > 0),
  constraint process_step_instances_tenant_instance_step_key
    unique (tenant_id, hr_group_id, process_instance_id, step_key, activation_number),
  constraint process_step_instances_tenant_instance_id_key
    unique (tenant_id, hr_group_id, process_instance_id, id)
);

create table public.process_work_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_instance_id uuid not null,
  step_instance_id uuid not null,
  process_version_id uuid not null,
  step_key text not null,
  participant_key text not null,
  assignment_mode public.process_assignment_mode not null,
  status public.process_work_item_status not null default 'OPEN',
  assignee_employee_id uuid,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  available_at timestamptz not null default timezone('utc', now()),
  deadline_at timestamptz,
  expected_version bigint not null default 1,
  allow_self_assignment boolean not null default false,
  blocked_code text,
  assignment_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_work_items_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_work_items_step_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id, step_instance_id)
    references public.process_step_instances(tenant_id, hr_group_id, process_instance_id, id)
    on delete cascade,
  constraint process_work_items_version_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id, process_version_id)
    references public.process_instances(tenant_id, hr_group_id, id, process_version_id)
    on delete restrict,
  constraint process_work_items_assignee_employee_fkey
    foreign key (tenant_id, hr_group_id, assignee_employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_work_items_step_check check (step_key ~ '^[a-z][a-z0-9_-]*$'),
  constraint process_work_items_participant_check check (participant_key ~ '^[a-z][a-z0-9_-]*$'),
  constraint process_work_items_expected_version_check check (expected_version > 0),
  constraint process_work_items_snapshot_object_check check (jsonb_typeof(assignment_snapshot) = 'object'),
  constraint process_work_items_tenant_hr_group_id_key unique (tenant_id, hr_group_id, id)
);

create table public.process_work_item_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  work_item_id uuid not null,
  employee_id uuid not null,
  candidate_user_id uuid references auth.users(id) on delete set null,
  management_role_id uuid references public.management_roles(id) on delete set null,
  management_role_code text,
  resolution_revision integer not null default 1,
  resolution_policy text not null,
  resolution_date date not null,
  resolution_source text not null,
  source_department_id uuid,
  ancestor_path jsonb not null default '[]'::jsonb,
  is_eligible boolean not null,
  ineligible_reason text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_work_item_candidates_work_item_fkey
    foreign key (tenant_id, hr_group_id, work_item_id)
    references public.process_work_items(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_work_item_candidates_employee_fkey
    foreign key (tenant_id, hr_group_id, employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint process_work_item_candidates_role_fkey
    foreign key (management_role_id)
    references public.management_roles(id)
    on delete set null,
  constraint process_work_item_candidates_revision_check check (resolution_revision > 0),
  constraint process_work_item_candidates_policy_check check (
    resolution_policy in ('STEP_ACTIVATED_AT', 'PROCESS_STARTED_AT', 'BUSINESS_EFFECTIVE_DATE', 'FIXED_DATE_FIELD', 'SNAPSHOT_AT_START')
  ),
  constraint process_work_item_candidates_source_check check (resolution_source <> ''),
  constraint process_work_item_candidates_ancestor_array_check check (jsonb_typeof(ancestor_path) = 'array'),
  constraint process_work_item_candidates_evidence_object_check check (jsonb_typeof(evidence) = 'object'),
  constraint process_work_item_candidates_work_item_employee_revision_key
    unique (tenant_id, hr_group_id, work_item_id, employee_id, resolution_revision)
);

create table public.process_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  process_instance_id uuid not null,
  work_item_id uuid,
  sequence_number bigint not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_employee_id uuid,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint process_events_instance_fkey
    foreign key (tenant_id, hr_group_id, process_instance_id)
    references public.process_instances(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint process_events_work_item_fkey
    foreign key (tenant_id, hr_group_id, work_item_id)
    references public.process_work_items(tenant_id, hr_group_id, id)
    on delete set null,
  constraint process_events_actor_employee_fkey
    foreign key (tenant_id, hr_group_id, actor_employee_id)
    references public.employees(tenant_id, hr_group_id, id)
    on delete set null,
  constraint process_events_sequence_check check (sequence_number > 0),
  constraint process_events_event_type_check check (event_type <> ''),
  constraint process_events_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create unique index process_events_instance_sequence_key
  on public.process_events (tenant_id, hr_group_id, process_instance_id, sequence_number);
create unique index process_events_instance_idempotency_key
  on public.process_events (tenant_id, hr_group_id, process_instance_id, idempotency_key);

create index process_definitions_scope_lookup_idx
  on public.process_definitions (tenant_id, hr_group_id, scope_type, administration_id, status);
create index process_definition_drafts_definition_lookup_idx
  on public.process_definition_drafts (tenant_id, hr_group_id, process_definition_id, revision desc);
create index process_versions_definition_lookup_idx
  on public.process_versions (tenant_id, hr_group_id, process_definition_id, version_number desc);
create index form_definitions_scope_lookup_idx
  on public.form_definitions (tenant_id, hr_group_id, scope_type, administration_id, status);
create index form_definition_drafts_definition_lookup_idx
  on public.form_definition_drafts (tenant_id, hr_group_id, form_definition_id, revision desc);
create index form_versions_definition_lookup_idx
  on public.form_versions (tenant_id, hr_group_id, form_definition_id, version_number desc);
create index process_instances_active_lookup_idx
  on public.process_instances (tenant_id, hr_group_id, status, updated_at desc)
  where status in ('RUNNING', 'WAITING', 'BLOCKED');
create index process_instances_scope_subject_lookup_idx
  on public.process_instances (tenant_id, hr_group_id, scope_type, administration_id, initiator_employee_id);
create index process_step_instances_active_lookup_idx
  on public.process_step_instances (tenant_id, hr_group_id, status, deadline_at)
  where status in ('ACTIVE', 'BLOCKED');
create index process_work_items_queue_lookup_idx
  on public.process_work_items (tenant_id, hr_group_id, status, available_at, deadline_at)
  where status in ('OPEN', 'CLAIMED', 'BLOCKED');
create index process_work_items_assignee_lookup_idx
  on public.process_work_items (tenant_id, hr_group_id, assignee_employee_id, status);
create index process_work_item_candidates_employee_lookup_idx
  on public.process_work_item_candidates (tenant_id, hr_group_id, employee_id, is_eligible);
create index process_events_instance_lookup_idx
  on public.process_events (tenant_id, hr_group_id, process_instance_id, sequence_number desc);
create index process_events_type_lookup_idx
  on public.process_events (tenant_id, hr_group_id, event_type, created_at desc);

create or replace function internal_security.process_scope_has_permission(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_scope_type public.access_scope_type,
  requested_administration_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when requested_scope_type = 'TENANT'::public.access_scope_type then
      internal_security.current_user_has_hr_group_permission(
        requested_tenant_id, requested_hr_group_id, requested_permission_code
      )
    when requested_scope_type = 'ADMINISTRATION'::public.access_scope_type then
      requested_administration_id is not null
      and internal_security.current_user_has_permission(
        requested_tenant_id, requested_administration_id, requested_permission_code
      )
    else false
  end;
$$;

revoke all on function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
  from public, anon, authenticated;
grant usage on schema internal_security to authenticated;
grant execute on function internal_security.process_scope_has_permission(uuid, uuid, public.access_scope_type, uuid, text)
  to authenticated;

create or replace function internal_security.prevent_process_immutable_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'PROCESS_PUBLISHED_VERSION_IMMUTABLE' using errcode = '23514';
end;
$$;

revoke all on function internal_security.prevent_process_immutable_version_mutation() from public, anon, authenticated;

create or replace function internal_security.prevent_process_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'PROCESS_APPEND_ONLY_RECORD_IMMUTABLE' using errcode = '23514';
end;
$$;

revoke all on function internal_security.prevent_process_append_only_mutation() from public, anon, authenticated;

create trigger process_versions_immutable
before update or delete on public.process_versions
for each row execute function internal_security.prevent_process_immutable_version_mutation();
create trigger form_versions_immutable
before update or delete on public.form_versions
for each row execute function internal_security.prevent_process_immutable_version_mutation();
create trigger process_events_append_only
before update or delete on public.process_events
for each row execute function internal_security.prevent_process_append_only_mutation();
create trigger process_work_item_candidates_append_only
before update or delete on public.process_work_item_candidates
for each row execute function internal_security.prevent_process_append_only_mutation();

create trigger process_definitions_updated_at
before update on public.process_definitions
for each row execute function internal_security.set_updated_at();
create trigger process_definition_drafts_updated_at
before update on public.process_definition_drafts
for each row execute function internal_security.set_updated_at();
create trigger form_definitions_updated_at
before update on public.form_definitions
for each row execute function internal_security.set_updated_at();
create trigger form_definition_drafts_updated_at
before update on public.form_definition_drafts
for each row execute function internal_security.set_updated_at();
create trigger process_instances_updated_at
before update on public.process_instances
for each row execute function internal_security.set_updated_at();
create trigger process_step_instances_updated_at
before update on public.process_step_instances
for each row execute function internal_security.set_updated_at();
create trigger process_work_items_updated_at
before update on public.process_work_items
for each row execute function internal_security.set_updated_at();

create trigger audit_process_definitions
after insert or update or delete on public.process_definitions
for each row execute function internal_security.audit_configuration_change('process_definition');
create trigger audit_process_definition_drafts
after insert or update or delete on public.process_definition_drafts
for each row execute function internal_security.audit_configuration_change('process_definition_draft');
create trigger audit_form_definitions
after insert or update or delete on public.form_definitions
for each row execute function internal_security.audit_configuration_change('form_definition');
create trigger audit_form_definition_drafts
after insert or update or delete on public.form_definition_drafts
for each row execute function internal_security.audit_configuration_change('form_definition_draft');

create or replace function internal_security.process_instance_can_read(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with instance_row as (
    select instance.scope_type, instance.administration_id, instance.initiator_employee_id
    from public.process_instances instance
    where instance.tenant_id = requested_tenant_id
      and instance.hr_group_id = requested_hr_group_id
      and instance.id = requested_instance_id
  ), actor as (
    select internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id) as employee_id
  )
  select exists (
    select 1
    from instance_row instance
    where internal_security.process_scope_has_permission(
      requested_tenant_id, requested_hr_group_id, instance.scope_type, instance.administration_id,
      'process-instance:read'
    )
  )
  or exists (
    select 1
    from instance_row instance
    cross join actor
    where internal_security.process_scope_has_permission(
      requested_tenant_id, requested_hr_group_id, instance.scope_type, instance.administration_id,
      'self:process-instance:read'
    )
    and (
      instance.initiator_employee_id = actor.employee_id
      or exists (
        select 1
        from public.process_employee_subjects subject
        where subject.tenant_id = requested_tenant_id
          and subject.hr_group_id = requested_hr_group_id
          and subject.process_instance_id = requested_instance_id
          and subject.employee_id = actor.employee_id
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
          and subject.process_instance_id = requested_instance_id
          and employment.employee_id = actor.employee_id
      )
    )
  );
$$;

revoke all on function internal_security.process_instance_can_read(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.process_instance_can_read(uuid, uuid, uuid) to authenticated;

create or replace function internal_security.process_work_item_can_read(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_work_item_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with work_item as (
    select item.process_instance_id, instance.scope_type, instance.administration_id
    from public.process_work_items item
    join public.process_instances instance
      on instance.tenant_id = item.tenant_id
     and instance.hr_group_id = item.hr_group_id
     and instance.id = item.process_instance_id
    where item.tenant_id = requested_tenant_id
      and item.hr_group_id = requested_hr_group_id
      and item.id = requested_work_item_id
  ), actor as (
    select internal_security.current_employee_id(requested_tenant_id, requested_hr_group_id) as employee_id
  )
  select exists (
    select 1 from work_item item
    where internal_security.process_scope_has_permission(
      requested_tenant_id, requested_hr_group_id, item.scope_type, item.administration_id,
      'process-task:read'
    )
  )
  or exists (
    select 1 from work_item item
    where internal_security.process_instance_can_read(
      requested_tenant_id, requested_hr_group_id, item.process_instance_id
    )
  )
  or exists (
    select 1
    from work_item item
    cross join actor
    join public.process_work_item_candidates candidate
      on candidate.tenant_id = requested_tenant_id
     and candidate.hr_group_id = requested_hr_group_id
     and candidate.work_item_id = requested_work_item_id
     and candidate.employee_id = actor.employee_id
     and candidate.is_eligible
    where internal_security.process_scope_has_permission(
      requested_tenant_id, requested_hr_group_id, item.scope_type, item.administration_id,
      'self:process-task:read'
    )
  );
$$;

revoke all on function internal_security.process_work_item_can_read(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function internal_security.process_work_item_can_read(uuid, uuid, uuid) to authenticated;

alter table public.process_definitions enable row level security;
alter table public.process_definition_drafts enable row level security;
alter table public.process_versions enable row level security;
alter table public.form_definitions enable row level security;
alter table public.form_definition_drafts enable row level security;
alter table public.form_versions enable row level security;
alter table public.process_instances enable row level security;
alter table public.process_employee_subjects enable row level security;
alter table public.process_employment_subjects enable row level security;
alter table public.process_step_instances enable row level security;
alter table public.process_work_items enable row level security;
alter table public.process_work_item_candidates enable row level security;
alter table public.process_events enable row level security;

create policy process_definitions_select_scoped
on public.process_definitions for select to authenticated
using (
  (select internal_security.process_scope_has_permission(tenant_id, hr_group_id, scope_type, administration_id, 'process-definition:read'))
  or (select internal_security.process_scope_has_permission(tenant_id, hr_group_id, scope_type, administration_id, 'process-definition:write'))
  or (select internal_security.process_scope_has_permission(tenant_id, hr_group_id, scope_type, administration_id, 'process-definition:publish'))
);
create policy process_definition_drafts_select_scoped
on public.process_definition_drafts for select to authenticated
using (
  exists (
    select 1 from public.process_definitions definition
    where definition.tenant_id = process_definition_drafts.tenant_id
      and definition.hr_group_id = process_definition_drafts.hr_group_id
      and definition.id = process_definition_drafts.process_definition_id
      and (
        internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'process-definition:read')
        or internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'process-definition:write')
      )
  )
);
create policy process_versions_select_scoped
on public.process_versions for select to authenticated
using (
  exists (
    select 1 from public.process_definitions definition
    where definition.tenant_id = process_versions.tenant_id
      and definition.hr_group_id = process_versions.hr_group_id
      and definition.id = process_versions.process_definition_id
      and (
        internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'process-definition:read')
        or internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'process-instance:read')
      )
  )
);

create policy form_definitions_select_scoped
on public.form_definitions for select to authenticated
using (
  (select internal_security.process_scope_has_permission(tenant_id, hr_group_id, scope_type, administration_id, 'form-definition:read'))
  or (select internal_security.process_scope_has_permission(tenant_id, hr_group_id, scope_type, administration_id, 'form-definition:write'))
  or (select internal_security.process_scope_has_permission(tenant_id, hr_group_id, scope_type, administration_id, 'form-definition:publish'))
);
create policy form_definition_drafts_select_scoped
on public.form_definition_drafts for select to authenticated
using (
  exists (
    select 1 from public.form_definitions definition
    where definition.tenant_id = form_definition_drafts.tenant_id
      and definition.hr_group_id = form_definition_drafts.hr_group_id
      and definition.id = form_definition_drafts.form_definition_id
      and (
        internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'form-definition:read')
        or internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'form-definition:write')
      )
  )
);
create policy form_versions_select_scoped
on public.form_versions for select to authenticated
using (
  exists (
    select 1 from public.form_definitions definition
    where definition.tenant_id = form_versions.tenant_id
      and definition.hr_group_id = form_versions.hr_group_id
      and definition.id = form_versions.form_definition_id
      and (
        internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'form-definition:read')
        or internal_security.process_scope_has_permission(definition.tenant_id, definition.hr_group_id, definition.scope_type, definition.administration_id, 'process-instance:read')
      )
  )
);

create policy process_instances_select_scoped
on public.process_instances for select to authenticated
using ((select internal_security.process_instance_can_read(tenant_id, hr_group_id, id)));
create policy process_employee_subjects_select_scoped
on public.process_employee_subjects for select to authenticated
using ((select internal_security.process_instance_can_read(tenant_id, hr_group_id, process_instance_id)));
create policy process_employment_subjects_select_scoped
on public.process_employment_subjects for select to authenticated
using ((select internal_security.process_instance_can_read(tenant_id, hr_group_id, process_instance_id)));
create policy process_step_instances_select_scoped
on public.process_step_instances for select to authenticated
using ((select internal_security.process_instance_can_read(tenant_id, hr_group_id, process_instance_id)));
create policy process_work_items_select_scoped
on public.process_work_items for select to authenticated
using ((select internal_security.process_work_item_can_read(tenant_id, hr_group_id, id)));
create policy process_work_item_candidates_select_scoped
on public.process_work_item_candidates for select to authenticated
using ((select internal_security.process_work_item_can_read(tenant_id, hr_group_id, work_item_id)));
create policy process_events_select_scoped
on public.process_events for select to authenticated
using ((select internal_security.process_instance_can_read(tenant_id, hr_group_id, process_instance_id)));

revoke all on table public.process_definitions,
  public.process_definition_drafts,
  public.process_versions,
  public.form_definitions,
  public.form_definition_drafts,
  public.form_versions,
  public.process_instances,
  public.process_employee_subjects,
  public.process_employment_subjects,
  public.process_step_instances,
  public.process_work_items,
  public.process_work_item_candidates,
  public.process_events
from public, anon;

grant select on table public.process_definitions,
  public.process_definition_drafts,
  public.process_versions,
  public.form_definitions,
  public.form_definition_drafts,
  public.form_versions,
  public.process_instances,
  public.process_employee_subjects,
  public.process_employment_subjects,
  public.process_step_instances,
  public.process_work_items,
  public.process_work_item_candidates,
  public.process_events
to authenticated;

insert into public.permissions (code, name, description, category)
values
  ('process-definition:read', 'Procesdefinities lezen', 'Procesdefinities en gepubliceerde versies bekijken.', 'Workflow & formulieren'),
  ('process-definition:write', 'Procesdefinities wijzigen', 'Procesdefinities als concept beheren.', 'Workflow & formulieren'),
  ('process-definition:publish', 'Procesdefinities publiceren', 'Een gevalideerde procesversie publiceren.', 'Workflow & formulieren'),
  ('form-definition:read', 'Formulierdefinities lezen', 'Formulierdefinities en gepubliceerde versies bekijken.', 'Workflow & formulieren'),
  ('form-definition:write', 'Formulierdefinities wijzigen', 'Formulierdefinities als concept beheren.', 'Workflow & formulieren'),
  ('form-definition:publish', 'Formulierdefinities publiceren', 'Een gevalideerde formulierdefinitie publiceren.', 'Workflow & formulieren'),
  ('process-instance:read', 'Procesinstances lezen', 'Procesinstances binnen de toegestane scope bekijken.', 'Workflow & formulieren'),
  ('process-instance:start', 'Procesinstances starten', 'Een gepubliceerd proces starten.', 'Workflow & formulieren'),
  ('process-instance:cancel', 'Procesinstances annuleren', 'Een lopende procesinstance annuleren.', 'Workflow & formulieren'),
  ('process-task:read', 'Proceswerk lezen', 'Werkitems en toewijzingsbewijs bekijken.', 'Workflow & formulieren'),
  ('process-task:act', 'Proceswerk uitvoeren', 'Een toegewezen werkitem claimen en uitvoeren.', 'Workflow & formulieren'),
  ('process-task:reassign', 'Proceswerk herverdelen', 'Een werkitem gecontroleerd herverdelen.', 'Workflow & formulieren'),
  ('process-operations:read', 'Procesoperaties lezen', 'Operationele workflowstatus en blokkades bekijken.', 'Workflow & formulieren'),
  ('process-operations:write', 'Procesoperaties beheren', 'Operationele workflowblokkades en herstelacties beheren.', 'Workflow & formulieren'),
  ('self:process-instance:read', 'Eigen procesinstances lezen', 'Eigen procesinstances bekijken.', 'Workflow & formulieren'),
  ('self:process-instance:start', 'Eigen proces starten', 'Een proces voor jezelf starten.', 'Workflow & formulieren'),
  ('self:process-task:read', 'Eigen proceswerk lezen', 'Eigen werkitems bekijken.', 'Workflow & formulieren'),
  ('self:process-task:act', 'Eigen proceswerk uitvoeren', 'Eigen werkitems claimen en uitvoeren.', 'Workflow & formulieren')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in (
  'process-definition:read', 'process-definition:write', 'process-definition:publish',
  'form-definition:read', 'form-definition:write', 'form-definition:publish',
  'process-instance:read', 'process-instance:start', 'process-instance:cancel',
  'process-task:read', 'process-task:act', 'process-task:reassign',
  'process-operations:read', 'process-operations:write'
)
where role.code = 'TENANT_ADMIN' and role.tenant_id is null
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in ('process-instance:read', 'process-task:read', 'process-task:act')
where role.code = 'DIRECT_MANAGER' and role.tenant_id is null
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
join public.permissions permission on permission.code in (
  'self:process-instance:read', 'self:process-instance:start',
  'self:process-task:read', 'self:process-task:act'
)
where role.code = 'EMPLOYEE' and role.tenant_id is null
on conflict do nothing;

commit;
