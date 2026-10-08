-- CONTROL02 TEST contract candidate. Full LhNr provenance is stored with new
-- Core IKVs; legacy rows remain NULL and are never reconstructed from LhNr subnumber.
begin;

alter table public.payroll_import_finalization_actions
  add column draft_employment_contract_type text,
  add column draft_employment_starts_on date,
  add column draft_employment_seniority_date date,
  add column draft_employment_original_hire_date date,
  add constraint payroll_import_finalization_actions_draft_contract_type_check
    check (draft_employment_contract_type is null or draft_employment_contract_type in (
      'INDEFINITE', 'DEFINITE', 'ON_CALL', 'TEMPORARY_AGENCY', 'EXTERNAL'
    )),
  add constraint payroll_import_finalization_actions_draft_terms_check
    check ((action_type <> 'CREATE_DRAFT_EMPLOYMENT'
        and draft_employment_starts_on is null
        and draft_employment_seniority_date is null
        and draft_employment_original_hire_date is null)
      or (action_type = 'CREATE_DRAFT_EMPLOYMENT'
        and draft_employment_contract_type is not null
        and draft_employment_starts_on is not null
        and draft_employment_seniority_date is not null
        and draft_employment_original_hire_date is not null
        and draft_employment_seniority_date <= draft_employment_starts_on
        and draft_employment_original_hire_date <= draft_employment_starts_on));

alter table public.administration_payroll_tax_numbers
  add constraint administration_payroll_tax_numbers_scope_id_key
  unique (tenant_id, hr_group_id, administration_id, id);

alter table public.income_relationships
  add column payroll_tax_number text,
  add column payroll_tax_binding_hr_group_id uuid,
  add column payroll_tax_binding_id uuid,
  add constraint income_relationships_payroll_tax_number_format_check
    check (payroll_tax_number is null or payroll_tax_number ~ '^[0-9]{9}L(0[1-9]|[1-9][0-9])$'),
  add constraint income_relationships_payroll_tax_binding_pair_check
    check ((payroll_tax_number is null and payroll_tax_binding_hr_group_id is null and payroll_tax_binding_id is null)
      or (payroll_tax_number is not null and payroll_tax_binding_hr_group_id is not null and payroll_tax_binding_id is not null)),
  add constraint income_relationships_payroll_tax_binding_scope_fkey
    foreign key (tenant_id, payroll_tax_binding_hr_group_id, administration_id, payroll_tax_binding_id)
    references public.administration_payroll_tax_numbers(tenant_id, hr_group_id, administration_id, id)
    on delete restrict;

-- Keep the current employee-scoped legacy IKV guard. Full LhNr identity gets
-- its own active key so legacy rows are not reinterpreted or rekeyed.
create unique index income_relationships_full_lhnr_ikv_active_key
  on public.income_relationships (tenant_id, administration_id, payroll_tax_number, ikv_number)
  where deleted_at is null and payroll_tax_number is not null;
create index income_relationships_payroll_tax_binding_idx
  on public.income_relationships (tenant_id, payroll_tax_binding_hr_group_id, administration_id, payroll_tax_binding_id)
  where payroll_tax_binding_id is not null;

create table public.payroll_import_xml_provenance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  administration_id uuid not null,
  batch_id uuid not null,
  source_hash text not null,
  schema_version text not null,
  namespace_uri text not null,
  source_archive_sha256 text not null,
  xsd_sha256 text not null,
  release_page_url text not null,
  xsd_filename text not null,
  validated_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_xml_provenance_batch_scope_fkey
    foreign key (tenant_id, hr_group_id, administration_id, batch_id)
    references public.payroll_import_batches(tenant_id, hr_group_id, administration_id, id)
    on delete cascade,
  constraint payroll_import_xml_provenance_hash_check
    check (source_hash ~ '^[0-9a-f]{64}$' and source_archive_sha256 ~ '^[0-9a-f]{64}$' and xsd_sha256 ~ '^[0-9a-f]{64}$'),
  constraint payroll_import_xml_provenance_schema_check
    check (schema_version = '2.0' and namespace_uri = 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01'),
  constraint payroll_import_xml_provenance_source_key
    unique (tenant_id, hr_group_id, administration_id, batch_id, source_hash)
);
create index payroll_import_xml_provenance_batch_idx
  on public.payroll_import_xml_provenance (tenant_id, hr_group_id, administration_id, batch_id);
alter table public.payroll_import_xml_provenance enable row level security;
revoke all on table public.payroll_import_xml_provenance from public, anon, authenticated;
grant select, insert on table public.payroll_import_xml_provenance to service_role;

create function internal_security.prevent_payroll_import_xml_provenance_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '42501', message = 'PAYROLL_IMPORT_XML_PROVENANCE_IMMUTABLE';
end;
$$;
revoke all on function internal_security.prevent_payroll_import_xml_provenance_mutation() from public, anon, authenticated;
create trigger prevent_payroll_import_xml_provenance_mutation
before update or delete on public.payroll_import_xml_provenance
for each row execute function internal_security.prevent_payroll_import_xml_provenance_mutation();

create function internal_security.prevent_payroll_import_source_projection_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_table_name = 'payroll_import_persons' and row(
      old.tenant_id, old.hr_group_id, old.batch_id, old.source_row_number,
      old.external_employee_number, old.bsn_fingerprint, old.initials, old.prefix,
      old.first_name, old.birth_name, old.birth_date, old.gender, old.nationality,
      old.address, old.source_metadata
    ) is distinct from row(
      new.tenant_id, new.hr_group_id, new.batch_id, new.source_row_number,
      new.external_employee_number, new.bsn_fingerprint, new.initials, new.prefix,
      new.first_name, new.birth_name, new.birth_date, new.gender, new.nationality,
      new.address, new.source_metadata
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_IMPORT_SOURCE_PROJECTION_IMMUTABLE';
  end if;

  if tg_table_name = 'payroll_import_income_relationships' and row(
      old.tenant_id, old.hr_group_id, old.batch_id, old.import_person_id,
      old.administration_id, old.payroll_tax_number, old.ikv_number, old.income_code,
      old.employment_relation_code, old.cao_code, old.flags, old.hours_per_week,
      old.salary_amount, old.starts_on, old.ends_on, old.source_metadata
    ) is distinct from row(
      new.tenant_id, new.hr_group_id, new.batch_id, new.import_person_id,
      new.administration_id, new.payroll_tax_number, new.ikv_number, new.income_code,
      new.employment_relation_code, new.cao_code, new.flags, new.hours_per_week,
      new.salary_amount, new.starts_on, new.ends_on, new.source_metadata
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_IMPORT_SOURCE_PROJECTION_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function internal_security.prevent_payroll_import_source_projection_change() from public, anon, authenticated;
create trigger prevent_payroll_import_person_source_projection_change
before update on public.payroll_import_persons
for each row execute function internal_security.prevent_payroll_import_source_projection_change();
create trigger prevent_payroll_import_income_source_projection_change
before update on public.payroll_import_income_relationships
for each row execute function internal_security.prevent_payroll_import_source_projection_change();

create table public.payroll_import_protected_identifiers (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  batch_id uuid not null,
  import_person_id uuid not null,
  bsn_fingerprint text not null,
  bsn_ciphertext text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_import_protected_identifiers_person_scope_fkey
    foreign key (tenant_id, hr_group_id, batch_id, import_person_id)
    references public.payroll_import_persons(tenant_id, hr_group_id, batch_id, id)
    on delete cascade,
  constraint payroll_import_protected_identifiers_fingerprint_check
    check (bsn_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint payroll_import_protected_identifiers_ciphertext_check
    check (length(bsn_ciphertext) between 24 and 512),
  constraint payroll_import_protected_identifiers_person_key
    primary key (tenant_id, hr_group_id, batch_id, import_person_id),
  constraint payroll_import_protected_identifiers_batch_fingerprint_key
    unique (tenant_id, hr_group_id, batch_id, bsn_fingerprint)
);
create index payroll_import_protected_identifiers_person_idx
  on public.payroll_import_protected_identifiers (tenant_id, hr_group_id, import_person_id);
alter table public.payroll_import_protected_identifiers enable row level security;
revoke all on table public.payroll_import_protected_identifiers from public, anon, authenticated;
grant select, insert, delete on table public.payroll_import_protected_identifiers to service_role;

-- FK lookup indexes reported by advisors for the CONTROL01/02 writer path.
create index if not exists payroll_import_persons_matched_employee_idx
  on public.payroll_import_persons (tenant_id, matched_employee_id)
  where matched_employee_id is not null;
create index if not exists payroll_import_income_matched_relationship_idx
  on public.payroll_import_income_relationships (tenant_id, administration_id, matched_income_relationship_id)
  where matched_income_relationship_id is not null;
create index if not exists payroll_import_finalization_actions_plan_sequence_idx
  on public.payroll_import_finalization_actions (tenant_id, hr_group_id, batch_id, plan_id, sequence_no);
create index if not exists payroll_import_finalization_actions_person_idx
  on public.payroll_import_finalization_actions (tenant_id, hr_group_id, batch_id, import_person_id);
create index if not exists payroll_import_decisions_confirmer_idx
  on public.payroll_import_decisions (confirmer_user_id);
create index if not exists payroll_import_finalization_plans_actor_idx
  on public.payroll_import_finalization_plans (created_by_user_id);
create index if not exists payroll_import_finalization_plans_invalidated_actor_idx
  on public.payroll_import_finalization_plans (invalidated_by_user_id)
  where invalidated_by_user_id is not null;
create index if not exists payroll_import_finalization_plan_events_actor_idx
  on public.payroll_import_finalization_plan_events (actor_user_id);
create index if not exists payroll_import_finalization_action_events_actor_idx
  on public.payroll_import_finalization_action_events (actor_user_id);

-- TEST-only transactional Core writer. The authenticated API remains
-- responsible for permission and active-context checks; this service-role-only
-- function rechecks immutable scope, decision, source and fencing state while
-- holding the ledger rows, then commits the Core write and completion event in
-- the same PostgreSQL transaction.
create or replace function public.execute_control02_test_payroll_finalization_action(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_batch_id uuid,
  requested_action_id text,
  requested_actor_user_id uuid,
  requested_lease_owner uuid,
  requested_lease_token_hash text,
  requested_expected_versions jsonb,
  requested_state_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_action public.payroll_import_finalization_actions%rowtype;
  current_plan public.payroll_import_finalization_plans%rowtype;
  current_batch public.payroll_import_batches%rowtype;
  current_decision public.payroll_import_decisions%rowtype;
  current_person public.payroll_import_persons%rowtype;
  target_income_row public.income_relationships%rowtype;
  source_income record;
  source_ref text;
  source_person_ref text;
  expected_material text;
  target_employee_id uuid;
  target_employment_id uuid;
  target_income_relationship_id uuid;
  protected_identifier record;
  tax_binding record;
  income_start date;
  income_end date;
  assignment_start date;
  employment_number text;
  row_count integer;
  source_count integer := 0;
  readback_document jsonb;
  action_checkpoint jsonb;
  readback_hash text;
  completed_status text;
  completed_count integer;
  expected_count integer;
  event_result record;
begin
  if requested_tenant_id is null
    or requested_hr_group_id is null
    or requested_batch_id is null
    or requested_action_id is null
    or requested_actor_user_id is null
    or requested_lease_owner is null
    or requested_lease_token_hash is null
    or requested_lease_token_hash !~ '^[0-9a-f]{64}$'
    or requested_state_token is null
    or requested_state_token !~ '^[0-9a-f]{64}$'
    or requested_expected_versions is null
    or jsonb_typeof(requested_expected_versions) <> 'object'
    or not exists (select 1 from pg_catalog.jsonb_each(requested_expected_versions) e where pg_catalog.jsonb_typeof(e.value) <> 'string') then
    raise exception using errcode = '22023', message = 'PAYROLL_FINALIZATION_ACTION_PROOF_INVALID';
  end if;

  select pg_catalog.string_agg(e.key || '=' || (e.value #>> '{}'), E'\n' order by e.key)
  into expected_material
  from pg_catalog.jsonb_each(requested_expected_versions) e;
  if expected_material is null
    or pg_catalog.encode(extensions.digest(pg_catalog.convert_to(expected_material, 'UTF8'), 'sha256'), 'hex') <> requested_state_token then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ACTION_PROOF_INVALID';
  end if;

  select * into current_action
  from public.payroll_import_finalization_actions a
  where a.tenant_id = requested_tenant_id
    and a.hr_group_id = requested_hr_group_id
    and a.batch_id = requested_batch_id
    and a.action_id = requested_action_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_FINALIZATION_ACTION_NOT_FOUND';
  end if;

  select * into current_plan
  from public.payroll_import_finalization_plans p
  where p.tenant_id = current_action.tenant_id
    and p.hr_group_id = current_action.hr_group_id
    and p.batch_id = current_action.batch_id
    and p.administration_id = current_action.administration_id
    and p.id = current_action.plan_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND';
  end if;

  select * into current_batch
  from public.payroll_import_batches b
  where b.tenant_id = current_action.tenant_id
    and b.hr_group_id = current_action.hr_group_id
    and b.administration_id = current_action.administration_id
    and b.id = current_action.batch_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_IMPORT_BATCH_NOT_FOUND';
  end if;

  if current_action.status <> 'IN_PROGRESS'
    or current_plan.status <> 'IN_PROGRESS'
    or current_action.lease_owner is distinct from requested_lease_owner
    or current_action.lease_token_hash is distinct from requested_lease_token_hash
    or current_action.lease_until is null
    or current_action.lease_until <= pg_catalog.now() then
    raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_LEASE_FENCED';
  end if;
  if current_plan.status = 'INVALIDATED'
    or current_action.plan_hash <> current_plan.plan_hash
    or current_action.source_hash <> current_plan.source_hash
    or current_action.analysis_hash <> current_plan.analysis_hash
    or current_action.core_state_hash <> current_plan.core_state_hash
    or current_action.decision_hash !~ '^[0-9a-f]{64}$'
    or current_plan.contract_version is distinct from 'CONTROL02-CORE-PAYROLL-TEST-CANDIDATE-1'
    or current_action.contract_version is distinct from current_plan.contract_version
    or current_batch.source_type <> 'LOONAANGIFTE_XML'
    or current_batch.source_hash <> current_action.source_hash
    or current_batch.source_deleted_at is not null
    or current_batch.status not in ('STAGED', 'READY', 'FINALIZING') then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_PROVENANCE_STALE';
  end if;
  if current_action.schema_version <> '2.0' or current_plan.schema_version <> '2.0' then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SCHEMA_UNSUPPORTED';
  end if;

  if not exists (
    select 1 from public.payroll_import_xml_provenance provenance
    where provenance.tenant_id = current_batch.tenant_id
      and provenance.hr_group_id = current_batch.hr_group_id
      and provenance.administration_id = current_batch.administration_id
      and provenance.batch_id = current_batch.id
      and provenance.source_hash = current_batch.source_hash
      and provenance.schema_version = '2.0'
      and provenance.namespace_uri = 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01'
      and provenance.source_archive_sha256 = '134cf1464ccce87acff81c8c624c0ad31878a43e541babb46514926912b1836e'
      and provenance.xsd_sha256 = 'eb862bea8c7232154cfb30bb37c4ecf192b4a86540944358b065bb7fa54fc441'
      and provenance.release_page_url = 'https://odb.belastingdienst.nl/documentatie/loonheffingen-aangifte-2026v09/'
      and provenance.xsd_filename = 'Loonaangifte2026v2.0.xsd'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_PROVENANCE_UNVERIFIED';
  end if;

  select * into current_decision
  from public.payroll_import_decisions d
  where d.tenant_id = current_action.tenant_id
    and d.hr_group_id = current_action.hr_group_id
    and d.administration_id = current_action.administration_id
    and d.batch_id = current_action.batch_id
    and d.id = current_action.decision_id
    and d.import_person_id = current_action.import_person_id
  for share;
  if not found
    or current_decision.confirmer_user_id <> requested_actor_user_id
    or current_decision.decision_hash <> current_action.decision_hash
    or current_decision.source_hash <> current_action.source_hash
    or current_decision.analysis_hash <> current_action.analysis_hash
    or current_decision.core_state_hash <> current_action.core_state_hash
    or current_decision.contract_version <> current_action.contract_version
    or current_decision.schema_version <> current_action.schema_version
    or current_decision.decision_version <> (
      select pg_catalog.max(d.decision_version)
      from public.payroll_import_decisions d
      where d.tenant_id = current_action.tenant_id
        and d.hr_group_id = current_action.hr_group_id
        and d.batch_id = current_action.batch_id
        and d.import_person_id = current_action.import_person_id
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DECISION_STALE';
  end if;

  select * into current_person
  from public.payroll_import_persons p
  where p.tenant_id = current_action.tenant_id
    and p.hr_group_id = current_action.hr_group_id
    and p.batch_id = current_action.batch_id
    and p.id = current_action.import_person_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_IMPORT_PERSON_NOT_FOUND';
  end if;
  source_person_ref := 'row-' || current_person.source_row_number::text;
  if current_action.source_person_ref <> source_person_ref
    or current_action.source_refs is null
    or pg_catalog.jsonb_typeof(current_action.source_refs) <> 'array'
    or requested_expected_versions ->> ('person:' || current_person.id::text) is null
    or (requested_expected_versions ->> ('person:' || current_person.id::text))::timestamptz is distinct from current_person.updated_at then
    raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_SOURCE_VERSION_STALE';
  end if;

  for source_ref in
    select value from pg_catalog.jsonb_array_elements_text(current_action.source_refs)
  loop
    if source_ref = source_person_ref then
      continue;
    end if;

    select numbered.id, numbered.payroll_tax_number, numbered.ikv_number,
      numbered.starts_on, numbered.ends_on, numbered.updated_at,
      numbered.income_index
    into source_income
    from (
      select i.id, i.payroll_tax_number, i.ikv_number, i.starts_on, i.ends_on, i.updated_at,
        (pg_catalog.row_number() over (order by i.id) - 1)::integer as income_index
      from public.payroll_import_income_relationships i
      where i.tenant_id = current_action.tenant_id
        and i.hr_group_id = current_action.hr_group_id
        and i.administration_id = current_action.administration_id
        and i.batch_id = current_action.batch_id
        and i.import_person_id = current_action.import_person_id
    ) numbered
    where source_ref = source_person_ref || ':income-' || numbered.income_index::text
      || ':' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text
      || ':' || coalesce(numbered.starts_on::text, '');
    if not found
      or requested_expected_versions ->> ('source:' || source_ref) is null
      or (requested_expected_versions ->> ('source:' || source_ref))::timestamptz is distinct from source_income.updated_at then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_SOURCE_VERSION_STALE';
    end if;
    source_count := source_count + 1;
  end loop;
  if source_count = 0 and current_action.action_type in (
    'REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT', 'CREATE_INCOME_RELATIONSHIP',
    'LINK_INCOME_RELATIONSHIP', 'NO_CHANGE'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SOURCE_INCOME_REQUIRED';
  end if;

  if pg_catalog.cardinality(current_action.depends_on_action_ids) <> (
    select pg_catalog.count(*)::integer
    from public.payroll_import_finalization_actions dependency
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

  if current_action.target_employee_id is not null then
    target_employee_id := current_action.target_employee_id;
  elsif current_action.target_employee_ref is not null
    and current_action.action_type <> 'CREATE_EMPLOYEE' then
    select (prior.checkpoint ->> 'createdEmployeeId')::uuid into target_employee_id
    from public.payroll_import_finalization_actions prior
    where prior.tenant_id = current_action.tenant_id
      and prior.hr_group_id = current_action.hr_group_id
      and prior.batch_id = current_action.batch_id
      and prior.plan_id = current_action.plan_id
      and prior.import_person_id = current_action.import_person_id
      and prior.action_type = 'CREATE_EMPLOYEE'
      and prior.target_employee_ref = current_action.target_employee_ref
      and prior.status = 'COMPLETED'
      and prior.checkpoint ->> 'createdEmployeeId' ~ '^[0-9a-f-]{36}$';
  end if;

  if current_action.target_employment_id is not null then
    target_employment_id := current_action.target_employment_id;
  elsif current_action.target_employment_ref is not null
    and current_action.action_type <> 'CREATE_DRAFT_EMPLOYMENT' then
    select (prior.checkpoint ->> 'createdEmploymentId')::uuid into target_employment_id
    from public.payroll_import_finalization_actions prior
    where prior.tenant_id = current_action.tenant_id
      and prior.hr_group_id = current_action.hr_group_id
      and prior.batch_id = current_action.batch_id
      and prior.plan_id = current_action.plan_id
      and prior.import_person_id = current_action.import_person_id
      and prior.action_type = 'CREATE_DRAFT_EMPLOYMENT'
      and prior.target_employment_ref = current_action.target_employment_ref
      and prior.status = 'COMPLETED'
      and prior.checkpoint ->> 'createdEmploymentId' ~ '^[0-9a-f-]{36}$';
  end if;

  if current_action.action_type <> 'CREATE_EMPLOYEE' then
    if current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or current_decision.decision_payload #>> '{match,action}' not in ('REUSE_EMPLOYEE', 'CREATE_EMPLOYEE')
      or target_employee_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_DECISION_STALE';
    end if;
    if (current_decision.decision_payload #>> '{match,action}') = 'REUSE_EMPLOYEE'
      and current_decision.decision_payload #>> '{match,employeeId}' is distinct from target_employee_id::text
      or (current_decision.decision_payload #>> '{match,action}') = 'CREATE_EMPLOYEE'
      and (current_action.target_employee_ref is distinct from ('new-employee:' || current_batch.id::text || ':' || source_person_ref)
        or not exists (
          select 1 from public.payroll_import_finalization_actions created
          where created.tenant_id = current_action.tenant_id
            and created.hr_group_id = current_action.hr_group_id
            and created.batch_id = current_action.batch_id
            and created.plan_id = current_action.plan_id
            and created.import_person_id = current_action.import_person_id
            and created.action_type = 'CREATE_EMPLOYEE'
            and created.target_employee_ref = current_action.target_employee_ref
            and created.status = 'COMPLETED'
            and created.checkpoint ->> 'createdEmployeeId' = target_employee_id::text
        )) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
  end if;

  if current_action.action_type not in (
    'REUSE_EMPLOYEE', 'CREATE_EMPLOYEE', 'ADD_ADMINISTRATION_ASSIGNMENT',
    'UPDATE_EMPLOYEE_FIELDS', 'REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT',
    'CREATE_INCOME_RELATIONSHIP', 'LINK_INCOME_RELATIONSHIP', 'NO_CHANGE'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ACTION_UNSUPPORTED';
  end if;

  if current_action.action_type = 'CREATE_EMPLOYEE' then
    if current_decision.decision_payload #>> '{match,action}' is distinct from 'CREATE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or nullif(pg_catalog.btrim(current_decision.decision_payload #>> '{match,newEmployeeFields,firstName}'), '') is null
      or nullif(pg_catalog.btrim(current_decision.decision_payload #>> '{match,newEmployeeFields,birthName}'), '') is null
      or coalesce(current_decision.decision_payload #>> '{match,newEmployeeFields,gender}', '') not in ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')
      or current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' is distinct from 'USE_SOURCE'
        and current_person.birth_date is not null
        and current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' is distinct from 'KEEP_CURRENT'
      or current_action.target_employee_id is not null
      or current_action.target_employee_ref is distinct from ('new-employee:' || current_batch.id::text || ':' || source_person_ref)
      or current_person.status = 'BLOCKING'
      or current_person.match_status = 'EXACT' then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_CREATE_NOT_CONFIRMED';
    end if;
    if exists (
      select 1 from public.employees e
      where e.tenant_id = current_batch.tenant_id
        and e.hr_group_id = current_batch.hr_group_id
        and e.deleted_at is null
        and current_person.bsn_fingerprint is not null
        and exists (select 1 from public.employee_secure_identifiers secure
          where secure.tenant_id = e.tenant_id
            and secure.employee_id = e.id
            and secure.bsn_fingerprint = current_person.bsn_fingerprint)
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_IDENTITY_CONFLICT';
    end if;

    select pg_catalog.min(i.starts_on) into assignment_start
    from public.payroll_import_income_relationships i
    where i.tenant_id = current_action.tenant_id
      and i.hr_group_id = current_action.hr_group_id
      and i.batch_id = current_action.batch_id
      and i.import_person_id = current_action.import_person_id;
    if assignment_start is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SOURCE_PERIOD_REQUIRED';
    end if;

    insert into public.employees (
      tenant_id, hr_group_id, employee_number, initials, first_name,
      birth_name_prefix, birth_name, name_usage, gender, birth_date,
      nationality
    ) values (
      current_batch.tenant_id,
      current_batch.hr_group_id,
      public.reserve_employee_number(current_batch.tenant_id),
      null,
      pg_catalog.btrim(current_decision.decision_payload #>> '{match,newEmployeeFields,firstName}'),
      null,
      pg_catalog.btrim(current_decision.decision_payload #>> '{match,newEmployeeFields,birthName}'),
      'BIRTH_NAME'::public.name_usage,
      (current_decision.decision_payload #>> '{match,newEmployeeFields,gender}')::public.gender,
      case when current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' = 'USE_SOURCE'
        then current_person.birth_date else null end,
      null
    ) returning id into target_employee_id;

    if current_person.bsn_fingerprint is not null then
      select * into protected_identifier
      from public.payroll_import_protected_identifiers p
      where p.tenant_id = current_action.tenant_id
        and p.hr_group_id = current_action.hr_group_id
        and p.batch_id = current_action.batch_id
        and p.import_person_id = current_action.import_person_id
        and p.bsn_fingerprint = current_person.bsn_fingerprint
      for update;
      if not found then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_PROTECTED_IDENTIFIER_MISSING';
      end if;
      insert into public.employee_secure_identifiers (
        employee_id, tenant_id, bsn_ciphertext, bsn_fingerprint
      ) values (
        target_employee_id, current_batch.tenant_id,
        protected_identifier.bsn_ciphertext, protected_identifier.bsn_fingerprint
      );
      delete from public.payroll_import_protected_identifiers p
      where p.tenant_id = current_action.tenant_id
        and p.hr_group_id = current_action.hr_group_id
        and p.batch_id = current_action.batch_id
        and p.import_person_id = current_action.import_person_id;
    end if;

    insert into public.employee_administration_assignments (
      tenant_id, hr_group_id, administration_id, employee_id, effective_from
    ) values (
      current_batch.tenant_id, current_batch.hr_group_id,
      current_batch.administration_id, target_employee_id, assignment_start
    ) on conflict do nothing;

  elsif current_action.action_type = 'REUSE_EMPLOYEE' then
    if current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,employeeId}' is distinct from target_employee_id::text
      or current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or target_employee_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
    if current_person.bsn_fingerprint is not null and not exists (
      select 1 from public.employee_secure_identifiers secure
      where secure.tenant_id = current_batch.tenant_id
        and secure.employee_id = target_employee_id
        and secure.bsn_fingerprint = current_person.bsn_fingerprint
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_IDENTITY_CONFLICT';
    end if;
  end if;

  if target_employee_id is not null then
    perform 1 from public.employees e
    where e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.id = target_employee_id
      and e.deleted_at is null
    for update;
    if not found then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SCOPE_MISMATCH';
    end if;
    if current_action.action_type <> 'CREATE_EMPLOYEE' then
      if requested_expected_versions ->> ('employee:' || target_employee_id::text) is null
        or (requested_expected_versions ->> ('employee:' || target_employee_id::text))::timestamptz is distinct from (
          select e.updated_at from public.employees e where e.id = target_employee_id
        ) then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_CORE_VERSION_STALE';
      end if;
    end if;
  end if;

  if current_action.action_type = 'CREATE_EMPLOYEE' and not exists (
    select 1 from public.employees e
    where e.id = target_employee_id
      and e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.first_name = pg_catalog.btrim(current_decision.decision_payload #>> '{match,newEmployeeFields,firstName}')
      and e.birth_name = pg_catalog.btrim(current_decision.decision_payload #>> '{match,newEmployeeFields,birthName}')
      and e.gender = (current_decision.decision_payload #>> '{match,newEmployeeFields,gender}')::public.gender
      and e.birth_date is not distinct from case
        when current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' = 'USE_SOURCE' then current_person.birth_date
        else null end
      and e.nationality is null
      and e.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_READBACK_FAILED';
  end if;

  if current_action.action_type in ('CREATE_EMPLOYEE', 'ADD_ADMINISTRATION_ASSIGNMENT') and not exists (
    select 1 from public.employee_administration_assignments assignment
    where assignment.tenant_id = current_batch.tenant_id
      and assignment.hr_group_id = current_batch.hr_group_id
      and assignment.administration_id = current_batch.administration_id
      and assignment.employee_id = target_employee_id
      and assignment.effective_from = (
        select pg_catalog.min(i.starts_on)
        from public.payroll_import_income_relationships i
        where i.tenant_id = current_action.tenant_id
          and i.hr_group_id = current_action.hr_group_id
          and i.batch_id = current_action.batch_id
          and i.import_person_id = current_action.import_person_id
      )
      and assignment.effective_to is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ASSIGNMENT_READBACK_FAILED';
  end if;

  if current_action.action_type = 'UPDATE_EMPLOYEE_FIELDS' and not exists (
    select 1 from public.employees e
    where e.id = target_employee_id
      and e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.first_name = case
        when current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}' = 'USE_SOURCE' then current_person.first_name
        else e.first_name end
      and e.birth_name = case
        when current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}' = 'USE_SOURCE' then current_person.birth_name
        else e.birth_name end
      and e.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_READBACK_FAILED';
  end if;

  if current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' and not exists (
    select 1 from public.employments e
    where e.id = target_employment_id
      and e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.administration_id = current_batch.administration_id
      and e.employee_id = target_employee_id
      and e.payroll_import_person_id = current_person.id
      and e.employment_number = employment_number
      and e.contract_type = current_action.draft_employment_contract_type::public.contract_type
      and e.record_status = 'DRAFT'::public.employment_record_status
      and e.starts_on = current_action.draft_employment_starts_on
      and e.seniority_date = current_action.draft_employment_seniority_date
      and e.original_hire_date = current_action.draft_employment_original_hire_date
      and e.is_primary = false
      and e.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_READBACK_FAILED';
  end if;

  if target_employment_id is not null and current_action.action_type <> 'CREATE_DRAFT_EMPLOYMENT' then
    if requested_expected_versions ->> ('employment:' || target_employment_id::text) is null
      or not exists (
        select 1 from public.employments e
        where e.id = target_employment_id
          and e.tenant_id = current_batch.tenant_id
          and e.hr_group_id = current_batch.hr_group_id
          and e.administration_id = current_batch.administration_id
          and e.employee_id = target_employee_id
          and e.deleted_at is null
          and (requested_expected_versions ->> ('employment:' || e.id::text))::timestamptz = e.updated_at
      ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_VERSION_STALE';
    end if;
  end if;

  if current_action.action_type = 'ADD_ADMINISTRATION_ASSIGNMENT' then
    if target_employee_id is null
      or current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,employeeId}' is distinct from target_employee_id::text
      or current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or not exists (select 1 from public.administrations a
        where a.tenant_id = current_batch.tenant_id
          and a.hr_group_id = current_batch.hr_group_id
          and a.id = current_batch.administration_id) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ASSIGNMENT_SCOPE_MISMATCH';
    end if;
    select pg_catalog.min(i.starts_on) into assignment_start
    from public.payroll_import_income_relationships i
    where i.tenant_id = current_action.tenant_id
      and i.hr_group_id = current_action.hr_group_id
      and i.batch_id = current_action.batch_id
      and i.import_person_id = current_action.import_person_id;
    if assignment_start is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SOURCE_PERIOD_REQUIRED';
    end if;
    insert into public.employee_administration_assignments (
      tenant_id, hr_group_id, administration_id, employee_id, effective_from
    ) values (
      current_batch.tenant_id, current_batch.hr_group_id,
      current_batch.administration_id, target_employee_id, assignment_start
    ) on conflict do nothing;
  elsif current_action.action_type = 'UPDATE_EMPLOYEE_FIELDS' then
    if target_employee_id is null
      or current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,employeeId}' is distinct from target_employee_id::text
      or current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or coalesce(current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}', '') not in ('USE_SOURCE','KEEP_CURRENT','MANUAL_REVIEW')
      or coalesce(current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}', '') not in ('USE_SOURCE','KEEP_CURRENT','MANUAL_REVIEW') then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_FIELD_DECISION_INVALID';
    end if;
    if current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}' = 'USE_SOURCE'
      and current_person.first_name is null
      or current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}' = 'USE_SOURCE'
      and current_person.birth_name is null
      or exists (
        select 1 from pg_catalog.jsonb_each_text(current_decision.decision_payload -> 'sourceFieldDecisions') field
        where field.value = 'USE_SOURCE' and field.key not in ('firstName', 'birthName')
      ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_FIELD_DECISION_INVALID';
    end if;
    update public.employees e
    set first_name = case when current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}' = 'USE_SOURCE'
          and current_person.first_name is not null then current_person.first_name else e.first_name end,
        birth_name = case when current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}' = 'USE_SOURCE'
          and current_person.birth_name is not null then current_person.birth_name else e.birth_name end
    where e.id = target_employee_id
      and e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id;
  elsif current_action.action_type = 'REUSE_EMPLOYMENT' then
    if target_employee_id is null or target_employment_id is null
      or not exists (
        select 1
        from public.employments e
        join public.employee_administration_assignments assignment
          on assignment.tenant_id = e.tenant_id
          and assignment.hr_group_id = e.hr_group_id
          and assignment.administration_id = e.administration_id
          and assignment.employee_id = e.employee_id
          and assignment.effective_to is null
        where e.tenant_id = current_batch.tenant_id
          and e.hr_group_id = current_batch.hr_group_id
          and e.administration_id = current_batch.administration_id
          and e.employee_id = target_employee_id
          and e.id = target_employment_id
          and e.record_status = 'CONFIRMED'
          and e.deleted_at is null
      ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_MISMATCH';
    end if;
    for source_ref in
      select value from pg_catalog.jsonb_array_elements_text(current_action.source_refs)
    loop
      if source_ref = source_person_ref
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'action'] is distinct from 'REUSE_EMPLOYMENT'
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'confirmed'] is distinct from 'true'
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'employmentId'] is distinct from target_employment_id::text then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_DECISION_STALE';
      end if;
      if exists (
        select 1 from (
          select i.*, (pg_catalog.row_number() over (order by i.id) - 1)::integer as income_index
          from public.payroll_import_income_relationships i
          where i.tenant_id = current_action.tenant_id
            and i.hr_group_id = current_action.hr_group_id
            and i.batch_id = current_action.batch_id
            and i.import_person_id = current_action.import_person_id
        ) i
        join public.employments employment on employment.id = target_employment_id
        where source_ref = source_person_ref || ':income-' || i.income_index::text
            || ':' || i.payroll_tax_number || ':' || i.ikv_number::text
            || ':' || coalesce(i.starts_on::text, '')
          and (employment.starts_on > i.starts_on
            or employment.ends_on is not null and (i.ends_on is null or employment.ends_on < i.ends_on))
      ) then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_PERIOD_STALE';
      end if;
    end loop;
  elsif current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' then
    if target_employee_id is null
      or current_action.draft_employment_contract_type is null
      or current_action.draft_employment_starts_on is null
      or current_action.draft_employment_seniority_date is null
      or current_action.draft_employment_original_hire_date is null
      or current_action.target_employment_ref is distinct from ('draft-employment:' || current_batch.id::text || ':' || source_person_ref)
      or coalesce(current_decision.decision_payload #>> '{match,action}', '') not in ('REUSE_EMPLOYEE','CREATE_EMPLOYEE') then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_TERMS_INVALID';
    end if;
    if (current_decision.decision_payload #>> '{match,action}') = 'REUSE_EMPLOYEE'
      and current_decision.decision_payload #>> '{match,employeeId}' is distinct from target_employee_id::text
      or (current_decision.decision_payload #>> '{match,action}') = 'CREATE_EMPLOYEE'
      and (current_action.target_employee_ref is distinct from ('new-employee:' || current_batch.id::text || ':' || source_person_ref)
        or not exists (
          select 1 from public.payroll_import_finalization_actions created
          where created.tenant_id = current_action.tenant_id
            and created.hr_group_id = current_action.hr_group_id
            and created.batch_id = current_action.batch_id
            and created.plan_id = current_action.plan_id
            and created.import_person_id = current_action.import_person_id
            and created.action_type = 'CREATE_EMPLOYEE'
            and created.target_employee_ref = current_action.target_employee_ref
            and created.status = 'COMPLETED'
            and created.checkpoint ->> 'createdEmployeeId' = target_employee_id::text
        )) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
    for source_ref in
      select value from pg_catalog.jsonb_array_elements_text(current_action.source_refs)
    loop
      if source_ref = source_person_ref
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'action'] is distinct from 'CREATE_DRAFT_EMPLOYMENT'
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'confirmed'] is distinct from 'true'
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'contractType'] is distinct from current_action.draft_employment_contract_type
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'startsOn'] is distinct from current_action.draft_employment_starts_on::text
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'seniorityDate'] is distinct from current_action.draft_employment_seniority_date::text
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'originalHireDate'] is distinct from current_action.draft_employment_original_hire_date::text then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_DECISION_STALE';
      end if;
    end loop;
    if exists (
      select 1 from public.payroll_import_income_relationships i
      where i.tenant_id = current_action.tenant_id
        and i.hr_group_id = current_action.hr_group_id
        and i.batch_id = current_action.batch_id
        and i.import_person_id = current_action.import_person_id
        and i.starts_on < current_action.draft_employment_starts_on
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_PERIOD_MISMATCH';
    end if;
    if exists (
      select 1 from public.employments e
      where e.tenant_id = current_action.tenant_id
        and e.hr_group_id = current_action.hr_group_id
        and e.payroll_import_person_id = current_action.import_person_id
    ) then
      raise exception using errcode = '23505', message = 'PAYROLL_FINALIZATION_IDEMPOTENCY_CONFLICT';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      current_batch.tenant_id::text || ':' || target_employee_id::text, 0
    ));
    select (coalesce(pg_catalog.max(nullif(e.employment_number, '')::numeric), 0) + 1)::text
    into employment_number
    from public.employments e
    where e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.employee_id = target_employee_id
      and e.employment_number ~ '^[0-9]+$';
    insert into public.employments (
      tenant_id, hr_group_id, administration_id, employee_id,
      employment_number, employment_type, contract_type, record_status,
      starts_on, seniority_date, original_hire_date, is_primary,
      payroll_import_person_id
    ) values (
      current_batch.tenant_id, current_batch.hr_group_id,
      current_batch.administration_id, target_employee_id,
      employment_number, 'EMPLOYEE'::public.employment_type,
      current_action.draft_employment_contract_type::public.contract_type,
      'DRAFT'::public.employment_record_status,
      current_action.draft_employment_starts_on,
      current_action.draft_employment_seniority_date,
      current_action.draft_employment_original_hire_date,
      false, current_person.id
    ) returning id into target_employment_id;
  end if;

  if current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE') then
    if target_employee_id is null or current_action.source_income_ref is null
      or current_action.source_refs <> pg_catalog.jsonb_build_array(current_action.source_income_ref)
      or current_action.source_payroll_tax_number is null
      or current_action.source_ikv_number is null
      or current_action.source_starts_on is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_INVALID';
    end if;
    select numbered.* into source_income
    from (
      select i.*, (pg_catalog.row_number() over (order by i.id) - 1)::integer as income_index
      from public.payroll_import_income_relationships i
      where i.tenant_id = current_action.tenant_id
        and i.hr_group_id = current_action.hr_group_id
        and i.administration_id = current_action.administration_id
        and i.batch_id = current_action.batch_id
        and i.import_person_id = current_action.import_person_id
    ) numbered
    where current_action.source_income_ref = source_person_ref || ':income-' || numbered.income_index::text
      || ':' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text
      || ':' || coalesce(numbered.starts_on::text, '');
    if not found
      or source_income.payroll_tax_number <> current_action.source_payroll_tax_number
      or source_income.ikv_number <> current_action.source_ikv_number
      or source_income.starts_on <> current_action.source_starts_on
      or source_income.ends_on is distinct from current_action.source_ends_on
      or source_income.starts_on is null
      or source_income.ends_on is not null and source_income.ends_on < source_income.starts_on then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_SOURCE_MISMATCH';
    end if;
    income_start := source_income.starts_on;
    income_end := source_income.ends_on;

    if current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'confirmed'] is distinct from 'true'
      or current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'action'] not in ('REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT')
      or (current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'action']) = 'REUSE_EMPLOYMENT'
        and current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'employmentId'] is distinct from target_employment_id::text
      or (current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'action']) = 'CREATE_DRAFT_EMPLOYMENT'
        and not exists (
          select 1 from public.payroll_import_finalization_actions created
          where created.tenant_id = current_action.tenant_id
            and created.hr_group_id = current_action.hr_group_id
            and created.batch_id = current_action.batch_id
            and created.plan_id = current_action.plan_id
            and created.import_person_id = current_action.import_person_id
            and created.action_type = 'CREATE_DRAFT_EMPLOYMENT'
            and created.target_employment_ref = current_action.target_employment_ref
            and created.status = 'COMPLETED'
            and created.checkpoint ->> 'createdEmploymentId' = target_employment_id::text
            and current_action.source_income_ref = any(array(select pg_catalog.jsonb_array_elements_text(created.source_refs)))
        )
      or target_employment_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_DECISION_STALE';
    end if;

    if current_action.action_type = 'CREATE_INCOME_RELATIONSHIP' then
      if current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'action'] is distinct from 'CREATE'
        or current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'confirmed'] is distinct from 'true'
        or current_person.status = 'BLOCKING'
        or not exists (
          select 1 from public.administration_payroll_tax_numbers binding
          where binding.tenant_id = current_batch.tenant_id
            and binding.hr_group_id = current_batch.hr_group_id
            and binding.administration_id = current_batch.administration_id
            and binding.payroll_tax_number = current_action.source_payroll_tax_number
            and binding.valid_from <= income_start
            and (binding.valid_until is null or income_end is not null and binding.valid_until >= income_end)
            and requested_expected_versions ->> ('binding:' || binding.id::text) is not null
            and (requested_expected_versions ->> ('binding:' || binding.id::text))::timestamptz = binding.updated_at
        ) then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_TAX_BINDING_SCOPE_OR_PERIOD_INVALID';
      end if;
      select binding.* into tax_binding
      from public.administration_payroll_tax_numbers binding
      where binding.tenant_id = current_batch.tenant_id
        and binding.hr_group_id = current_batch.hr_group_id
        and binding.administration_id = current_batch.administration_id
        and binding.payroll_tax_number = current_action.source_payroll_tax_number
        and binding.valid_from <= income_start
        and (binding.valid_until is null or income_end is not null and binding.valid_until >= income_end)
        and requested_expected_versions ->> ('binding:' || binding.id::text) is not null
        and (requested_expected_versions ->> ('binding:' || binding.id::text))::timestamptz = binding.updated_at
      order by binding.valid_from desc, binding.id
      limit 1
      for share;

      if exists (
        select 1 from public.income_relationships existing
        where existing.tenant_id = current_batch.tenant_id
          and existing.administration_id = current_batch.administration_id
          and existing.payroll_tax_number = current_action.source_payroll_tax_number
          and existing.ikv_number = current_action.source_ikv_number
          and existing.deleted_at is null
      ) then
        raise exception using errcode = '23505', message = 'PAYROLL_FINALIZATION_DUPLICATE_IKV_IDENTITY';
      end if;
      insert into public.income_relationships (
        tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, ends_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) values (
        current_batch.tenant_id, current_batch.administration_id,
        target_employee_id, pg_catalog.right(current_action.source_payroll_tax_number, 2),
        current_action.source_ikv_number, 'EMPLOYMENT'::public.income_relationship_type,
        income_start, income_end, 'DRAFT'::public.payroll_reporting_status,
        current_action.source_payroll_tax_number, current_batch.hr_group_id, tax_binding.id
      ) returning id into target_income_relationship_id;
      if target_employment_id is null then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_TARGET_REQUIRED';
      end if;
      insert into public.employment_income_relationships (
        tenant_id, administration_id, employee_id, employment_id,
        income_relationship_id, valid_from, valid_until
      ) values (
        current_batch.tenant_id, current_batch.administration_id,
        target_employee_id, target_employment_id,
        target_income_relationship_id, income_start,
        case when income_end is null then null else income_end + 1 end
      );
    else
      target_income_relationship_id := current_action.target_income_relationship_id;
      if target_income_relationship_id is null then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_OR_VERSION_STALE';
      end if;
      select * into target_income_row
      from public.income_relationships existing
      where existing.id = target_income_relationship_id
        and existing.tenant_id = current_batch.tenant_id
        and existing.administration_id = current_batch.administration_id
        and existing.employee_id = target_employee_id
        and existing.payroll_tax_number = current_action.source_payroll_tax_number
        and existing.ikv_number = current_action.source_ikv_number
        and existing.starts_on = income_start
        and existing.ends_on is not distinct from income_end
        and existing.deleted_at is null
      for update;
      if not found
        or requested_expected_versions ->> ('income:' || target_income_relationship_id::text) is null
        or (requested_expected_versions ->> ('income:' || target_income_relationship_id::text))::timestamptz is distinct from target_income_row.updated_at then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_OR_VERSION_STALE';
      end if;
      if current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'incomeRelationshipId']
        is distinct from target_income_relationship_id::text
        and current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'action'] is distinct from 'NO_CHANGE' then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_SELECTION_STALE';
      end if;
      if current_action.action_type = 'NO_CHANGE'
        and current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'action'] is distinct from 'NO_CHANGE' then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
      end if;
      if current_action.action_type = 'LINK_INCOME_RELATIONSHIP' then
        if current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'action'] is distinct from 'LINK'
          or current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'confirmed'] is distinct from 'true' then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
        end if;
        if target_employment_id is null then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_TARGET_REQUIRED';
        end if;
        if not exists (
          select 1 from public.employments e
          where e.id = target_employment_id
            and e.tenant_id = current_batch.tenant_id
            and e.hr_group_id = current_batch.hr_group_id
            and e.administration_id = current_batch.administration_id
            and e.employee_id = target_employee_id
            and e.record_status in ('CONFIRMED','DRAFT')
            and e.deleted_at is null
            and requested_expected_versions ->> ('employment:' || e.id::text) is not null
            and (requested_expected_versions ->> ('employment:' || e.id::text))::timestamptz = e.updated_at
            and e.starts_on <= income_start
            and (e.ends_on is null or income_end is not null and e.ends_on >= income_end)
        ) then
          raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_PERIOD_STALE';
        end if;
        if not exists (
          select 1 from public.employment_income_relationships link
          where link.tenant_id = current_batch.tenant_id
            and link.administration_id = current_batch.administration_id
            and link.employee_id = target_employee_id
            and link.employment_id = target_employment_id
            and link.income_relationship_id = target_income_relationship_id
            and link.valid_from = income_start
            and link.valid_until is not distinct from case when income_end is null then null else income_end + 1 end
        ) then
          insert into public.employment_income_relationships (
            tenant_id, administration_id, employee_id, employment_id,
            income_relationship_id, valid_from, valid_until
          ) values (
            current_batch.tenant_id, current_batch.administration_id,
            target_employee_id, target_employment_id,
            target_income_relationship_id, income_start,
            case when income_end is null then null else income_end + 1 end
          );
        end if;
      elsif current_action.action_type = 'NO_CHANGE' then
        if current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'confirmed'] is distinct from 'true'
          or current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'action'] is distinct from 'REUSE_EMPLOYMENT'
          or current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'employmentId'] is distinct from target_employment_id::text
          or target_employment_id is null then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
        end if;
        if target_employment_id is not null and not exists (
          select 1 from public.employment_income_relationships link
          where link.tenant_id = current_batch.tenant_id
            and link.administration_id = current_batch.administration_id
            and link.employee_id = target_employee_id
            and link.employment_id = target_employment_id
            and link.income_relationship_id = target_income_relationship_id
            and link.valid_from = income_start
            and link.valid_until is not distinct from case when income_end is null then null else income_end + 1 end
        ) then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EXISTING_LINK_READBACK_FAILED';
        end if;
      end if;
    end if;

  end if;

  if current_action.action_type in ('REUSE_EMPLOYMENT','CREATE_DRAFT_EMPLOYMENT','LINK_INCOME_RELATIONSHIP','CREATE_INCOME_RELATIONSHIP') then
    if target_employment_id is null or not exists (
      select 1 from public.employments e
      where e.id = target_employment_id
        and e.tenant_id = current_batch.tenant_id
        and e.hr_group_id = current_batch.hr_group_id
        and e.administration_id = current_batch.administration_id
        and e.employee_id = target_employee_id
        and e.deleted_at is null
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_READBACK_FAILED';
    end if;
  end if;

  if current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE')
    and not exists (
      select 1 from public.income_relationships i
      where i.id = target_income_relationship_id
        and i.tenant_id = current_batch.tenant_id
        and i.administration_id = current_batch.administration_id
        and i.employee_id = target_employee_id
        and i.payroll_tax_number = current_action.source_payroll_tax_number
        and i.ikv_number = current_action.source_ikv_number
        and i.starts_on = current_action.source_starts_on
        and i.ends_on is not distinct from current_action.source_ends_on
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_READBACK_FAILED';
  end if;

  if current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE')
    and not exists (
      select 1 from public.employment_income_relationships link
      where link.tenant_id = current_batch.tenant_id
        and link.administration_id = current_batch.administration_id
        and link.employee_id = target_employee_id
        and link.employment_id = target_employment_id
        and link.income_relationship_id = target_income_relationship_id
        and link.valid_from = current_action.source_starts_on
        and link.valid_until is not distinct from case
          when current_action.source_ends_on is null then null
          else current_action.source_ends_on + 1 end
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_LINK_READBACK_FAILED';
  end if;

  readback_document := pg_catalog.jsonb_build_object(
    'actionId', current_action.action_id,
    'actionType', current_action.action_type,
    'tenantId', current_action.tenant_id,
    'hrGroupId', current_action.hr_group_id,
    'administrationId', current_action.administration_id,
    'batchId', current_action.batch_id,
    'employeeId', target_employee_id,
    'employmentId', target_employment_id,
    'incomeRelationshipId', target_income_relationship_id,
    'sourceHash', current_action.source_hash,
    'decisionHash', current_action.decision_hash,
    'attempt', current_action.attempt_count
  );
  readback_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(readback_document::text, 'UTF8'), 'sha256'
  ), 'hex');
  action_checkpoint := coalesce(current_action.checkpoint, '{}'::jsonb)
    || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'targetEmployeeRef', current_action.target_employee_ref,
      'targetEmploymentRef', current_action.target_employment_ref,
      'createdEmployeeId', case when current_action.action_type = 'CREATE_EMPLOYEE' then target_employee_id::text end,
      'createdEmploymentId', case when current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' then target_employment_id::text end,
      'incomeRelationshipId', target_income_relationship_id::text,
      'completionProof', pg_catalog.jsonb_build_object(
        'readbackVerified', true,
        'executionId', current_action.id::text,
        'readbackHash', readback_hash,
        'sourceHash', current_action.source_hash,
        'analysisHash', current_action.analysis_hash,
        'coreStateHash', current_action.core_state_hash
      )
    ));

  select * into event_result
  from public.record_payroll_import_finalization_event(
    current_action.tenant_id,
    current_action.hr_group_id,
    current_action.batch_id,
    current_action.action_id,
    'core-completed:' || current_action.attempt_count::text || ':' || current_action.lease_owner::text,
    'COMPLETED',
    requested_actor_user_id,
    current_action.attempt_count,
    current_action.source_hash,
    current_action.analysis_hash,
    current_action.core_state_hash,
    action_checkpoint,
    null,
    current_action.lease_until,
    current_action.lease_owner,
    current_action.lease_token_hash
  );
  if event_result.status <> 'COMPLETED' then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_COMPLETION_READBACK_FAILED';
  end if;

  select p.completed_action_count, p.expected_action_count
  into completed_count, expected_count
  from public.payroll_import_finalization_plans p
  where p.id = current_plan.id;
  if completed_count = expected_count then
    update public.payroll_import_batches b
    set status = 'COMPLETED', finalized_at = pg_catalog.now()
    where b.id = current_batch.id
      and b.tenant_id = current_batch.tenant_id
      and b.hr_group_id = current_batch.hr_group_id
      and b.administration_id = current_batch.administration_id
      and b.status in ('STAGED','READY','FINALIZING');
    insert into public.audit_logs (
      tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes
    ) values (
      current_batch.tenant_id, current_batch.administration_id,
      'payroll_import_batch', current_batch.id, requested_actor_user_id, 'UPDATE',
      pg_catalog.jsonb_build_object(
        'operation', 'CONTROL02_TEST_FINALIZE',
        'planHash', current_plan.plan_hash,
        'actionCount', expected_count,
        'sourceHash', current_batch.source_hash,
        'contractVersion', current_plan.contract_version
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'actionId', current_action.action_id,
    'status', event_result.status,
    'attemptCount', current_action.attempt_count,
    'checkpoint', action_checkpoint,
    'readbackHash', readback_hash,
    'planStatus', case when completed_count = expected_count then 'COMPLETED' else 'IN_PROGRESS' end
  );
end;
$$;

revoke all on function public.execute_control02_test_payroll_finalization_action(
  uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.execute_control02_test_payroll_finalization_action(
  uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text
) to service_role;

comment on function public.execute_control02_test_payroll_finalization_action(
  uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text
) is 'TEST-only CONTROL02 Core writer with lease fencing, exact XML provenance, scoped Core writes, readback, and ledger completion in one PostgreSQL transaction.';

create function public.control02_test_finalization_schema_ready()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select not exists (
      select 1
      from pg_catalog.unnest(array[
        'public.payroll_import_decisions',
        'public.payroll_import_finalization_plans',
        'public.payroll_import_finalization_plan_events',
        'public.payroll_import_finalization_actions',
        'public.payroll_import_finalization_action_events',
        'public.payroll_import_xml_provenance',
        'public.payroll_import_protected_identifiers'
      ]::text[]) as required(relation_name)
      where pg_catalog.to_regclass(required.relation_name) is null
        or not exists (
          select 1 from pg_catalog.pg_class c
          where c.oid = pg_catalog.to_regclass(required.relation_name)
            and c.relrowsecurity
        )
    )
    and pg_catalog.to_regclass('public.payroll_import_persons_tenant_hr_group_batch_id_key') is not null
    and pg_catalog.to_regclass('public.income_relationships_ikv_employee_active_key') is not null
    and pg_catalog.to_regclass('public.income_relationships_full_lhnr_ikv_active_key') is not null
    and pg_catalog.to_regprocedure('public.execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)') is not null
    and pg_catalog.has_function_privilege(
      'service_role',
      pg_catalog.to_regprocedure('public.execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)'),
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure('public.execute_control02_test_payroll_finalization_action(uuid,uuid,uuid,text,uuid,uuid,text,jsonb,text)'),
      'EXECUTE'
    )
    and exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = to_regclass('public.income_relationships')
        and a.attname = 'payroll_tax_number'
        and not a.attisdropped
    )
    and exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.income_relationships')
        and a.attname = 'payroll_tax_binding_hr_group_id'
        and not a.attisdropped
    )
    and exists (
      select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.income_relationships')
        and a.attname = 'payroll_tax_binding_id'
        and not a.attisdropped
    );
$$;
revoke all on function public.control02_test_finalization_schema_ready() from public, anon, authenticated;
grant execute on function public.control02_test_finalization_schema_ready() to service_role;

commit;
