begin;

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
  resolved_target_employee_id uuid;
  resolved_target_employment_id uuid;
  resolved_target_income_relationship_id uuid;
  protected_identifier record;
  tax_binding record;
  income_start date;
  income_end date;
  assignment_start date;
  resolved_employment_number text;
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
    or exists (select 1 from pg_catalog.jsonb_each(requested_expected_versions) e where pg_catalog.jsonb_typeof(e.value) <> 'string') then
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
    or current_plan.contract_version is distinct from 'CONTROL02-CORE-PAYROLL-TEST-CANDIDATE-2'
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
      numbered.starts_on, numbered.ends_on, numbered.updated_at
    into source_income
    from (
      select i.id, i.payroll_tax_number, i.ikv_number, i.starts_on, i.ends_on, i.updated_at
      from public.payroll_import_income_relationships i
      where i.tenant_id = current_action.tenant_id
        and i.hr_group_id = current_action.hr_group_id
        and i.administration_id = current_action.administration_id
        and i.batch_id = current_action.batch_id
        and i.import_person_id = current_action.import_person_id
    ) numbered
    where source_ref = source_person_ref || ':income:' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text
      || ':' || coalesce(numbered.starts_on::text, '') || ':' || coalesce(numbered.ends_on::text, '');
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
    resolved_target_employee_id := current_action.target_employee_id;
  elsif current_action.target_employee_ref is not null
    and current_action.action_type <> 'CREATE_EMPLOYEE' then
    select (prior.checkpoint ->> 'createdEmployeeId')::uuid into resolved_target_employee_id
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
    resolved_target_employment_id := current_action.target_employment_id;
  elsif current_action.target_employment_ref is not null
    and current_action.action_type <> 'CREATE_DRAFT_EMPLOYMENT' then
    select (prior.checkpoint ->> 'createdEmploymentId')::uuid into resolved_target_employment_id
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
      or resolved_target_employee_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_DECISION_STALE';
    end if;
    if (current_decision.decision_payload #>> '{match,action}') = 'REUSE_EMPLOYEE'
      and current_decision.decision_payload #>> '{match,employeeId}' is distinct from resolved_target_employee_id::text
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
            and created.checkpoint ->> 'createdEmployeeId' = resolved_target_employee_id::text
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
    ) returning id into resolved_target_employee_id;

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
        resolved_target_employee_id, current_batch.tenant_id,
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
      current_batch.administration_id, resolved_target_employee_id, assignment_start
    ) on conflict do nothing;

  elsif current_action.action_type = 'REUSE_EMPLOYEE' then
    if current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,employeeId}' is distinct from resolved_target_employee_id::text
      or current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or resolved_target_employee_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
    if current_person.bsn_fingerprint is not null and not exists (
      select 1 from public.employee_secure_identifiers secure
      where secure.tenant_id = current_batch.tenant_id
        and secure.employee_id = resolved_target_employee_id
        and secure.bsn_fingerprint = current_person.bsn_fingerprint
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_IDENTITY_CONFLICT';
    end if;
  end if;

  if resolved_target_employee_id is not null then
    perform 1 from public.employees e
    where e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.id = resolved_target_employee_id
      and e.deleted_at is null
    for update;
    if not found then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SCOPE_MISMATCH';
    end if;
    if current_action.action_type <> 'CREATE_EMPLOYEE' then
      if requested_expected_versions ->> ('employee:' || resolved_target_employee_id::text) is null
        or (requested_expected_versions ->> ('employee:' || resolved_target_employee_id::text))::timestamptz is distinct from (
          select e.updated_at from public.employees e where e.id = resolved_target_employee_id
        ) then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_CORE_VERSION_STALE';
      end if;
    end if;
  end if;

  if current_action.action_type = 'CREATE_EMPLOYEE' and not exists (
    select 1 from public.employees e
    where e.id = resolved_target_employee_id
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
      and assignment.employee_id = resolved_target_employee_id
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
    where e.id = resolved_target_employee_id
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

  if current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' and resolved_target_employment_id is not null and not exists (
    select 1 from public.employments e
    where e.id = resolved_target_employment_id
      and e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.administration_id = current_batch.administration_id
      and e.employee_id = resolved_target_employee_id
      and e.payroll_import_person_id = current_person.id
      and e.employment_number = resolved_employment_number
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

  if resolved_target_employment_id is not null and current_action.action_type <> 'CREATE_DRAFT_EMPLOYMENT' then
    if requested_expected_versions ->> ('employment:' || resolved_target_employment_id::text) is null
      or not exists (
        select 1 from public.employments e
        where e.id = resolved_target_employment_id
          and e.tenant_id = current_batch.tenant_id
          and e.hr_group_id = current_batch.hr_group_id
          and e.administration_id = current_batch.administration_id
          and e.employee_id = resolved_target_employee_id
          and e.deleted_at is null
          and (requested_expected_versions ->> ('employment:' || e.id::text))::timestamptz = e.updated_at
      ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_VERSION_STALE';
    end if;
  end if;

  if current_action.action_type = 'ADD_ADMINISTRATION_ASSIGNMENT' then
    if resolved_target_employee_id is null
      or current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,employeeId}' is distinct from resolved_target_employee_id::text
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
      current_batch.administration_id, resolved_target_employee_id, assignment_start
    ) on conflict do nothing;
  elsif current_action.action_type = 'UPDATE_EMPLOYEE_FIELDS' then
    if resolved_target_employee_id is null
      or current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or current_decision.decision_payload #>> '{match,employeeId}' is distinct from resolved_target_employee_id::text
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
    where e.id = resolved_target_employee_id
      and e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id;
  elsif current_action.action_type = 'REUSE_EMPLOYMENT' then
    if resolved_target_employee_id is null or resolved_target_employment_id is null
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
          and e.employee_id = resolved_target_employee_id
          and e.id = resolved_target_employment_id
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
        or current_decision.decision_payload #>> array['employmentByIncomeRelationship', source_ref, 'employmentId'] is distinct from resolved_target_employment_id::text then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_DECISION_STALE';
      end if;
      if exists (
        select 1 from (
          select i.*
          from public.payroll_import_income_relationships i
          where i.tenant_id = current_action.tenant_id
            and i.hr_group_id = current_action.hr_group_id
            and i.batch_id = current_action.batch_id
            and i.import_person_id = current_action.import_person_id
        ) i
        join public.employments employment on employment.id = resolved_target_employment_id
        where source_ref = source_person_ref || ':income:' || i.payroll_tax_number || ':' || i.ikv_number::text
            || ':' || coalesce(i.starts_on::text, '') || ':' || coalesce(i.ends_on::text, '')
          and (employment.starts_on > i.starts_on
            or employment.ends_on is not null and (i.ends_on is null or employment.ends_on < i.ends_on))
      ) then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_PERIOD_STALE';
      end if;
    end loop;
  elsif current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' then
    if resolved_target_employee_id is null
      or current_action.draft_employment_contract_type is null
      or current_action.draft_employment_starts_on is null
      or current_action.draft_employment_seniority_date is null
      or current_action.draft_employment_original_hire_date is null
      or current_action.target_employment_ref is distinct from ('draft-employment:' || current_batch.id::text || ':' || source_person_ref)
      or coalesce(current_decision.decision_payload #>> '{match,action}', '') not in ('REUSE_EMPLOYEE','CREATE_EMPLOYEE') then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_TERMS_INVALID';
    end if;
    if (current_decision.decision_payload #>> '{match,action}') = 'REUSE_EMPLOYEE'
      and current_decision.decision_payload #>> '{match,employeeId}' is distinct from resolved_target_employee_id::text
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
            and created.checkpoint ->> 'createdEmployeeId' = resolved_target_employee_id::text
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
      current_batch.tenant_id::text || ':' || resolved_target_employee_id::text, 0
    ));
    select (coalesce(pg_catalog.max(nullif(e.employment_number, '')::numeric), 0) + 1)::text
    into resolved_employment_number
    from public.employments e
    where e.tenant_id = current_batch.tenant_id
      and e.hr_group_id = current_batch.hr_group_id
      and e.employee_id = resolved_target_employee_id
      and e.employment_number ~ '^[0-9]+$';
    insert into public.employments (
      tenant_id, hr_group_id, administration_id, employee_id,
      employment_number, employment_type, contract_type, record_status,
      starts_on, seniority_date, original_hire_date, is_primary,
      payroll_import_person_id
    ) values (
      current_batch.tenant_id, current_batch.hr_group_id,
      current_batch.administration_id, resolved_target_employee_id,
      resolved_employment_number, 'EMPLOYEE'::public.employment_type,
      current_action.draft_employment_contract_type::public.contract_type,
      'DRAFT'::public.employment_record_status,
      current_action.draft_employment_starts_on,
      current_action.draft_employment_seniority_date,
      current_action.draft_employment_original_hire_date,
      false, current_person.id
    ) returning id into resolved_target_employment_id;
  end if;

  if current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE') then
    if resolved_target_employee_id is null or current_action.source_income_ref is null
      or current_action.source_refs <> pg_catalog.jsonb_build_array(current_action.source_income_ref)
      or current_action.source_payroll_tax_number is null
      or current_action.source_ikv_number is null
      or current_action.source_starts_on is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_INVALID';
    end if;
    select numbered.* into source_income
    from (
      select i.*
      from public.payroll_import_income_relationships i
      where i.tenant_id = current_action.tenant_id
        and i.hr_group_id = current_action.hr_group_id
        and i.administration_id = current_action.administration_id
        and i.batch_id = current_action.batch_id
        and i.import_person_id = current_action.import_person_id
    ) numbered
    where current_action.source_income_ref = source_person_ref || ':income:' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text
      || ':' || coalesce(numbered.starts_on::text, '') || ':' || coalesce(numbered.ends_on::text, '');
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
        and current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'employmentId'] is distinct from resolved_target_employment_id::text
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
            and created.checkpoint ->> 'createdEmploymentId' = resolved_target_employment_id::text
            and current_action.source_income_ref = any(array(select pg_catalog.jsonb_array_elements_text(created.source_refs)))
        )
      or resolved_target_employment_id is null then
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
        resolved_target_employee_id, pg_catalog.right(current_action.source_payroll_tax_number, 2),
        current_action.source_ikv_number, 'EMPLOYMENT'::public.income_relationship_type,
        income_start, income_end, 'DRAFT'::public.payroll_reporting_status,
        current_action.source_payroll_tax_number, current_batch.hr_group_id, tax_binding.id
      ) returning id into resolved_target_income_relationship_id;
      if resolved_target_employment_id is null then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_TARGET_REQUIRED';
      end if;
      insert into public.employment_income_relationships (
        tenant_id, administration_id, employee_id, employment_id,
        income_relationship_id, valid_from, valid_until
      ) values (
        current_batch.tenant_id, current_batch.administration_id,
        resolved_target_employee_id, resolved_target_employment_id,
        resolved_target_income_relationship_id, income_start,
        case when income_end is null then null else income_end + 1 end
      );
    else
      resolved_target_income_relationship_id := current_action.target_income_relationship_id;
      if resolved_target_income_relationship_id is null then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_OR_VERSION_STALE';
      end if;
      select * into target_income_row
      from public.income_relationships existing
      where existing.id = resolved_target_income_relationship_id
        and existing.tenant_id = current_batch.tenant_id
        and existing.administration_id = current_batch.administration_id
        and existing.employee_id = resolved_target_employee_id
        and existing.payroll_tax_number = current_action.source_payroll_tax_number
        and existing.ikv_number = current_action.source_ikv_number
        and existing.starts_on = income_start
        and existing.ends_on is not distinct from income_end
        and existing.deleted_at is null
      for update;
      if not found
        or requested_expected_versions ->> ('income:' || resolved_target_income_relationship_id::text) is null
        or (requested_expected_versions ->> ('income:' || resolved_target_income_relationship_id::text))::timestamptz is distinct from target_income_row.updated_at then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_OR_VERSION_STALE';
      end if;
      if current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'incomeRelationshipId']
        is distinct from resolved_target_income_relationship_id::text
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
        if resolved_target_employment_id is null then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_TARGET_REQUIRED';
        end if;
        if not exists (
          select 1 from public.employments e
          where e.id = resolved_target_employment_id
            and e.tenant_id = current_batch.tenant_id
            and e.hr_group_id = current_batch.hr_group_id
            and e.administration_id = current_batch.administration_id
            and e.employee_id = resolved_target_employee_id
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
            and link.employee_id = resolved_target_employee_id
            and link.employment_id = resolved_target_employment_id
            and link.income_relationship_id = resolved_target_income_relationship_id
            and link.valid_from = income_start
            and link.valid_until is not distinct from case when income_end is null then null else income_end + 1 end
        ) then
          insert into public.employment_income_relationships (
            tenant_id, administration_id, employee_id, employment_id,
            income_relationship_id, valid_from, valid_until
          ) values (
            current_batch.tenant_id, current_batch.administration_id,
            resolved_target_employee_id, resolved_target_employment_id,
            resolved_target_income_relationship_id, income_start,
            case when income_end is null then null else income_end + 1 end
          );
        end if;
      elsif current_action.action_type = 'NO_CHANGE' then
        if current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', current_action.source_income_ref, 'confirmed'] is distinct from 'true'
          or current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'action'] is distinct from 'REUSE_EMPLOYMENT'
          or current_decision.decision_payload #>> array['employmentByIncomeRelationship', current_action.source_income_ref, 'employmentId'] is distinct from resolved_target_employment_id::text
          or resolved_target_employment_id is null then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
        end if;
        if resolved_target_employment_id is not null and not exists (
          select 1 from public.employment_income_relationships link
          where link.tenant_id = current_batch.tenant_id
            and link.administration_id = current_batch.administration_id
            and link.employee_id = resolved_target_employee_id
            and link.employment_id = resolved_target_employment_id
            and link.income_relationship_id = resolved_target_income_relationship_id
            and link.valid_from = income_start
            and link.valid_until is not distinct from case when income_end is null then null else income_end + 1 end
        ) then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EXISTING_LINK_READBACK_FAILED';
        end if;
      end if;
    end if;

  end if;

  if current_action.action_type in ('REUSE_EMPLOYMENT','CREATE_DRAFT_EMPLOYMENT','LINK_INCOME_RELATIONSHIP','CREATE_INCOME_RELATIONSHIP') then
    if resolved_target_employment_id is null or not exists (
      select 1 from public.employments e
      where e.id = resolved_target_employment_id
        and e.tenant_id = current_batch.tenant_id
        and e.hr_group_id = current_batch.hr_group_id
        and e.administration_id = current_batch.administration_id
        and e.employee_id = resolved_target_employee_id
        and e.deleted_at is null
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_READBACK_FAILED';
    end if;
  end if;

  if current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE')
    and not exists (
      select 1 from public.income_relationships i
      where i.id = resolved_target_income_relationship_id
        and i.tenant_id = current_batch.tenant_id
        and i.administration_id = current_batch.administration_id
        and i.employee_id = resolved_target_employee_id
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
        and link.employee_id = resolved_target_employee_id
        and link.employment_id = resolved_target_employment_id
        and link.income_relationship_id = resolved_target_income_relationship_id
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
    'employeeId', resolved_target_employee_id,
    'employmentId', resolved_target_employment_id,
    'incomeRelationshipId', resolved_target_income_relationship_id,
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
      'createdEmployeeId', case when current_action.action_type = 'CREATE_EMPLOYEE' then resolved_target_employee_id::text end,
      'createdEmploymentId', case when current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' then resolved_target_employment_id::text end,
      'incomeRelationshipId', resolved_target_income_relationship_id::text,
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
    null,
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

revoke all on function public.execute_control02_test_payroll_finalization_action(uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.execute_control02_test_payroll_finalization_action(uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text) to service_role;
commit;
