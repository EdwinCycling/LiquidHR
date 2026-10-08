-- Alleen lokale synthetische PostgreSQL-tests. Kolommen, enums en niet-FK-constraints uit TEST.
-- Dit is geen volledige Supabase/RLS/trigger-kloon en levert geen JWT-autorisatiebewijs.
create schema extensions;
create extension pgcrypto with schema extensions;
create role anon;
create role authenticated;
create role service_role;
create type public.gender as enum ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
create type public.name_usage as enum ('BIRTH_NAME', 'PARTNER_NAME', 'PARTNER_BEFORE_BIRTH_NAME', 'BIRTH_NAME_BEFORE_PARTNER_NAME');
create type public.marital_status as enum ('SINGLE', 'MARRIED', 'REGISTERED_PARTNERSHIP', 'DIVORCED', 'WIDOWED');
create type public.education_level as enum ('MBO', 'HBO', 'WO', 'HIGHSCHOOL', 'OTHER', 'UNKNOWN');
create type public.employment_type as enum ('EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'TEMPORARY_AGENCY', 'FREELANCER', 'VOLUNTEER', 'NO_PAYROLL');
create type public.contract_type as enum ('INDEFINITE', 'DEFINITE', 'ON_CALL', 'TEMPORARY_AGENCY', 'EXTERNAL', 'TEMPORARY_NO_END');
create type public.employment_record_status as enum ('DRAFT', 'CONFIRMED', 'CANCELLED');
create type public.income_relationship_type as enum ('EMPLOYMENT', 'SOCIAL_BENEFIT', 'OTHER');
create type public.payroll_reporting_status as enum ('DRAFT', 'READY', 'REPORTED', 'CLOSED');
create table public.administration_payroll_tax_numbers (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null, payroll_tax_number text not null, is_primary boolean default false not null, valid_from date default CURRENT_DATE not null, valid_until date, created_by_user_id uuid, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.administrations (id uuid default gen_random_uuid() not null, tenant_id uuid not null, parent_id uuid, code text not null, name text not null, coc_number text, vat_number text, is_active boolean default true not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, hr_group_id uuid not null, administration_number text not null);
create table public.audit_logs (id uuid default gen_random_uuid() not null, tenant_id uuid not null, administration_id uuid, entity_name text not null, entity_id uuid, actor_user_id uuid, action text not null, changes jsonb default '{}'::jsonb not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, subject_employee_id uuid, employment_id uuid, change_set_id uuid, correlation_id uuid, hr_group_id uuid, api_resource_key text, api_client_id text, api_outcome text, api_status_code integer);
create table public.employee_administration_assignments (id uuid default gen_random_uuid() not null, tenant_id uuid not null, administration_id uuid not null, employee_id uuid not null, effective_from date default CURRENT_DATE not null, effective_to date, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, hr_group_id uuid not null);
create table public.employee_number_sequences (tenant_id uuid not null, next_value bigint default 100001 not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.employee_secure_identifiers (id uuid default gen_random_uuid() not null, employee_id uuid not null, tenant_id uuid not null, bsn_ciphertext text, bsn_fingerprint text, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.employees (id uuid default gen_random_uuid() not null, employee_number text not null, title text, initials text, first_name text not null, birth_name_prefix text, birth_name text not null, partner_name_prefix text, partner_name text, name_usage name_usage not null, gender gender not null, pronouns text, birth_date date, birth_place text, birth_country text, nationality text, marital_status marital_status, marital_status_date date, education_level education_level, preferred_language text default 'nl'::text not null, private_email text, private_phone text, private_mobile text, work_email text, work_phone text, work_phone_ext text, work_mobile text, avatar_url text, original_hire_date date, is_active boolean default true not null, custom_fields jsonb default '{}'::jsonb not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, deleted_at timestamp with time zone, tenant_id uuid not null, auth_user_id uuid, is_archived boolean default false not null, hr_group_id uuid not null);
create table public.employment_income_relationships (id uuid default gen_random_uuid() not null, tenant_id uuid not null, administration_id uuid not null, employee_id uuid not null, employment_id uuid not null, income_relationship_id uuid not null, valid_from date not null, valid_until date, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.employments (id uuid default gen_random_uuid() not null, tenant_id uuid not null, administration_id uuid not null, employee_id uuid not null, employment_number text not null, employment_type employment_type default 'EMPLOYEE'::employment_type not null, contract_type contract_type not null, record_status employment_record_status default 'DRAFT'::employment_record_status not null, starts_on date not null, ends_on date, probation_ends_on date, seniority_date date not null, original_hire_date date not null, is_primary boolean default false not null, reason_started text, contract_document_url text, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, deleted_at timestamp with time zone, country_code text default 'NL'::text not null, hr_group_id uuid not null, payroll_import_person_id uuid);
create table public.income_relationships (id uuid default gen_random_uuid() not null, tenant_id uuid not null, administration_id uuid not null, employee_id uuid not null, payroll_tax_subnumber text not null, ikv_number integer not null, relationship_type income_relationship_type default 'EMPLOYMENT'::income_relationship_type not null, starts_on date not null, ends_on date, reporting_status payroll_reporting_status default 'DRAFT'::payroll_reporting_status not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, deleted_at timestamp with time zone, payroll_tax_number text, payroll_tax_binding_hr_group_id uuid, payroll_tax_binding_id uuid);
create table public.payroll_import_batches (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null, source_type text not null, source_filename text not null, source_hash text not null, tax_year integer not null, period_start date, period_end date, payroll_tax_number text, status text default 'ANALYZED'::text not null, idempotency_key text not null, created_by_user_id uuid not null, preview_confirmed_at timestamp with time zone, finalized_at timestamp with time zone, source_deleted_at timestamp with time zone, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_decisions (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null, batch_id uuid not null, import_person_id uuid not null, decision_version integer not null, decision_payload jsonb not null, decision_hash text not null, source_hash text not null, analysis_hash text not null, core_state_hash text not null, contract_version text, schema_version text, confirmer_user_id uuid not null, confirmed_at timestamp with time zone not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_finalization_action_events (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, batch_id uuid not null, action_id text not null, event_key text not null, event_type text not null, actor_user_id uuid not null, attempt_number integer not null, checkpoint jsonb default '{}'::jsonb not null, error_code text, lease_until timestamp with time zone, lease_owner uuid, source_hash text not null, analysis_hash text not null, core_state_hash text not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_finalization_actions (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null, batch_id uuid not null, plan_id uuid not null, import_person_id uuid not null, decision_id uuid not null, sequence_no integer not null, action_id text not null, idempotency_key text not null, source_person_ref text not null, source_income_ref text, target_employee_id uuid, target_employee_ref text, target_employment_id uuid, target_employment_ref text, target_income_relationship_id uuid, action_type text not null, source_payroll_tax_number text, source_ikv_number integer, source_starts_on date, source_ends_on date, source_refs jsonb default '[]'::jsonb not null, preconditions jsonb default '[]'::jsonb not null, depends_on_action_ids text[] default '{}'::text[] not null, plan_hash text not null, decision_hash text not null, source_hash text not null, analysis_hash text not null, core_state_hash text not null, contract_version text, schema_version text, status text default 'PENDING'::text not null, attempt_count integer default 0 not null, lease_until timestamp with time zone, lease_owner uuid, lease_token_hash text, last_attempt_at timestamp with time zone, completed_at timestamp with time zone, last_error_code text, checkpoint jsonb default '{}'::jsonb not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null, draft_employment_contract_type text, draft_employment_starts_on date, draft_employment_seniority_date date, draft_employment_original_hire_date date);
create table public.payroll_import_finalization_plans (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null, batch_id uuid not null, plan_hash text not null, source_hash text not null, analysis_hash text not null, core_state_hash text not null, contract_version text, schema_version text, expected_action_count integer not null, completed_action_count integer default 0 not null, status text default 'PENDING'::text not null, created_by_user_id uuid not null, invalidated_by_user_id uuid, invalidation_reason text, invalidated_at timestamp with time zone, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_income_relationships (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, batch_id uuid not null, import_person_id uuid not null, administration_id uuid not null, payroll_tax_number text not null, ikv_number integer not null, income_code text, employment_relation_code text, cao_code text, flags jsonb default '{}'::jsonb not null, hours_per_week numeric(8,2), salary_amount numeric(14,2), starts_on date, ends_on date, status text default 'BLOCKING'::text not null, matched_income_relationship_id uuid, validation_codes jsonb default '[]'::jsonb not null, source_metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_persons (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, batch_id uuid not null, source_row_number integer not null, external_employee_number text, bsn_fingerprint text, initials text, prefix text, first_name text, birth_name text, birth_date date, gender text, nationality text, address jsonb, status text default 'BLOCKING'::text not null, match_status text default 'UNMATCHED'::text not null, matched_employee_id uuid, validation_codes jsonb default '[]'::jsonb not null, source_metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, updated_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_protected_identifiers (tenant_id uuid not null, hr_group_id uuid not null, batch_id uuid not null, import_person_id uuid not null, bsn_fingerprint text not null, bsn_ciphertext text not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
create table public.payroll_import_xml_provenance (id uuid default gen_random_uuid() not null, tenant_id uuid not null, hr_group_id uuid not null, administration_id uuid not null, batch_id uuid not null, source_hash text not null, schema_version text not null, namespace_uri text not null, source_archive_sha256 text not null, xsd_sha256 text not null, release_page_url text not null, xsd_filename text not null, validated_at timestamp with time zone not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null);
CREATE OR REPLACE FUNCTION public.record_payroll_import_finalization_event(requested_tenant_id uuid, requested_hr_group_id uuid, requested_batch_id uuid, requested_action_id text, requested_event_key text, requested_event_type text, requested_actor_user_id uuid, requested_attempt_number integer, requested_source_hash text, requested_analysis_hash text, requested_core_state_hash text, requested_checkpoint jsonb DEFAULT '{}'::jsonb, requested_error_code text DEFAULT NULL::text, requested_lease_until timestamp with time zone DEFAULT NULL::timestamp with time zone, requested_lease_owner uuid DEFAULT NULL::uuid, requested_lease_token_hash text DEFAULT NULL::text)
 RETURNS TABLE(action_id text, status text, attempt_count integer, event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_action record;
  current_plan record;
  existing_event record;
  next_status text;
  next_plan_status text;
  next_attempt_count integer;
  next_lease_until timestamptz;
  next_lease_owner uuid;
  next_lease_token_hash text;
  next_completed_at timestamptz;
  next_error_code text;
  plan_total_count bigint;
  plan_completed_count bigint;
  next_event_id uuid;
begin
  if requested_event_key !~ '^[A-Za-z0-9_.:-]{1,160}$'
    or requested_event_type not in ('PLANNED', 'CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED', 'RETRY', 'RECOVERED', 'BLOCKED')
    or requested_attempt_number < 0
    or requested_source_hash !~ '^[0-9a-f]{64}$'
    or requested_analysis_hash !~ '^[0-9a-f]{64}$'
    or requested_core_state_hash !~ '^[0-9a-f]{64}$'
    or requested_checkpoint is null
    or jsonb_typeof(requested_checkpoint) <> 'object'
    or (requested_lease_token_hash is not null and requested_lease_token_hash !~ '^[0-9a-f]{64}$')
    or ((requested_lease_owner is null) <> (requested_lease_token_hash is null))
    or ((requested_event_type in ('CLAIMED', 'CHECKPOINT', 'COMPLETED', 'FAILED')) <> (requested_lease_owner is not null))
    or (requested_event_type = 'COMPLETED' and (
      jsonb_typeof(requested_checkpoint -> 'completionProof') <> 'object'
      or requested_checkpoint -> 'completionProof' ->> 'readbackVerified' <> 'true'
      or btrim(coalesce(requested_checkpoint -> 'completionProof' ->> 'executionId', '')) = ''
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'readbackHash', '') !~ '^[0-9a-f]{64}$'
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'sourceHash', '') <> requested_source_hash
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'analysisHash', '') <> requested_analysis_hash
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'coreStateHash', '') <> requested_core_state_hash
    ))
    or (requested_error_code is not null and requested_error_code !~ '^[A-Z][A-Z0-9_.:-]{0,63}$') then
    raise exception using
      errcode = '22023',
      message = 'PAYROLL_FINALIZATION_EVENT_INPUT_INVALID';
  end if;

  select *
  into current_action
  from public.payroll_import_finalization_actions
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and batch_id = requested_batch_id
    and payroll_import_finalization_actions.action_id = requested_action_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_ACTION_NOT_FOUND';
  end if;

  select *
  into current_plan
  from public.payroll_import_finalization_plans
  where id = current_action.plan_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND';
  end if;

  if current_plan.status = 'INVALIDATED' then
    raise exception using
      errcode = '40901',
      message = 'PAYROLL_FINALIZATION_PLAN_INVALIDATED';
  end if;

  if current_action.source_hash <> requested_source_hash
    or current_action.analysis_hash <> requested_analysis_hash
    or current_action.core_state_hash <> requested_core_state_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_STATE_HASH_MISMATCH';
  end if;

  if current_plan.source_hash <> requested_source_hash
    or current_plan.analysis_hash <> requested_analysis_hash
    or current_plan.core_state_hash <> requested_core_state_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_STATE_HASH_MISMATCH';
  end if;

  if current_action.plan_hash <> current_plan.plan_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_IDENTITY_MISMATCH';
  end if;

  select count(*)::bigint,
    count(*) filter (where payroll_import_finalization_actions.status = 'COMPLETED')::bigint
  into plan_total_count, plan_completed_count
  from public.payroll_import_finalization_actions
  where plan_id = current_plan.id;

  if plan_total_count > current_plan.expected_action_count
    or plan_completed_count > current_plan.expected_action_count then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_ACTION_COUNT_INVALID';
  end if;

  select *
  into existing_event
  from public.payroll_import_finalization_action_events
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and batch_id = requested_batch_id
    and payroll_import_finalization_action_events.action_id = requested_action_id
    and event_key = requested_event_key;

  if found then
    if existing_event.event_type <> requested_event_type
      or existing_event.actor_user_id <> requested_actor_user_id
      or existing_event.attempt_number <> requested_attempt_number
      or existing_event.lease_owner is distinct from requested_lease_owner
      or existing_event.lease_until is distinct from requested_lease_until
      or existing_event.source_hash <> requested_source_hash
      or existing_event.analysis_hash <> requested_analysis_hash
      or existing_event.core_state_hash <> requested_core_state_hash
      or existing_event.checkpoint is distinct from requested_checkpoint
      or existing_event.error_code is distinct from requested_error_code then
      raise exception using
        errcode = '23505',
        message = 'PAYROLL_FINALIZATION_EVENT_KEY_REUSED';
    end if;

    if requested_event_type = 'CLAIMED'
      and (current_action.status <> 'IN_PROGRESS'
        or current_action.attempt_count <> requested_attempt_number
        or current_action.lease_owner is distinct from requested_lease_owner
        or current_action.lease_token_hash is distinct from requested_lease_token_hash
        or current_action.lease_until is distinct from requested_lease_until
        or current_action.lease_until <= timezone('utc', now())) then
      raise exception using
        errcode = '40901',
        message = 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE';
    end if;

    return query
    select current_action.action_id, current_action.status, current_action.attempt_count, existing_event.id;
    return;
  end if;

  next_status := current_action.status;
  next_attempt_count := current_action.attempt_count;
  next_lease_until := current_action.lease_until;
  next_lease_owner := current_action.lease_owner;
  next_lease_token_hash := current_action.lease_token_hash;
  next_completed_at := current_action.completed_at;
  next_error_code := current_action.last_error_code;

  if requested_event_type = 'PLANNED' then
    if current_action.status <> 'PENDING'
      or current_plan.status <> 'PENDING'
      or plan_total_count <> current_plan.expected_action_count
      or requested_attempt_number <> 0
      or requested_lease_until is not null
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EVENT_STATE_CONFLICT';
    end if;
    next_status := 'PENDING';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := null;
  elsif requested_event_type = 'CLAIMED' then
    if current_action.status <> 'PENDING'
      or current_plan.status not in ('PENDING', 'IN_PROGRESS')
      or plan_total_count <> current_plan.expected_action_count
      or requested_attempt_number <> current_action.attempt_count + 1
      or requested_lease_until is null
      or requested_lease_owner is null
      or requested_lease_token_hash is null
      or requested_lease_until <= timezone('utc', now()) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE';
    end if;

    if cardinality(current_action.depends_on_action_ids) <> (
      select count(*)::integer
      from public.payroll_import_finalization_actions as dependency
      where dependency.tenant_id = current_action.tenant_id
        and dependency.hr_group_id = current_action.hr_group_id
        and dependency.batch_id = current_action.batch_id
        and dependency.plan_id = current_action.plan_id
        and dependency.import_person_id = current_action.import_person_id
        and dependency.action_id = any(current_action.depends_on_action_ids)
        and dependency.sequence_no < current_action.sequence_no
        and dependency.status = 'COMPLETED'
    ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INCOMPLETE';
    end if;

    next_status := 'IN_PROGRESS';
    next_attempt_count := requested_attempt_number;
    next_lease_until := requested_lease_until;
    next_lease_owner := requested_lease_owner;
    next_lease_token_hash := requested_lease_token_hash;
    next_completed_at := null;
    next_error_code := null;
  elsif requested_event_type = 'CHECKPOINT' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_until is null
      or requested_lease_until <= timezone('utc', now())
      or current_action.lease_until is null
      or current_action.lease_until <= timezone('utc', now())
      or requested_lease_owner is distinct from current_action.lease_owner
      or requested_lease_token_hash is distinct from current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_CHECKPOINT_CONFLICT';
    end if;
    next_lease_until := requested_lease_until;
  elsif requested_event_type = 'COMPLETED' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or plan_total_count <> current_plan.expected_action_count
      or requested_attempt_number <> current_action.attempt_count
      or current_action.lease_until is null
      or current_action.lease_until <= timezone('utc', now())
      or requested_lease_owner is distinct from current_action.lease_owner
      or requested_lease_token_hash is distinct from current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_COMPLETION_CONFLICT';
    end if;
    next_status := 'COMPLETED';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := timezone('utc', now());
    next_error_code := null;
  elsif requested_event_type = 'FAILED' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or requested_attempt_number <> current_action.attempt_count
      or requested_error_code is null
      or current_action.lease_until is null
      or current_action.lease_until <= timezone('utc', now())
      or requested_lease_owner is distinct from current_action.lease_owner
      or requested_lease_token_hash is distinct from current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_FAILURE_CONFLICT';
    end if;
    next_status := 'FAILED';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := requested_error_code;
  elsif requested_event_type = 'RETRY' then
    if current_action.status <> 'FAILED'
      or current_plan.status in ('COMPLETED', 'INVALIDATED', 'BLOCKED')
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_RETRY_CONFLICT';
    end if;
    next_status := 'PENDING';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := null;
  elsif requested_event_type = 'RECOVERED' then
    if current_action.status <> 'IN_PROGRESS'
      or current_plan.status <> 'IN_PROGRESS'
      or current_action.lease_until is null
      or current_action.lease_owner is null
      or current_action.lease_token_hash is null
      or current_action.lease_until > timezone('utc', now())
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_RECOVERY_CONFLICT';
    end if;
    next_status := 'PENDING';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := coalesce(requested_error_code, 'LEASE_EXPIRED');
  elsif requested_event_type = 'BLOCKED' then
    if current_action.status not in ('PENDING', 'FAILED')
      or current_plan.status in ('COMPLETED', 'INVALIDATED')
      or requested_attempt_number <> current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_BLOCK_CONFLICT';
    end if;
    next_status := 'BLOCKED';
    next_lease_until := null;
    next_lease_owner := null;
    next_lease_token_hash := null;
    next_completed_at := null;
    next_error_code := requested_error_code;
  end if;

  update public.payroll_import_finalization_actions
  set status = next_status,
      attempt_count = next_attempt_count,
      lease_until = next_lease_until,
      lease_owner = next_lease_owner,
      lease_token_hash = next_lease_token_hash,
      last_attempt_at = case when requested_event_type = 'CLAIMED' then timezone('utc', now()) else current_action.last_attempt_at end,
      completed_at = next_completed_at,
      last_error_code = next_error_code,
      checkpoint = requested_checkpoint,
      updated_at = timezone('utc', now())
  where id = current_action.id;

  select count(*)::bigint,
    count(*) filter (where payroll_import_finalization_actions.status = 'COMPLETED')::bigint
  into plan_total_count, plan_completed_count
  from public.payroll_import_finalization_actions
  where plan_id = current_plan.id;

  if plan_total_count <> current_plan.expected_action_count then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_INCOMPLETE';
  end if;

  next_plan_status := current_plan.status;
  if requested_event_type = 'COMPLETED' then
    next_plan_status := case when plan_completed_count = current_plan.expected_action_count then 'COMPLETED' else 'IN_PROGRESS' end;
  elsif requested_event_type = 'CLAIMED' or requested_event_type = 'CHECKPOINT' then
    next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'FAILED' then
    next_plan_status := 'FAILED';
  elsif requested_event_type = 'RETRY' then
    next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'RECOVERED' then
    next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'BLOCKED' then
    next_plan_status := 'BLOCKED';
  end if;

  update public.payroll_import_finalization_plans
  set completed_action_count = plan_completed_count,
      status = next_plan_status,
      updated_at = timezone('utc', now())
  where id = current_plan.id;

  insert into public.payroll_import_finalization_action_events (
    tenant_id,
    hr_group_id,
    batch_id,
    action_id,
    event_key,
    event_type,
    actor_user_id,
    attempt_number,
    checkpoint,
    error_code,
    lease_until,
    lease_owner,
    source_hash,
    analysis_hash,
    core_state_hash
  ) values (
    requested_tenant_id,
    requested_hr_group_id,
    requested_batch_id,
    requested_action_id,
    requested_event_key,
    requested_event_type,
    requested_actor_user_id,
    requested_attempt_number,
    requested_checkpoint,
    requested_error_code,
    requested_lease_until,
    requested_lease_owner,
    requested_source_hash,
    requested_analysis_hash,
    requested_core_state_hash
  ) returning id into next_event_id;

  return query select current_action.action_id, next_status, next_attempt_count, next_event_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.reserve_employee_number(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  reserved_value bigint;
  minimum_next_value numeric;
begin
  if current_user not in ('postgres', 'service_role')
    and not internal_security.current_user_has_permission(
      p_tenant_id,
      null,
      'employee:write'
    ) then
    raise exception 'EMPLOYEE_NUMBER_FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.employees e
    where e.tenant_id = p_tenant_id
      and e.employee_number ~ '^[0-9]+$'
      and length(ltrim(e.employee_number, '0')) > 19
  ) then
    raise exception 'EMPLOYEE_NUMBER_EXHAUSTED' using errcode = '22003';
  end if;

  select greatest(
    100002::numeric,
    coalesce(
      max(
        case
          when e.employee_number ~ '^[0-9]+$' then
            coalesce(nullif(ltrim(e.employee_number, '0'), ''), '0')::numeric
        end
      ),
      100000::numeric
    ) + 2
  )
  into minimum_next_value
  from public.employees e
  where e.tenant_id = p_tenant_id;

  if minimum_next_value > 9223372036854775807::numeric then
    raise exception 'EMPLOYEE_NUMBER_EXHAUSTED' using errcode = '22003';
  end if;

  insert into public.employee_number_sequences (tenant_id, next_value)
  values (p_tenant_id, minimum_next_value::bigint)
  on conflict (tenant_id) do update
    set next_value = greatest(
          public.employee_number_sequences.next_value + 1,
          excluded.next_value
        ),
        updated_at = timezone('utc', now())
  returning next_value - 1 into reserved_value;

  return reserved_value::text;
end;
$function$;
create extension btree_gist;
alter table public.administration_payroll_tax_numbers add constraint administration_payroll_tax_numbers_dates_check CHECK (((valid_until IS NULL) OR (valid_until >= valid_from)));
alter table public.administration_payroll_tax_numbers add constraint administration_payroll_tax_numbers_format_check CHECK ((payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'::text));
alter table public.administration_payroll_tax_numbers add constraint administration_payroll_tax_numbers_number_scope_key UNIQUE (tenant_id, administration_id, payroll_tax_number, valid_from);
alter table public.administration_payroll_tax_numbers add constraint administration_payroll_tax_numbers_pkey PRIMARY KEY (id);
alter table public.administration_payroll_tax_numbers add constraint administration_payroll_tax_numbers_scope_id_key UNIQUE (tenant_id, hr_group_id, administration_id, id);
alter table public.administrations add constraint administrations_number_check CHECK (((char_length(btrim(administration_number)) >= 1) AND (char_length(btrim(administration_number)) <= 80)));
alter table public.administrations add constraint administrations_pkey PRIMARY KEY (id);
alter table public.administrations add constraint administrations_tenant_code_key UNIQUE (tenant_id, code);
alter table public.administrations add constraint administrations_tenant_group_id_key UNIQUE (tenant_id, hr_group_id, id);
alter table public.administrations add constraint administrations_tenant_id_id_key UNIQUE (tenant_id, id);
alter table public.administrations add constraint administrations_tenant_number_key UNIQUE (tenant_id, administration_number);
alter table public.audit_logs add constraint audit_logs_action_check CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'ARCHIVE'::text, 'DELETE'::text, 'REVEAL'::text, 'EXPORT'::text, 'START'::text, 'STOP'::text, 'READ'::text])));
alter table public.audit_logs add constraint audit_logs_api_client_id_check CHECK (((api_client_id IS NULL) OR (((length(btrim(api_client_id)) >= 1) AND (length(btrim(api_client_id)) <= 128)) AND (api_client_id = btrim(api_client_id)) AND (api_client_id !~ '[[:cntrl:]]'::text))));
alter table public.audit_logs add constraint audit_logs_api_outcome_check CHECK (((api_outcome IS NULL) OR (api_outcome = ANY (ARRAY['ALLOWED'::text, 'DENIED'::text, 'RATE_LIMITED'::text, 'FAILED'::text]))));
alter table public.audit_logs add constraint audit_logs_api_read_entity_contract CHECK ((((action = 'READ'::text) AND (entity_name = 'api_resource'::text) AND (entity_id IS NULL) AND (actor_user_id IS NOT NULL) AND (hr_group_id IS NOT NULL) AND (api_resource_key IS NOT NULL) AND (api_client_id IS NOT NULL) AND (api_outcome IS NOT NULL) AND (api_status_code IS NOT NULL) AND (correlation_id IS NOT NULL) AND (correlation_id <> '00000000-0000-0000-0000-000000000000'::uuid) AND (changes = '{}'::jsonb) AND (subject_employee_id IS NULL) AND (employment_id IS NULL) AND (change_set_id IS NULL)) OR ((action = 'READ'::text) AND (entity_name <> 'api_resource'::text) AND (entity_id IS NOT NULL) AND (hr_group_id IS NULL) AND (api_resource_key IS NULL) AND (api_client_id IS NULL) AND (api_outcome IS NULL) AND (api_status_code IS NULL)) OR ((action <> 'READ'::text) AND (entity_id IS NOT NULL) AND (hr_group_id IS NULL) AND (api_resource_key IS NULL) AND (api_client_id IS NULL) AND (api_outcome IS NULL) AND (api_status_code IS NULL))));
alter table public.audit_logs add constraint audit_logs_api_read_metadata_contract CHECK (((action <> 'READ'::text) OR (entity_name <> 'api_resource'::text) OR ((api_outcome = 'ALLOWED'::text) AND ((api_status_code >= 200) AND (api_status_code <= 299))) OR ((api_outcome = 'DENIED'::text) AND (api_status_code = ANY (ARRAY[403, 404]))) OR ((api_outcome = 'RATE_LIMITED'::text) AND (api_status_code = 429)) OR ((api_outcome = 'FAILED'::text) AND ((api_status_code >= 500) AND (api_status_code <= 599)))));
alter table public.audit_logs add constraint audit_logs_api_resource_key_check CHECK (((api_resource_key IS NULL) OR (api_resource_key = ANY (ARRAY['workforce-summary'::text, 'team-skills'::text, 'development-plans'::text, 'employee-self-service'::text]))));
alter table public.audit_logs add constraint audit_logs_api_status_code_check CHECK (((api_status_code IS NULL) OR ((api_status_code >= 100) AND (api_status_code <= 599))));
alter table public.audit_logs add constraint audit_logs_changes_check CHECK ((jsonb_typeof(changes) = 'object'::text));
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.employee_administration_assignments add constraint employee_administration_assignments_dates_valid CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)));
alter table public.employee_administration_assignments add constraint employee_administration_assignments_pkey PRIMARY KEY (id);
alter table public.employee_number_sequences add constraint employee_number_sequences_next_value_check CHECK ((next_value > 0));
alter table public.employee_number_sequences add constraint employee_number_sequences_pkey PRIMARY KEY (tenant_id);
alter table public.employee_secure_identifiers add constraint employee_secure_identifiers_bsn_pair_check CHECK (((bsn_ciphertext IS NULL) = (bsn_fingerprint IS NULL)));
alter table public.employee_secure_identifiers add constraint employee_secure_identifiers_id_key UNIQUE (id);
alter table public.employee_secure_identifiers add constraint employee_secure_identifiers_pkey PRIMARY KEY (employee_id);
alter table public.employees add constraint employees_custom_fields_must_be_an_object CHECK ((jsonb_typeof(custom_fields) = 'object'::text));
alter table public.employees add constraint employees_pkey PRIMARY KEY (id);
alter table public.employees add constraint employees_tenant_employee_number_key UNIQUE (tenant_id, employee_number);
alter table public.employees add constraint employees_tenant_id_id_key UNIQUE (tenant_id, id);
alter table public.employment_income_relationships add constraint employment_income_relationships_no_overlap EXCLUDE USING gist (tenant_id WITH =, employment_id WITH =, daterange(valid_from, valid_until, '[)'::text) WITH &&);
alter table public.employment_income_relationships add constraint employment_income_relationships_period_valid CHECK (((valid_until IS NULL) OR (valid_until > valid_from)));
alter table public.employment_income_relationships add constraint employment_income_relationships_pkey PRIMARY KEY (id);
alter table public.employments add constraint employments_administration_id_key UNIQUE (tenant_id, administration_id, id);
alter table public.employments add constraint employments_country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text));
alter table public.employments add constraint employments_dates_valid CHECK ((((ends_on IS NULL) OR (ends_on >= starts_on)) AND ((probation_ends_on IS NULL) OR (probation_ends_on >= starts_on)) AND (seniority_date <= starts_on) AND (original_hire_date <= starts_on)));
alter table public.employments add constraint employments_one_overlapping_primary EXCLUDE USING gist (tenant_id WITH =, administration_id WITH =, employee_id WITH =, daterange(starts_on, COALESCE((ends_on + 1), 'infinity'::date), '[)'::text) WITH &&) WHERE ((is_primary AND (deleted_at IS NULL)));
alter table public.employments add constraint employments_pkey PRIMARY KEY (id);
alter table public.employments add constraint employments_scope_id_key UNIQUE (tenant_id, administration_id, employee_id, id);
alter table public.income_relationships add constraint income_relationships_administration_id_key UNIQUE (tenant_id, administration_id, id);
alter table public.income_relationships add constraint income_relationships_dates_valid CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)));
alter table public.income_relationships add constraint income_relationships_ikv_number_check CHECK (((ikv_number >= 1) AND (ikv_number <= 99)));
alter table public.income_relationships add constraint income_relationships_payroll_tax_binding_pair_check CHECK ((((payroll_tax_number IS NULL) AND (payroll_tax_binding_hr_group_id IS NULL) AND (payroll_tax_binding_id IS NULL)) OR ((payroll_tax_number IS NOT NULL) AND (payroll_tax_binding_hr_group_id IS NOT NULL) AND (payroll_tax_binding_id IS NOT NULL))));
alter table public.income_relationships add constraint income_relationships_payroll_tax_number_format_check CHECK (((payroll_tax_number IS NULL) OR (payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'::text)));
alter table public.income_relationships add constraint income_relationships_pkey PRIMARY KEY (id);
alter table public.income_relationships add constraint income_relationships_scope_id_key UNIQUE (tenant_id, administration_id, employee_id, id);
alter table public.payroll_import_batches add constraint payroll_import_batches_batch_scope_key UNIQUE (tenant_id, hr_group_id, id);
alter table public.payroll_import_batches add constraint payroll_import_batches_idempotency_key_check CHECK ((btrim(idempotency_key) <> ''::text));
alter table public.payroll_import_batches add constraint payroll_import_batches_period_check CHECK (((period_end IS NULL) OR (period_start IS NULL) OR (period_end >= period_start)));
alter table public.payroll_import_batches add constraint payroll_import_batches_pkey PRIMARY KEY (id);
alter table public.payroll_import_batches add constraint payroll_import_batches_source_hash_check CHECK ((source_hash ~ '^[0-9a-f]{64}$'::text));
alter table public.payroll_import_batches add constraint payroll_import_batches_source_type_check CHECK ((source_type = ANY (ARRAY['LOONAANGIFTE_XML'::text, 'INTERNAL_REPRESENTATIVE'::text])));
alter table public.payroll_import_batches add constraint payroll_import_batches_status_check CHECK ((status = ANY (ARRAY['ANALYZED'::text, 'STAGED'::text, 'READY'::text, 'FINALIZING'::text, 'COMPLETED'::text, 'COMPLETED_WITH_WARNINGS'::text, 'FAILED'::text, 'EXPIRED'::text])));
alter table public.payroll_import_batches add constraint payroll_import_batches_tax_year_check CHECK (((tax_year >= 2000) AND (tax_year <= 2200)));
alter table public.payroll_import_decisions add constraint payroll_import_decisions_hash_check CHECK (((decision_hash ~ '^[0-9a-f]{64}$'::text) AND (source_hash ~ '^[0-9a-f]{64}$'::text) AND (analysis_hash ~ '^[0-9a-f]{64}$'::text) AND (core_state_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.payroll_import_decisions add constraint payroll_import_decisions_payload_check CHECK ((jsonb_typeof(decision_payload) = 'object'::text));
alter table public.payroll_import_decisions add constraint payroll_import_decisions_pkey PRIMARY KEY (id);
alter table public.payroll_import_decisions add constraint payroll_import_decisions_scope_hash_key UNIQUE (tenant_id, hr_group_id, batch_id, import_person_id, decision_hash);
alter table public.payroll_import_decisions add constraint payroll_import_decisions_scope_id_key UNIQUE (tenant_id, hr_group_id, batch_id, id);
alter table public.payroll_import_decisions add constraint payroll_import_decisions_scope_version_key UNIQUE (tenant_id, hr_group_id, batch_id, import_person_id, decision_version);
alter table public.payroll_import_decisions add constraint payroll_import_decisions_version_check CHECK ((decision_version > 0));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_attempt_check CHECK ((attempt_number >= 0));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_checkpoint_check CHECK ((jsonb_typeof(checkpoint) = 'object'::text));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_error_check CHECK (((error_code IS NULL) OR (error_code ~ '^[A-Z][A-Z0-9_.:-]{0,63}$'::text)));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_hash_check CHECK (((source_hash ~ '^[0-9a-f]{64}$'::text) AND (analysis_hash ~ '^[0-9a-f]{64}$'::text) AND (core_state_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_key_check CHECK ((event_key ~ '^[A-Za-z0-9_.:-]{1,160}$'::text));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_key_unique UNIQUE (tenant_id, hr_group_id, batch_id, action_id, event_key);
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_lease_check CHECK ((((event_type = ANY (ARRAY['CLAIMED'::text, 'CHECKPOINT'::text])) AND (lease_until IS NOT NULL)) OR ((event_type <> ALL (ARRAY['CLAIMED'::text, 'CHECKPOINT'::text])) AND (lease_until IS NULL))));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_lease_owner_check CHECK ((((event_type = ANY (ARRAY['CLAIMED'::text, 'CHECKPOINT'::text, 'COMPLETED'::text, 'FAILED'::text])) AND (lease_owner IS NOT NULL)) OR ((event_type <> ALL (ARRAY['CLAIMED'::text, 'CHECKPOINT'::text, 'COMPLETED'::text, 'FAILED'::text])) AND (lease_owner IS NULL))));
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_pkey PRIMARY KEY (id);
alter table public.payroll_import_finalization_action_events add constraint payroll_import_finalization_action_events_type_check CHECK ((event_type = ANY (ARRAY['PLANNED'::text, 'CLAIMED'::text, 'CHECKPOINT'::text, 'COMPLETED'::text, 'FAILED'::text, 'RETRY'::text, 'RECOVERED'::text, 'BLOCKED'::text])));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_action_id_check CHECK ((btrim(action_id) <> ''::text));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_action_type_check CHECK ((action_type = ANY (ARRAY['REUSE_EMPLOYEE'::text, 'CREATE_EMPLOYEE'::text, 'ADD_ADMINISTRATION_ASSIGNMENT'::text, 'UPDATE_EMPLOYEE_FIELDS'::text, 'REUSE_EMPLOYMENT'::text, 'CREATE_DRAFT_EMPLOYMENT'::text, 'CREATE_INCOME_RELATIONSHIP'::text, 'LINK_INCOME_RELATIONSHIP'::text, 'NO_CHANGE'::text, 'REQUIRES_REVIEW'::text, 'BLOCKED'::text])));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_attempt_check CHECK ((attempt_count >= 0));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_completed_check CHECK (((status = 'COMPLETED'::text) = (completed_at IS NOT NULL)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_dependency_check CHECK ((NOT (action_id = ANY (depends_on_action_ids))));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_draft_contract_type_check CHECK (((draft_employment_contract_type IS NULL) OR (draft_employment_contract_type = ANY (ARRAY['INDEFINITE'::text, 'DEFINITE'::text, 'ON_CALL'::text, 'TEMPORARY_AGENCY'::text, 'EXTERNAL'::text]))));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_draft_terms_check CHECK ((((action_type <> 'CREATE_DRAFT_EMPLOYMENT'::text) AND (draft_employment_starts_on IS NULL) AND (draft_employment_seniority_date IS NULL) AND (draft_employment_original_hire_date IS NULL)) OR ((action_type = 'CREATE_DRAFT_EMPLOYMENT'::text) AND (draft_employment_contract_type IS NOT NULL) AND (draft_employment_starts_on IS NOT NULL) AND (draft_employment_seniority_date IS NOT NULL) AND (draft_employment_original_hire_date IS NOT NULL) AND (draft_employment_seniority_date <= draft_employment_starts_on) AND (draft_employment_original_hire_date <= draft_employment_starts_on))));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_error_code_check CHECK (((last_error_code IS NULL) OR (last_error_code ~ '^[A-Z][A-Z0-9_.:-]{0,63}$'::text)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_hash_check CHECK (((plan_hash ~ '^[0-9a-f]{64}$'::text) AND (decision_hash ~ '^[0-9a-f]{64}$'::text) AND (source_hash ~ '^[0-9a-f]{64}$'::text) AND (analysis_hash ~ '^[0-9a-f]{64}$'::text) AND (core_state_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_json_check CHECK (((jsonb_typeof(source_refs) = 'array'::text) AND (jsonb_typeof(preconditions) = 'array'::text) AND (jsonb_typeof(checkpoint) = 'object'::text)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_lease_check CHECK ((((status = 'IN_PROGRESS'::text) AND (lease_until IS NOT NULL) AND (lease_owner IS NOT NULL) AND (lease_token_hash IS NOT NULL)) OR ((status <> 'IN_PROGRESS'::text) AND (lease_until IS NULL) AND (lease_owner IS NULL) AND (lease_token_hash IS NULL))));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_lease_hash_check CHECK (((lease_token_hash IS NULL) OR (lease_token_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_pkey PRIMARY KEY (id);
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_scope_id_key UNIQUE (tenant_id, hr_group_id, batch_id, action_id);
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_scope_idempotency_key UNIQUE (tenant_id, hr_group_id, batch_id, idempotency_key);
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_sequence_check CHECK ((sequence_no > 0));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_source_ikv_check CHECK (((source_payroll_tax_number IS NULL) OR (source_payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'::text)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_source_ikv_number_check CHECK (((source_ikv_number IS NULL) OR ((source_ikv_number >= 1) AND (source_ikv_number <= 99))));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_source_period_check CHECK (((source_ends_on IS NULL) OR (source_starts_on IS NULL) OR (source_ends_on >= source_starts_on)));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_source_person_ref_check CHECK ((btrim(source_person_ref) <> ''::text));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'FAILED'::text, 'BLOCKED'::text])));
alter table public.payroll_import_finalization_actions add constraint payroll_import_finalization_actions_target_ref_check CHECK ((((target_employee_ref IS NULL) OR (btrim(target_employee_ref) <> ''::text)) AND ((target_employment_ref IS NULL) OR (btrim(target_employment_ref) <> ''::text))));
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_count_check CHECK (((expected_action_count > 0) AND (completed_action_count >= 0) AND (completed_action_count <= expected_action_count)));
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_hash_check CHECK (((plan_hash ~ '^[0-9a-f]{64}$'::text) AND (source_hash ~ '^[0-9a-f]{64}$'::text) AND (analysis_hash ~ '^[0-9a-f]{64}$'::text) AND (core_state_hash ~ '^[0-9a-f]{64}$'::text)));
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_invalidation_check CHECK ((((status = 'INVALIDATED'::text) AND (invalidated_at IS NOT NULL) AND (invalidated_by_user_id IS NOT NULL) AND (invalidation_reason IS NOT NULL)) OR ((status <> 'INVALIDATED'::text) AND (invalidated_at IS NULL) AND (invalidated_by_user_id IS NULL) AND (invalidation_reason IS NULL))));
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_pkey PRIMARY KEY (id);
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_scope_hash_key UNIQUE (tenant_id, hr_group_id, batch_id, plan_hash);
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_scope_id_key UNIQUE (tenant_id, hr_group_id, batch_id, id);
alter table public.payroll_import_finalization_plans add constraint payroll_import_finalization_plans_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'FAILED'::text, 'BLOCKED'::text, 'INVALIDATED'::text])));
alter table public.payroll_import_income_relationships add constraint payroll_import_income_dates_check CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on)));
alter table public.payroll_import_income_relationships add constraint payroll_import_income_hours_check CHECK (((hours_per_week IS NULL) OR (hours_per_week >= (0)::numeric)));
alter table public.payroll_import_income_relationships add constraint payroll_import_income_ikv_check CHECK ((ikv_number > 0));
alter table public.payroll_import_income_relationships add constraint payroll_import_income_ikv_key UNIQUE (batch_id, import_person_id, payroll_tax_number, ikv_number);
alter table public.payroll_import_income_relationships add constraint payroll_import_income_relationships_pkey PRIMARY KEY (id);
alter table public.payroll_import_income_relationships add constraint payroll_import_income_salary_check CHECK (((salary_amount IS NULL) OR (salary_amount >= (0)::numeric)));
alter table public.payroll_import_income_relationships add constraint payroll_import_income_status_check CHECK ((status = ANY (ARRAY['GREEN'::text, 'WARNING'::text, 'BLOCKING'::text, 'MANUAL_REVIEW'::text, 'IMPORTED'::text])));
alter table public.payroll_import_income_relationships add constraint payroll_import_income_tax_number_check CHECK ((payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'::text));
alter table public.payroll_import_persons add constraint payroll_import_persons_batch_row_key UNIQUE (batch_id, source_row_number);
alter table public.payroll_import_persons add constraint payroll_import_persons_id_key UNIQUE (tenant_id, hr_group_id, id);
alter table public.payroll_import_persons add constraint payroll_import_persons_match_status_check CHECK ((match_status = ANY (ARRAY['UNMATCHED'::text, 'EXACT'::text, 'PROPOSED'::text, 'MANUAL_REVIEW'::text, 'NEW'::text])));
alter table public.payroll_import_persons add constraint payroll_import_persons_pkey PRIMARY KEY (id);
alter table public.payroll_import_persons add constraint payroll_import_persons_row_number_check CHECK ((source_row_number > 0));
alter table public.payroll_import_persons add constraint payroll_import_persons_status_check CHECK ((status = ANY (ARRAY['GREEN'::text, 'WARNING'::text, 'BLOCKING'::text])));
alter table public.payroll_import_protected_identifiers add constraint payroll_import_protected_identifiers_batch_fingerprint_key UNIQUE (tenant_id, hr_group_id, batch_id, bsn_fingerprint);
alter table public.payroll_import_protected_identifiers add constraint payroll_import_protected_identifiers_ciphertext_check CHECK (((length(bsn_ciphertext) >= 24) AND (length(bsn_ciphertext) <= 512)));
alter table public.payroll_import_protected_identifiers add constraint payroll_import_protected_identifiers_fingerprint_check CHECK ((bsn_fingerprint ~ '^[0-9a-f]{64}$'::text));
alter table public.payroll_import_protected_identifiers add constraint payroll_import_protected_identifiers_person_key PRIMARY KEY (tenant_id, hr_group_id, batch_id, import_person_id);
alter table public.payroll_import_xml_provenance add constraint payroll_import_xml_provenance_hash_check CHECK (((source_hash ~ '^[0-9a-f]{64}$'::text) AND (source_archive_sha256 ~ '^[0-9a-f]{64}$'::text) AND (xsd_sha256 ~ '^[0-9a-f]{64}$'::text)));
alter table public.payroll_import_xml_provenance add constraint payroll_import_xml_provenance_pkey PRIMARY KEY (id);
alter table public.payroll_import_xml_provenance add constraint payroll_import_xml_provenance_schema_check CHECK (((schema_version = '2.0'::text) AND (namespace_uri = 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01'::text)));
alter table public.payroll_import_xml_provenance add constraint payroll_import_xml_provenance_source_key UNIQUE (tenant_id, hr_group_id, administration_id, batch_id, source_hash);
