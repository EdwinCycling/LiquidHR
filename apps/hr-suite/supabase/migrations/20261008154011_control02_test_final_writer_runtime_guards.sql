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
  v_current_action public.payroll_import_finalization_actions%rowtype;
  v_current_plan public.payroll_import_finalization_plans%rowtype;
  v_current_batch public.payroll_import_batches%rowtype;
  v_current_decision public.payroll_import_decisions%rowtype;
  v_current_person public.payroll_import_persons%rowtype;
  v_target_income_row public.income_relationships%rowtype;
  v_source_income record;
  v_source_ref text;
  v_source_person_ref text;
  v_expected_material text;
  v_resolved_target_employee_id uuid;
  v_target_employment_id uuid;
  v_target_income_relationship_id uuid;
  v_protected_identifier record;
  v_tax_binding record;
  v_income_start date;
  v_income_end date;
  v_assignment_start date;
  v_resolved_employment_number text;
  v_row_count integer;
  v_source_count integer := 0;
  v_readback_document jsonb;
  v_action_checkpoint jsonb;
  v_readback_hash text;
  v_completed_status text;
  v_completed_count integer;
  v_expected_count integer;
  v_event_result record;
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
  into v_expected_material
  from pg_catalog.jsonb_each(requested_expected_versions) e;
  if v_expected_material is null
    or pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_expected_material, 'UTF8'), 'sha256'), 'hex') <> requested_state_token then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ACTION_PROOF_INVALID';
  end if;

  select a.* into v_current_action
  from public.payroll_import_finalization_actions a
  where a.tenant_id = requested_tenant_id
    and a.hr_group_id = requested_hr_group_id
    and a.batch_id = requested_batch_id
    and a.action_id = requested_action_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_FINALIZATION_ACTION_NOT_FOUND';
  end if;

  select p.* into v_current_plan
  from public.payroll_import_finalization_plans p
  where p.tenant_id = v_current_action.tenant_id
    and p.hr_group_id = v_current_action.hr_group_id
    and p.batch_id = v_current_action.batch_id
    and p.administration_id = v_current_action.administration_id
    and p.id = v_current_action.plan_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND';
  end if;

  select b.* into v_current_batch
  from public.payroll_import_batches b
  where b.tenant_id = v_current_action.tenant_id
    and b.hr_group_id = v_current_action.hr_group_id
    and b.administration_id = v_current_action.administration_id
    and b.id = v_current_action.batch_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_current_action.status <> 'IN_PROGRESS'
    or v_current_plan.status <> 'IN_PROGRESS'
    or v_current_action.lease_owner is distinct from requested_lease_owner
    or v_current_action.lease_token_hash is distinct from requested_lease_token_hash
    or v_current_action.lease_until is null
    or v_current_action.lease_until <= pg_catalog.clock_timestamp() then
    raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_LEASE_FENCED';
  end if;
  if v_current_plan.status = 'INVALIDATED'
    or v_current_action.plan_hash <> v_current_plan.plan_hash
    or v_current_action.source_hash <> v_current_plan.source_hash
    or v_current_action.analysis_hash <> v_current_plan.analysis_hash
    or v_current_action.core_state_hash <> v_current_plan.core_state_hash
    or v_current_action.decision_hash !~ '^[0-9a-f]{64}$'
    or v_current_plan.contract_version is distinct from 'CONTROL02-CORE-PAYROLL-TEST-CANDIDATE-2'
    or v_current_action.contract_version is distinct from v_current_plan.contract_version
    or v_current_batch.source_type <> 'LOONAANGIFTE_XML'
    or v_current_batch.source_hash <> v_current_action.source_hash
    or v_current_batch.source_deleted_at is not null
    or v_current_batch.status not in ('STAGED', 'READY', 'FINALIZING') then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_PROVENANCE_STALE';
  end if;
  if v_current_action.schema_version <> '2.0' or v_current_plan.schema_version <> '2.0' then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SCHEMA_UNSUPPORTED';
  end if;

  if not exists (
    select 1 from public.payroll_import_xml_provenance provenance
    where provenance.tenant_id = v_current_batch.tenant_id
      and provenance.hr_group_id = v_current_batch.hr_group_id
      and provenance.administration_id = v_current_batch.administration_id
      and provenance.batch_id = v_current_batch.id
      and provenance.source_hash = v_current_batch.source_hash
      and provenance.schema_version = '2.0'
      and provenance.namespace_uri = 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01'
      and provenance.source_archive_sha256 = '134cf1464ccce87acff81c8c624c0ad31878a43e541babb46514926912b1836e'
      and provenance.xsd_sha256 = 'eb862bea8c7232154cfb30bb37c4ecf192b4a86540944358b065bb7fa54fc441'
      and provenance.release_page_url = 'https://odb.belastingdienst.nl/documentatie/loonheffingen-aangifte-2026v09/'
      and provenance.xsd_filename = 'Loonaangifte2026v2.0.xsd'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_PROVENANCE_UNVERIFIED';
  end if;

  select d.* into v_current_decision
  from public.payroll_import_decisions d
  where d.tenant_id = v_current_action.tenant_id
    and d.hr_group_id = v_current_action.hr_group_id
    and d.administration_id = v_current_action.administration_id
    and d.batch_id = v_current_action.batch_id
    and d.id = v_current_action.decision_id
    and d.import_person_id = v_current_action.import_person_id
  for share;
  if not found
    or v_current_decision.confirmer_user_id <> requested_actor_user_id
    or v_current_decision.decision_hash <> v_current_action.decision_hash
    or v_current_decision.source_hash <> v_current_action.source_hash
    or v_current_decision.analysis_hash <> v_current_action.analysis_hash
    or v_current_decision.core_state_hash <> v_current_action.core_state_hash
    or v_current_decision.contract_version <> v_current_action.contract_version
    or v_current_decision.schema_version <> v_current_action.schema_version
    or v_current_decision.decision_version <> (
      select pg_catalog.max(d.decision_version)
      from public.payroll_import_decisions d
      where d.tenant_id = v_current_action.tenant_id
        and d.hr_group_id = v_current_action.hr_group_id
        and d.batch_id = v_current_action.batch_id
        and d.import_person_id = v_current_action.import_person_id
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DECISION_STALE';
  end if;

  select p.* into v_current_person
  from public.payroll_import_persons p
  where p.tenant_id = v_current_action.tenant_id
    and p.hr_group_id = v_current_action.hr_group_id
    and p.batch_id = v_current_action.batch_id
    and p.id = v_current_action.import_person_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYROLL_IMPORT_PERSON_NOT_FOUND';
  end if;
  v_source_person_ref := 'row-' || v_current_person.source_row_number::text;
  if v_current_action.source_person_ref <> v_source_person_ref
    or v_current_action.source_refs is null
    or pg_catalog.jsonb_typeof(v_current_action.source_refs) <> 'array'
    or requested_expected_versions ->> ('person:' || v_current_person.id::text) is null
    or (requested_expected_versions ->> ('person:' || v_current_person.id::text))::timestamptz is distinct from v_current_person.updated_at then
    raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_SOURCE_VERSION_STALE';
  end if;

  for v_source_ref in
    select source_item.value from pg_catalog.jsonb_array_elements_text(v_current_action.source_refs) as source_item(value)
  loop
    if v_source_ref = v_source_person_ref then
      continue;
    end if;

    select numbered.id, numbered.payroll_tax_number, numbered.ikv_number,
      numbered.starts_on, numbered.ends_on, numbered.updated_at
    into v_source_income
    from (
      select i.id, i.payroll_tax_number, i.ikv_number, i.starts_on, i.ends_on, i.updated_at
      from public.payroll_import_income_relationships i
      where i.tenant_id = v_current_action.tenant_id
        and i.hr_group_id = v_current_action.hr_group_id
        and i.administration_id = v_current_action.administration_id
        and i.batch_id = v_current_action.batch_id
        and i.import_person_id = v_current_action.import_person_id
    ) numbered
    where v_source_ref = v_source_person_ref || ':income:' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text
      || ':' || coalesce(numbered.starts_on::text, '') || ':' || coalesce(numbered.ends_on::text, '');
    if not found
      or requested_expected_versions ->> ('source:' || v_source_ref) is null
      or (requested_expected_versions ->> ('source:' || v_source_ref))::timestamptz is distinct from v_source_income.updated_at then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_SOURCE_VERSION_STALE';
    end if;
    v_source_count := v_source_count + 1;
  end loop;
  if v_source_count = 0 and v_current_action.action_type in (
    'REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT', 'CREATE_INCOME_RELATIONSHIP',
    'LINK_INCOME_RELATIONSHIP', 'NO_CHANGE'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SOURCE_INCOME_REQUIRED';
  end if;

  if pg_catalog.cardinality(v_current_action.depends_on_action_ids) <> (
    select pg_catalog.count(*)::integer
    from public.payroll_import_finalization_actions dependency
    where dependency.tenant_id = v_current_action.tenant_id
      and dependency.hr_group_id = v_current_action.hr_group_id
      and dependency.batch_id = v_current_action.batch_id
      and dependency.plan_id = v_current_action.plan_id
      and dependency.import_person_id = v_current_action.import_person_id
      and dependency.action_id = any(v_current_action.depends_on_action_ids)
      and dependency.sequence_no < v_current_action.sequence_no
      and dependency.status = 'COMPLETED'
  ) then
    raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INCOMPLETE';
  end if;

  if v_current_action.target_employee_id is not null then
    v_resolved_target_employee_id := v_current_action.target_employee_id;
  elsif v_current_action.target_employee_ref is not null
    and v_current_action.action_type <> 'CREATE_EMPLOYEE' then
    select (prior.checkpoint ->> 'createdEmployeeId')::uuid into v_resolved_target_employee_id
    from public.payroll_import_finalization_actions prior
    where prior.tenant_id = v_current_action.tenant_id
      and prior.hr_group_id = v_current_action.hr_group_id
      and prior.batch_id = v_current_action.batch_id
      and prior.plan_id = v_current_action.plan_id
      and prior.import_person_id = v_current_action.import_person_id
      and prior.action_type = 'CREATE_EMPLOYEE'
      and prior.target_employee_ref = v_current_action.target_employee_ref
      and prior.status = 'COMPLETED'
      and prior.checkpoint ->> 'createdEmployeeId' ~ '^[0-9a-f-]{36}$';
  end if;

  if v_current_action.target_employment_id is not null then
    v_target_employment_id := v_current_action.target_employment_id;
  elsif v_current_action.target_employment_ref is not null
    and v_current_action.action_type <> 'CREATE_DRAFT_EMPLOYMENT' then
    select (prior.checkpoint ->> 'createdEmploymentId')::uuid into v_target_employment_id
    from public.payroll_import_finalization_actions prior
    where prior.tenant_id = v_current_action.tenant_id
      and prior.hr_group_id = v_current_action.hr_group_id
      and prior.batch_id = v_current_action.batch_id
      and prior.plan_id = v_current_action.plan_id
      and prior.import_person_id = v_current_action.import_person_id
      and prior.action_type = 'CREATE_DRAFT_EMPLOYMENT'
      and prior.target_employment_ref = v_current_action.target_employment_ref
      and prior.status = 'COMPLETED'
      and prior.checkpoint ->> 'createdEmploymentId' ~ '^[0-9a-f-]{36}$';
  end if;

  if v_current_action.action_type <> 'CREATE_EMPLOYEE' then
    if v_current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or coalesce(v_current_decision.decision_payload #>> '{match,action}', '') not in ('REUSE_EMPLOYEE', 'CREATE_EMPLOYEE')
      or v_resolved_target_employee_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_DECISION_STALE';
    end if;
    if (v_current_decision.decision_payload #>> '{match,action}') = 'REUSE_EMPLOYEE'
      and v_current_decision.decision_payload #>> '{match,employeeId}' is distinct from v_resolved_target_employee_id::text
      or (v_current_decision.decision_payload #>> '{match,action}') = 'CREATE_EMPLOYEE'
      and (v_current_action.target_employee_ref is distinct from ('new-employee:' || v_current_batch.id::text || ':' || v_source_person_ref)
        or not exists (
          select 1 from public.payroll_import_finalization_actions created
          where created.tenant_id = v_current_action.tenant_id
            and created.hr_group_id = v_current_action.hr_group_id
            and created.batch_id = v_current_action.batch_id
            and created.plan_id = v_current_action.plan_id
            and created.import_person_id = v_current_action.import_person_id
            and created.action_type = 'CREATE_EMPLOYEE'
            and created.target_employee_ref = v_current_action.target_employee_ref
            and created.status = 'COMPLETED'
            and created.checkpoint ->> 'createdEmployeeId' = v_resolved_target_employee_id::text
        )) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
  end if;

  if v_current_action.action_type not in (
    'REUSE_EMPLOYEE', 'CREATE_EMPLOYEE', 'ADD_ADMINISTRATION_ASSIGNMENT',
    'UPDATE_EMPLOYEE_FIELDS', 'REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT',
    'CREATE_INCOME_RELATIONSHIP', 'LINK_INCOME_RELATIONSHIP', 'NO_CHANGE'
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ACTION_UNSUPPORTED';
  end if;

  if v_current_action.action_type = 'CREATE_EMPLOYEE' then
    if v_current_decision.decision_payload #>> '{match,action}' is distinct from 'CREATE_EMPLOYEE'
      or v_current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or nullif(pg_catalog.btrim(v_current_decision.decision_payload #>> '{match,newEmployeeFields,firstName}'), '') is null
      or nullif(pg_catalog.btrim(v_current_decision.decision_payload #>> '{match,newEmployeeFields,birthName}'), '') is null
      or coalesce(v_current_decision.decision_payload #>> '{match,newEmployeeFields,gender}', '') not in ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')
      or v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' is distinct from 'USE_SOURCE'
        and v_current_person.birth_date is not null
        and v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' is distinct from 'KEEP_CURRENT'
      or v_current_action.target_employee_id is not null
      or v_current_action.target_employee_ref is distinct from ('new-employee:' || v_current_batch.id::text || ':' || v_source_person_ref)
      or v_current_person.status = 'BLOCKING'
      or v_current_person.match_status = 'EXACT' then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_CREATE_NOT_CONFIRMED';
    end if;
    if exists (
      select 1 from public.employees e
      where e.tenant_id = v_current_batch.tenant_id
        and e.hr_group_id = v_current_batch.hr_group_id
        and e.deleted_at is null
        and v_current_person.bsn_fingerprint is not null
        and exists (select 1 from public.employee_secure_identifiers secure
          where secure.tenant_id = e.tenant_id
            and secure.employee_id = e.id
            and secure.bsn_fingerprint = v_current_person.bsn_fingerprint)
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_IDENTITY_CONFLICT';
    end if;

    select pg_catalog.min(i.starts_on) into v_assignment_start
    from public.payroll_import_income_relationships i
    where i.tenant_id = v_current_action.tenant_id
      and i.hr_group_id = v_current_action.hr_group_id
      and i.batch_id = v_current_action.batch_id
      and i.import_person_id = v_current_action.import_person_id;
    if v_assignment_start is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SOURCE_PERIOD_REQUIRED';
    end if;

    insert into public.employees as inserted_employee (
      tenant_id, hr_group_id, employee_number, initials, first_name,
      birth_name_prefix, birth_name, name_usage, gender, birth_date,
      nationality
    ) values (
      v_current_batch.tenant_id,
      v_current_batch.hr_group_id,
      public.reserve_employee_number(v_current_batch.tenant_id),
      null,
      pg_catalog.btrim(v_current_decision.decision_payload #>> '{match,newEmployeeFields,firstName}'),
      null,
      pg_catalog.btrim(v_current_decision.decision_payload #>> '{match,newEmployeeFields,birthName}'),
      'BIRTH_NAME'::public.name_usage,
      (v_current_decision.decision_payload #>> '{match,newEmployeeFields,gender}')::public.gender,
      case when v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' = 'USE_SOURCE'
        then v_current_person.birth_date else null end,
      null
    ) returning id into v_resolved_target_employee_id;

    if v_current_person.bsn_fingerprint is not null then
      select p.* into v_protected_identifier
      from public.payroll_import_protected_identifiers p
      where p.tenant_id = v_current_action.tenant_id
        and p.hr_group_id = v_current_action.hr_group_id
        and p.batch_id = v_current_action.batch_id
        and p.import_person_id = v_current_action.import_person_id
        and p.bsn_fingerprint = v_current_person.bsn_fingerprint
      for update;
      if not found then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_PROTECTED_IDENTIFIER_MISSING';
      end if;
      insert into public.employee_secure_identifiers (
        employee_id, tenant_id, bsn_ciphertext, bsn_fingerprint
      ) values (
        v_resolved_target_employee_id, v_current_batch.tenant_id,
        v_protected_identifier.bsn_ciphertext, v_protected_identifier.bsn_fingerprint
      );
      delete from public.payroll_import_protected_identifiers p
      where p.tenant_id = v_current_action.tenant_id
        and p.hr_group_id = v_current_action.hr_group_id
        and p.batch_id = v_current_action.batch_id
        and p.import_person_id = v_current_action.import_person_id;
    end if;

    insert into public.employee_administration_assignments (
      tenant_id, hr_group_id, administration_id, employee_id, effective_from
    ) values (
      v_current_batch.tenant_id, v_current_batch.hr_group_id,
      v_current_batch.administration_id, v_resolved_target_employee_id, v_assignment_start
    ) on conflict do nothing;

  elsif v_current_action.action_type = 'REUSE_EMPLOYEE' then
    if v_current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or v_current_decision.decision_payload #>> '{match,employeeId}' is distinct from v_resolved_target_employee_id::text
      or v_current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or v_resolved_target_employee_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
    if v_current_person.bsn_fingerprint is not null and not exists (
      select 1 from public.employee_secure_identifiers secure
      where secure.tenant_id = v_current_batch.tenant_id
        and secure.employee_id = v_resolved_target_employee_id
        and secure.bsn_fingerprint = v_current_person.bsn_fingerprint
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_IDENTITY_CONFLICT';
    end if;
  end if;

  if v_resolved_target_employee_id is not null then
    perform 1 from public.employees e
    where e.tenant_id = v_current_batch.tenant_id
      and e.hr_group_id = v_current_batch.hr_group_id
      and e.id = v_resolved_target_employee_id
      and e.deleted_at is null
    for update;
    if not found then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SCOPE_MISMATCH';
    end if;
    if v_current_action.action_type <> 'CREATE_EMPLOYEE' then
      if requested_expected_versions ->> ('employee:' || v_resolved_target_employee_id::text) is null
        or (requested_expected_versions ->> ('employee:' || v_resolved_target_employee_id::text))::timestamptz is distinct from (
          select e.updated_at from public.employees e where e.id = v_resolved_target_employee_id
        ) then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_CORE_VERSION_STALE';
      end if;
    end if;
  end if;

  if v_current_action.action_type = 'CREATE_EMPLOYEE' and not exists (
    select 1 from public.employees e
    where e.id = v_resolved_target_employee_id
      and e.tenant_id = v_current_batch.tenant_id
      and e.hr_group_id = v_current_batch.hr_group_id
      and e.first_name = pg_catalog.btrim(v_current_decision.decision_payload #>> '{match,newEmployeeFields,firstName}')
      and e.birth_name = pg_catalog.btrim(v_current_decision.decision_payload #>> '{match,newEmployeeFields,birthName}')
      and e.gender = (v_current_decision.decision_payload #>> '{match,newEmployeeFields,gender}')::public.gender
      and e.birth_date is not distinct from case
        when v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthDate}' = 'USE_SOURCE' then v_current_person.birth_date
        else null end
      and e.nationality is null
      and e.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_READBACK_FAILED';
  end if;

  if v_current_action.action_type in ('CREATE_EMPLOYEE', 'ADD_ADMINISTRATION_ASSIGNMENT') and not exists (
    select 1 from public.employee_administration_assignments assignment
    where assignment.tenant_id = v_current_batch.tenant_id
      and assignment.hr_group_id = v_current_batch.hr_group_id
      and assignment.administration_id = v_current_batch.administration_id
      and assignment.employee_id = v_resolved_target_employee_id
      and assignment.effective_from = (
        select pg_catalog.min(i.starts_on)
        from public.payroll_import_income_relationships i
        where i.tenant_id = v_current_action.tenant_id
          and i.hr_group_id = v_current_action.hr_group_id
          and i.batch_id = v_current_action.batch_id
          and i.import_person_id = v_current_action.import_person_id
      )
      and assignment.effective_to is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ASSIGNMENT_READBACK_FAILED';
  end if;

  if v_current_action.action_type = 'UPDATE_EMPLOYEE_FIELDS' and not exists (
    select 1 from public.employees e
    where e.id = v_resolved_target_employee_id
      and e.tenant_id = v_current_batch.tenant_id
      and e.hr_group_id = v_current_batch.hr_group_id
      and e.first_name = case
        when v_current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}' = 'USE_SOURCE' then v_current_person.first_name
        else e.first_name end
      and e.birth_name = case
        when v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}' = 'USE_SOURCE' then v_current_person.birth_name
        else e.birth_name end
      and e.deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_READBACK_FAILED';
  end if;

  if v_target_employment_id is not null and v_current_action.action_type <> 'CREATE_DRAFT_EMPLOYMENT' then
    if requested_expected_versions ->> ('employment:' || v_target_employment_id::text) is null
      or not exists (
        select 1 from public.employments e
        where e.id = v_target_employment_id
          and e.tenant_id = v_current_batch.tenant_id
          and e.hr_group_id = v_current_batch.hr_group_id
          and e.administration_id = v_current_batch.administration_id
          and e.employee_id = v_resolved_target_employee_id
          and e.deleted_at is null
          and (requested_expected_versions ->> ('employment:' || e.id::text))::timestamptz = e.updated_at
      ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_VERSION_STALE';
    end if;
  end if;

  if v_current_action.action_type = 'ADD_ADMINISTRATION_ASSIGNMENT' then
    if v_resolved_target_employee_id is null
      or v_current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or v_current_decision.decision_payload #>> '{match,employeeId}' is distinct from v_resolved_target_employee_id::text
      or v_current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or not exists (select 1 from public.administrations a
        where a.tenant_id = v_current_batch.tenant_id
          and a.hr_group_id = v_current_batch.hr_group_id
          and a.id = v_current_batch.administration_id) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_ASSIGNMENT_SCOPE_MISMATCH';
    end if;
    select pg_catalog.min(i.starts_on) into v_assignment_start
    from public.payroll_import_income_relationships i
    where i.tenant_id = v_current_action.tenant_id
      and i.hr_group_id = v_current_action.hr_group_id
      and i.batch_id = v_current_action.batch_id
      and i.import_person_id = v_current_action.import_person_id;
    if v_assignment_start is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_SOURCE_PERIOD_REQUIRED';
    end if;
    insert into public.employee_administration_assignments (
      tenant_id, hr_group_id, administration_id, employee_id, effective_from
    ) values (
      v_current_batch.tenant_id, v_current_batch.hr_group_id,
      v_current_batch.administration_id, v_resolved_target_employee_id, v_assignment_start
    ) on conflict do nothing;
  elsif v_current_action.action_type = 'UPDATE_EMPLOYEE_FIELDS' then
    if v_resolved_target_employee_id is null
      or v_current_decision.decision_payload #>> '{match,action}' is distinct from 'REUSE_EMPLOYEE'
      or v_current_decision.decision_payload #>> '{match,employeeId}' is distinct from v_resolved_target_employee_id::text
      or v_current_decision.decision_payload #>> '{match,confirmed}' is distinct from 'true'
      or coalesce(v_current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}', '') not in ('USE_SOURCE','KEEP_CURRENT','MANUAL_REVIEW')
      or coalesce(v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}', '') not in ('USE_SOURCE','KEEP_CURRENT','MANUAL_REVIEW') then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_FIELD_DECISION_INVALID';
    end if;
    if v_current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}' = 'USE_SOURCE'
      and v_current_person.first_name is null
      or v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}' = 'USE_SOURCE'
      and v_current_person.birth_name is null
      or exists (
        select 1 from pg_catalog.jsonb_each_text(v_current_decision.decision_payload -> 'sourceFieldDecisions') field
        where field.value = 'USE_SOURCE' and field.key not in ('firstName', 'birthName')
      ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_FIELD_DECISION_INVALID';
    end if;
    update public.employees e
    set first_name = case when v_current_decision.decision_payload #>> '{sourceFieldDecisions,firstName}' = 'USE_SOURCE'
          and v_current_person.first_name is not null then v_current_person.first_name else e.first_name end,
        birth_name = case when v_current_decision.decision_payload #>> '{sourceFieldDecisions,birthName}' = 'USE_SOURCE'
          and v_current_person.birth_name is not null then v_current_person.birth_name else e.birth_name end
    where e.id = v_resolved_target_employee_id
      and e.tenant_id = v_current_batch.tenant_id
      and e.hr_group_id = v_current_batch.hr_group_id;
  elsif v_current_action.action_type = 'REUSE_EMPLOYMENT' then
    if v_resolved_target_employee_id is null or v_target_employment_id is null
      or not exists (
        select 1
        from public.employments e
        join public.employee_administration_assignments assignment
          on assignment.tenant_id = e.tenant_id
          and assignment.hr_group_id = e.hr_group_id
          and assignment.administration_id = e.administration_id
          and assignment.employee_id = e.employee_id
          and assignment.effective_to is null
        where e.tenant_id = v_current_batch.tenant_id
          and e.hr_group_id = v_current_batch.hr_group_id
          and e.administration_id = v_current_batch.administration_id
          and e.employee_id = v_resolved_target_employee_id
          and e.id = v_target_employment_id
          and e.record_status = 'CONFIRMED'
          and e.deleted_at is null
      ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_MISMATCH';
    end if;
    for v_source_ref in
      select source_item.value from pg_catalog.jsonb_array_elements_text(v_current_action.source_refs) as source_item(value)
    loop
      if v_source_ref = v_source_person_ref
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'action'] is distinct from 'REUSE_EMPLOYMENT'
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'confirmed'] is distinct from 'true'
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'employmentId'] is distinct from v_target_employment_id::text then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_DECISION_STALE';
      end if;
      if exists (
        select 1 from (
          select i.*
          from public.payroll_import_income_relationships i
          where i.tenant_id = v_current_action.tenant_id
            and i.hr_group_id = v_current_action.hr_group_id
            and i.batch_id = v_current_action.batch_id
            and i.import_person_id = v_current_action.import_person_id
        ) i
        join public.employments employment on employment.id = v_target_employment_id
        where v_source_ref = v_source_person_ref || ':income:' || i.payroll_tax_number || ':' || i.ikv_number::text
            || ':' || coalesce(i.starts_on::text, '') || ':' || coalesce(i.ends_on::text, '')
          and (employment.starts_on > i.starts_on
            or employment.ends_on is not null and (i.ends_on is null or employment.ends_on < i.ends_on))
      ) then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_PERIOD_STALE';
      end if;
    end loop;
  elsif v_current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' then
    if v_resolved_target_employee_id is null
      or v_current_action.draft_employment_contract_type is null
      or v_current_action.draft_employment_starts_on is null
      or v_current_action.draft_employment_seniority_date is null
      or v_current_action.draft_employment_original_hire_date is null
      or v_current_action.target_employment_ref is distinct from ('draft-employment:' || v_current_batch.id::text || ':' || v_source_person_ref)
      or coalesce(v_current_decision.decision_payload #>> '{match,action}', '') not in ('REUSE_EMPLOYEE','CREATE_EMPLOYEE') then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_TERMS_INVALID';
    end if;
    if (v_current_decision.decision_payload #>> '{match,action}') = 'REUSE_EMPLOYEE'
      and v_current_decision.decision_payload #>> '{match,employeeId}' is distinct from v_resolved_target_employee_id::text
      or (v_current_decision.decision_payload #>> '{match,action}') = 'CREATE_EMPLOYEE'
      and (v_current_action.target_employee_ref is distinct from ('new-employee:' || v_current_batch.id::text || ':' || v_source_person_ref)
        or not exists (
          select 1 from public.payroll_import_finalization_actions created
          where created.tenant_id = v_current_action.tenant_id
            and created.hr_group_id = v_current_action.hr_group_id
            and created.batch_id = v_current_action.batch_id
            and created.plan_id = v_current_action.plan_id
            and created.import_person_id = v_current_action.import_person_id
            and created.action_type = 'CREATE_EMPLOYEE'
            and created.target_employee_ref = v_current_action.target_employee_ref
            and created.status = 'COMPLETED'
            and created.checkpoint ->> 'createdEmployeeId' = v_resolved_target_employee_id::text
        )) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYEE_SELECTION_STALE';
    end if;
    for v_source_ref in
      select source_item.value from pg_catalog.jsonb_array_elements_text(v_current_action.source_refs) as source_item(value)
    loop
      if v_source_ref = v_source_person_ref
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'action'] is distinct from 'CREATE_DRAFT_EMPLOYMENT'
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'confirmed'] is distinct from 'true'
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'contractType'] is distinct from v_current_action.draft_employment_contract_type
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'startsOn'] is distinct from v_current_action.draft_employment_starts_on::text
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'seniorityDate'] is distinct from v_current_action.draft_employment_seniority_date::text
        or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_source_ref, 'originalHireDate'] is distinct from v_current_action.draft_employment_original_hire_date::text then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_DECISION_STALE';
      end if;
    end loop;
    if exists (
      select 1 from public.payroll_import_income_relationships i
      where i.tenant_id = v_current_action.tenant_id
        and i.hr_group_id = v_current_action.hr_group_id
        and i.batch_id = v_current_action.batch_id
        and i.import_person_id = v_current_action.import_person_id
        and i.starts_on < v_current_action.draft_employment_starts_on
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_DRAFT_PERIOD_MISMATCH';
    end if;
    if exists (
      select 1 from public.employments e
      where e.tenant_id = v_current_action.tenant_id
        and e.hr_group_id = v_current_action.hr_group_id
        and e.payroll_import_person_id = v_current_action.import_person_id
    ) then
      raise exception using errcode = '23505', message = 'PAYROLL_FINALIZATION_IDEMPOTENCY_CONFLICT';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      v_current_batch.tenant_id::text || ':' || v_resolved_target_employee_id::text, 0
    ));
    select (coalesce(pg_catalog.max(nullif(e.employment_number, '')::numeric), 0) + 1)::text
    into v_resolved_employment_number
    from public.employments e
    where e.tenant_id = v_current_batch.tenant_id
      and e.hr_group_id = v_current_batch.hr_group_id
      and e.employee_id = v_resolved_target_employee_id
      and e.employment_number ~ '^[0-9]+$';
    insert into public.employments as inserted_employment (
      tenant_id, hr_group_id, administration_id, employee_id,
      employment_number, employment_type, contract_type, record_status,
      starts_on, seniority_date, original_hire_date, is_primary,
      payroll_import_person_id
    ) values (
      v_current_batch.tenant_id, v_current_batch.hr_group_id,
      v_current_batch.administration_id, v_resolved_target_employee_id,
      v_resolved_employment_number, 'EMPLOYEE'::public.employment_type,
      v_current_action.draft_employment_contract_type::public.contract_type,
      'DRAFT'::public.employment_record_status,
      v_current_action.draft_employment_starts_on,
      v_current_action.draft_employment_seniority_date,
      v_current_action.draft_employment_original_hire_date,
      false, v_current_person.id
    ) returning inserted_employment.id into v_target_employment_id;
  end if;

  if v_current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE') then
    if v_resolved_target_employee_id is null or v_current_action.source_income_ref is null
      or v_current_action.source_refs <> pg_catalog.jsonb_build_array(v_current_action.source_income_ref)
      or v_current_action.source_payroll_tax_number is null
      or v_current_action.source_ikv_number is null
      or v_current_action.source_starts_on is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_INVALID';
    end if;
    select numbered.* into v_source_income
    from (
      select i.*
      from public.payroll_import_income_relationships i
      where i.tenant_id = v_current_action.tenant_id
        and i.hr_group_id = v_current_action.hr_group_id
        and i.administration_id = v_current_action.administration_id
        and i.batch_id = v_current_action.batch_id
        and i.import_person_id = v_current_action.import_person_id
    ) numbered
    where v_current_action.source_income_ref = v_source_person_ref || ':income:' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text
      || ':' || coalesce(numbered.starts_on::text, '') || ':' || coalesce(numbered.ends_on::text, '');
    if not found
      or v_source_income.payroll_tax_number <> v_current_action.source_payroll_tax_number
      or v_source_income.ikv_number <> v_current_action.source_ikv_number
      or v_source_income.starts_on <> v_current_action.source_starts_on
      or v_source_income.ends_on is distinct from v_current_action.source_ends_on
      or v_source_income.starts_on is null
      or v_source_income.ends_on is not null and v_source_income.ends_on < v_source_income.starts_on then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_SOURCE_MISMATCH';
    end if;
    v_income_start := v_source_income.starts_on;
    v_income_end := v_source_income.ends_on;

    if v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'confirmed'] is distinct from 'true'
      or coalesce(v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'action'], '') not in ('REUSE_EMPLOYMENT', 'CREATE_DRAFT_EMPLOYMENT')
      or (v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'action']) = 'REUSE_EMPLOYMENT'
        and v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'employmentId'] is distinct from v_target_employment_id::text
      or (v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'action']) = 'CREATE_DRAFT_EMPLOYMENT'
        and not exists (
          select 1 from public.payroll_import_finalization_actions created
          where created.tenant_id = v_current_action.tenant_id
            and created.hr_group_id = v_current_action.hr_group_id
            and created.batch_id = v_current_action.batch_id
            and created.plan_id = v_current_action.plan_id
            and created.import_person_id = v_current_action.import_person_id
            and created.action_type = 'CREATE_DRAFT_EMPLOYMENT'
            and created.target_employment_ref = v_current_action.target_employment_ref
            and created.status = 'COMPLETED'
            and created.checkpoint ->> 'createdEmploymentId' = v_target_employment_id::text
            and v_current_action.source_income_ref = any(array(select pg_catalog.jsonb_array_elements_text(created.source_refs)))
        )
      or v_target_employment_id is null then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_DECISION_STALE';
    end if;

    if not exists (
      select 1 from public.employments employment
      where employment.id = v_target_employment_id
        and employment.tenant_id = v_current_batch.tenant_id
        and employment.hr_group_id = v_current_batch.hr_group_id
        and employment.administration_id = v_current_batch.administration_id
        and employment.employee_id = v_resolved_target_employee_id
        and employment.record_status in ('CONFIRMED', 'DRAFT')
        and employment.deleted_at is null
        and employment.starts_on <= v_income_start
        and (employment.ends_on is null or v_income_end is not null and employment.ends_on >= v_income_end)
    ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_PERIOD_STALE';
    end if;
    if v_current_action.action_type in ('CREATE_INCOME_RELATIONSHIP', 'LINK_INCOME_RELATIONSHIP')
      and exists (
        select 1 from public.employment_income_relationships link
        where link.tenant_id = v_current_batch.tenant_id
          and link.administration_id = v_current_batch.administration_id
          and link.employee_id = v_resolved_target_employee_id
          and link.employment_id = v_target_employment_id
          and pg_catalog.daterange(link.valid_from, link.valid_until, '[)')
            && pg_catalog.daterange(v_income_start, case when v_income_end is null then null else v_income_end + 1 end, '[)')
          and (v_current_action.action_type = 'CREATE_INCOME_RELATIONSHIP'
            or link.income_relationship_id is distinct from v_current_action.target_income_relationship_id
            or link.valid_from is distinct from v_income_start
            or link.valid_until is distinct from case when v_income_end is null then null else v_income_end + 1 end)
      ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_IKV_PERIOD_CONFLICT';
    end if;

    if v_current_action.action_type = 'CREATE_INCOME_RELATIONSHIP' then
      if v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'action'] is distinct from 'CREATE'
        or v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'confirmed'] is distinct from 'true'
        or v_current_person.status = 'BLOCKING'
        or not exists (
          select 1 from public.administration_payroll_tax_numbers binding
          where binding.tenant_id = v_current_batch.tenant_id
            and binding.hr_group_id = v_current_batch.hr_group_id
            and binding.administration_id = v_current_batch.administration_id
            and binding.payroll_tax_number = v_current_action.source_payroll_tax_number
            and binding.valid_from <= v_income_start
            and (binding.valid_until is null or v_income_end is not null and binding.valid_until >= v_income_end)
            and requested_expected_versions ->> ('binding:' || binding.id::text) is not null
            and (requested_expected_versions ->> ('binding:' || binding.id::text))::timestamptz = binding.updated_at
        ) then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_TAX_BINDING_SCOPE_OR_PERIOD_INVALID';
      end if;
      select binding.* into v_tax_binding
      from public.administration_payroll_tax_numbers binding
      where binding.tenant_id = v_current_batch.tenant_id
        and binding.hr_group_id = v_current_batch.hr_group_id
        and binding.administration_id = v_current_batch.administration_id
        and binding.payroll_tax_number = v_current_action.source_payroll_tax_number
        and binding.valid_from <= v_income_start
        and (binding.valid_until is null or v_income_end is not null and binding.valid_until >= v_income_end)
        and requested_expected_versions ->> ('binding:' || binding.id::text) is not null
        and (requested_expected_versions ->> ('binding:' || binding.id::text))::timestamptz = binding.updated_at
      order by binding.valid_from desc, binding.id
      limit 1
      for share;

      if exists (
        select 1 from public.income_relationships existing
        where existing.tenant_id = v_current_batch.tenant_id
          and existing.administration_id = v_current_batch.administration_id
          and existing.payroll_tax_number = v_current_action.source_payroll_tax_number
          and existing.ikv_number = v_current_action.source_ikv_number
          and existing.deleted_at is null
      ) then
        raise exception using errcode = '23505', message = 'PAYROLL_FINALIZATION_DUPLICATE_IKV_IDENTITY';
      end if;
      insert into public.income_relationships as inserted_income (
        tenant_id, administration_id, employee_id, payroll_tax_subnumber,
        ikv_number, relationship_type, starts_on, ends_on, reporting_status,
        payroll_tax_number, payroll_tax_binding_hr_group_id, payroll_tax_binding_id
      ) values (
        v_current_batch.tenant_id, v_current_batch.administration_id,
        v_resolved_target_employee_id, pg_catalog.right(v_current_action.source_payroll_tax_number, 2),
        v_current_action.source_ikv_number, 'EMPLOYMENT'::public.income_relationship_type,
        v_income_start, v_income_end, 'DRAFT'::public.payroll_reporting_status,
        v_current_action.source_payroll_tax_number, v_current_batch.hr_group_id, v_tax_binding.id
      ) returning inserted_income.id into v_target_income_relationship_id;
      if v_target_employment_id is null then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_TARGET_REQUIRED';
      end if;
      insert into public.employment_income_relationships (
        tenant_id, administration_id, employee_id, employment_id,
        income_relationship_id, valid_from, valid_until
      ) values (
        v_current_batch.tenant_id, v_current_batch.administration_id,
        v_resolved_target_employee_id, v_target_employment_id,
        v_target_income_relationship_id, v_income_start,
        case when v_income_end is null then null else v_income_end + 1 end
      );
    else
      v_target_income_relationship_id := v_current_action.target_income_relationship_id;
      if v_target_income_relationship_id is null then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_OR_VERSION_STALE';
      end if;
      select existing.* into v_target_income_row
      from public.income_relationships existing
      where existing.id = v_target_income_relationship_id
        and existing.tenant_id = v_current_batch.tenant_id
        and existing.administration_id = v_current_batch.administration_id
        and existing.employee_id = v_resolved_target_employee_id
        and existing.payroll_tax_number = v_current_action.source_payroll_tax_number
        and existing.ikv_number = v_current_action.source_ikv_number
        and existing.starts_on = v_income_start
        and existing.ends_on is not distinct from v_income_end
        and existing.deleted_at is null
      for update;
      if not found
        or requested_expected_versions ->> ('income:' || v_target_income_relationship_id::text) is null
        or (requested_expected_versions ->> ('income:' || v_target_income_relationship_id::text))::timestamptz is distinct from v_target_income_row.updated_at then
        raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_INCOME_IDENTITY_OR_VERSION_STALE';
      end if;
      if v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'incomeRelationshipId']
        is distinct from v_target_income_relationship_id::text
        and v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'action'] is distinct from 'NO_CHANGE' then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_SELECTION_STALE';
      end if;
      if v_current_action.action_type = 'NO_CHANGE'
        and v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'action'] is distinct from 'NO_CHANGE' then
        raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
      end if;
      if v_current_action.action_type = 'LINK_INCOME_RELATIONSHIP' then
        if v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'action'] is distinct from 'LINK'
          or v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'confirmed'] is distinct from 'true' then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
        end if;
        if v_target_employment_id is null then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_TARGET_REQUIRED';
        end if;
        if not exists (
          select 1 from public.employments e
          where e.id = v_target_employment_id
            and e.tenant_id = v_current_batch.tenant_id
            and e.hr_group_id = v_current_batch.hr_group_id
            and e.administration_id = v_current_batch.administration_id
            and e.employee_id = v_resolved_target_employee_id
            and e.record_status in ('CONFIRMED','DRAFT')
            and e.deleted_at is null
            and requested_expected_versions ->> ('employment:' || e.id::text) is not null
            and (requested_expected_versions ->> ('employment:' || e.id::text))::timestamptz = e.updated_at
            and e.starts_on <= v_income_start
            and (e.ends_on is null or v_income_end is not null and e.ends_on >= v_income_end)
        ) then
          raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_SCOPE_OR_PERIOD_STALE';
        end if;
        if not exists (
          select 1 from public.employment_income_relationships link
          where link.tenant_id = v_current_batch.tenant_id
            and link.administration_id = v_current_batch.administration_id
            and link.employee_id = v_resolved_target_employee_id
            and link.employment_id = v_target_employment_id
            and link.income_relationship_id = v_target_income_relationship_id
            and link.valid_from = v_income_start
            and link.valid_until is not distinct from case when v_income_end is null then null else v_income_end + 1 end
        ) then
          insert into public.employment_income_relationships (
            tenant_id, administration_id, employee_id, employment_id,
            income_relationship_id, valid_from, valid_until
          ) values (
            v_current_batch.tenant_id, v_current_batch.administration_id,
            v_resolved_target_employee_id, v_target_employment_id,
            v_target_income_relationship_id, v_income_start,
            case when v_income_end is null then null else v_income_end + 1 end
          );
        end if;
      elsif v_current_action.action_type = 'NO_CHANGE' then
        if v_current_decision.decision_payload #>> array['incomeRelationshipBySourceRef', v_current_action.source_income_ref, 'confirmed'] is distinct from 'true'
          or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'action'] is distinct from 'REUSE_EMPLOYMENT'
          or v_current_decision.decision_payload #>> array['employmentByIncomeRelationship', v_current_action.source_income_ref, 'employmentId'] is distinct from v_target_employment_id::text
          or v_target_employment_id is null then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_DECISION_STALE';
        end if;
        if v_target_employment_id is not null and not exists (
          select 1 from public.employment_income_relationships link
          where link.tenant_id = v_current_batch.tenant_id
            and link.administration_id = v_current_batch.administration_id
            and link.employee_id = v_resolved_target_employee_id
            and link.employment_id = v_target_employment_id
            and link.income_relationship_id = v_target_income_relationship_id
            and link.valid_from = v_income_start
            and link.valid_until is not distinct from case when v_income_end is null then null else v_income_end + 1 end
        ) then
          raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EXISTING_LINK_READBACK_FAILED';
        end if;
      end if;
    end if;

  end if;

  if v_current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' and (
    v_target_employment_id is null or not exists (
    select 1 from public.employments e
    where e.id = v_target_employment_id
      and e.tenant_id = v_current_batch.tenant_id
      and e.hr_group_id = v_current_batch.hr_group_id
      and e.administration_id = v_current_batch.administration_id
      and e.employee_id = v_resolved_target_employee_id
      and e.payroll_import_person_id = v_current_person.id
      and e.employment_number = v_resolved_employment_number
      and e.contract_type = v_current_action.draft_employment_contract_type::public.contract_type
      and e.record_status = 'DRAFT'::public.employment_record_status
      and e.starts_on = v_current_action.draft_employment_starts_on
      and e.seniority_date = v_current_action.draft_employment_seniority_date
      and e.original_hire_date = v_current_action.draft_employment_original_hire_date
      and e.is_primary = false
      and e.deleted_at is null
  )) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_READBACK_FAILED';
  end if;

  if v_current_action.action_type in ('REUSE_EMPLOYMENT','CREATE_DRAFT_EMPLOYMENT','LINK_INCOME_RELATIONSHIP','CREATE_INCOME_RELATIONSHIP') then
    if v_target_employment_id is null or not exists (
      select 1 from public.employments e
      where e.id = v_target_employment_id
        and e.tenant_id = v_current_batch.tenant_id
        and e.hr_group_id = v_current_batch.hr_group_id
        and e.administration_id = v_current_batch.administration_id
        and e.employee_id = v_resolved_target_employee_id
        and e.deleted_at is null
    ) then
      raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_EMPLOYMENT_READBACK_FAILED';
    end if;
  end if;

  if v_current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE')
    and not exists (
      select 1 from public.income_relationships i
      where i.id = v_target_income_relationship_id
        and i.tenant_id = v_current_batch.tenant_id
        and i.administration_id = v_current_batch.administration_id
        and i.employee_id = v_resolved_target_employee_id
        and i.payroll_tax_number = v_current_action.source_payroll_tax_number
        and i.ikv_number = v_current_action.source_ikv_number
        and i.starts_on = v_current_action.source_starts_on
        and i.ends_on is not distinct from v_current_action.source_ends_on
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_READBACK_FAILED';
  end if;

  if v_current_action.action_type in ('CREATE_INCOME_RELATIONSHIP','LINK_INCOME_RELATIONSHIP','NO_CHANGE')
    and not exists (
      select 1 from public.employment_income_relationships link
      where link.tenant_id = v_current_batch.tenant_id
        and link.administration_id = v_current_batch.administration_id
        and link.employee_id = v_resolved_target_employee_id
        and link.employment_id = v_target_employment_id
        and link.income_relationship_id = v_target_income_relationship_id
        and link.valid_from = v_current_action.source_starts_on
        and link.valid_until is not distinct from case
          when v_current_action.source_ends_on is null then null
          else v_current_action.source_ends_on + 1 end
    ) then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_INCOME_LINK_READBACK_FAILED';
  end if;

  v_readback_document := pg_catalog.jsonb_build_object(
    'actionId', v_current_action.action_id,
    'actionType', v_current_action.action_type,
    'tenantId', v_current_action.tenant_id,
    'hrGroupId', v_current_action.hr_group_id,
    'administrationId', v_current_action.administration_id,
    'batchId', v_current_action.batch_id,
    'employeeId', v_resolved_target_employee_id,
    'employmentId', v_target_employment_id,
    'incomeRelationshipId', v_target_income_relationship_id,
    'sourceHash', v_current_action.source_hash,
    'decisionHash', v_current_action.decision_hash,
    'attempt', v_current_action.attempt_count
  );
  v_readback_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(v_readback_document::text, 'UTF8'), 'sha256'
  ), 'hex');
  v_action_checkpoint := coalesce(v_current_action.checkpoint, '{}'::jsonb)
    || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'targetEmployeeRef', v_current_action.target_employee_ref,
      'targetEmploymentRef', v_current_action.target_employment_ref,
      'createdEmployeeId', case when v_current_action.action_type = 'CREATE_EMPLOYEE' then v_resolved_target_employee_id::text end,
      'createdEmploymentId', case when v_current_action.action_type = 'CREATE_DRAFT_EMPLOYMENT' then v_target_employment_id::text end,
      'incomeRelationshipId', v_target_income_relationship_id::text,
      'completionProof', pg_catalog.jsonb_build_object(
        'readbackVerified', true,
        'executionId', v_current_action.id::text,
        'readbackHash', v_readback_hash,
        'sourceHash', v_current_action.source_hash,
        'analysisHash', v_current_action.analysis_hash,
        'coreStateHash', v_current_action.core_state_hash
      )
    ));

  select * into v_event_result
  from public.record_payroll_import_finalization_event(
    v_current_action.tenant_id,
    v_current_action.hr_group_id,
    v_current_action.batch_id,
    v_current_action.action_id,
    'core-completed:' || v_current_action.attempt_count::text || ':' || v_current_action.lease_owner::text,
    'COMPLETED',
    requested_actor_user_id,
    v_current_action.attempt_count,
    v_current_action.source_hash,
    v_current_action.analysis_hash,
    v_current_action.core_state_hash,
    v_action_checkpoint,
    null,
    null,
    v_current_action.lease_owner,
    v_current_action.lease_token_hash
  );
  if v_event_result.status <> 'COMPLETED' then
    raise exception using errcode = '23514', message = 'PAYROLL_FINALIZATION_COMPLETION_READBACK_FAILED';
  end if;

  select p.completed_action_count, p.expected_action_count
  into v_completed_count, v_expected_count
  from public.payroll_import_finalization_plans p
  where p.id = v_current_plan.id;
  if v_completed_count = v_expected_count then
    update public.payroll_import_batches b
    set status = 'COMPLETED', finalized_at = pg_catalog.now()
    where b.id = v_current_batch.id
      and b.tenant_id = v_current_batch.tenant_id
      and b.hr_group_id = v_current_batch.hr_group_id
      and b.administration_id = v_current_batch.administration_id
      and b.status in ('STAGED','READY','FINALIZING');
    insert into public.audit_logs (
      tenant_id, administration_id, entity_name, entity_id, actor_user_id, action, changes
    ) values (
      v_current_batch.tenant_id, v_current_batch.administration_id,
      'payroll_import_batch', v_current_batch.id, requested_actor_user_id, 'UPDATE',
      pg_catalog.jsonb_build_object(
        'operation', 'CONTROL02_TEST_FINALIZE',
        'planHash', v_current_plan.plan_hash,
        'actionCount', v_expected_count,
        'sourceHash', v_current_batch.source_hash,
        'contractVersion', v_current_plan.contract_version
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'actionId', v_current_action.action_id,
    'status', v_event_result.status,
    'attemptCount', v_current_action.attempt_count,
    'checkpoint', v_action_checkpoint,
    'readbackHash', v_readback_hash,
    'planStatus', case when v_completed_count = v_expected_count then 'COMPLETED' else 'IN_PROGRESS' end
  );
end;
$$;

revoke all on function public.execute_control02_test_payroll_finalization_action(uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.execute_control02_test_payroll_finalization_action(uuid, uuid, uuid, text, uuid, uuid, text, jsonb, text) to service_role;
CREATE OR REPLACE FUNCTION public.record_payroll_import_finalization_event(requested_tenant_id uuid, requested_hr_group_id uuid, requested_batch_id uuid, requested_action_id text, requested_event_key text, requested_event_type text, requested_actor_user_id uuid, requested_attempt_number integer, requested_source_hash text, requested_analysis_hash text, requested_core_state_hash text, requested_checkpoint jsonb DEFAULT '{}'::jsonb, requested_error_code text DEFAULT NULL::text, requested_lease_until timestamp with time zone DEFAULT NULL::timestamp with time zone, requested_lease_owner uuid DEFAULT NULL::uuid, requested_lease_token_hash text DEFAULT NULL::text)
 RETURNS TABLE(action_id text, status text, attempt_count integer, event_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_current_action record;
  v_current_plan record;
  v_existing_event record;
  v_next_status text;
  v_next_plan_status text;
  v_next_attempt_count integer;
  v_next_lease_until timestamptz;
  v_next_lease_owner uuid;
  v_next_lease_token_hash text;
  v_next_completed_at timestamptz;
  v_next_error_code text;
  v_plan_total_count bigint;
  v_plan_completed_count bigint;
  v_next_event_id uuid;
begin
  if requested_tenant_id is null
    or requested_hr_group_id is null
    or requested_batch_id is null
    or requested_action_id is null
    or requested_event_key is null
    or requested_event_type is null
    or requested_actor_user_id is null
    or requested_attempt_number is null
    or requested_source_hash is null
    or requested_analysis_hash is null
    or requested_core_state_hash is null
    or requested_event_key !~ '^[A-Za-z0-9_.:-]{1,160}$'
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
      coalesce(jsonb_typeof(requested_checkpoint -> 'completionProof'), '') <> 'object'
      or coalesce(requested_checkpoint -> 'completionProof' ->> 'readbackVerified', '') <> 'true'
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

  select action_row.*
  into v_current_action
  from public.payroll_import_finalization_actions as action_row
  where action_row.tenant_id = requested_tenant_id
    and action_row.hr_group_id = requested_hr_group_id
    and action_row.batch_id = requested_batch_id
    and action_row.action_id = requested_action_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_ACTION_NOT_FOUND';
  end if;

  select plan_row.*
  into v_current_plan
  from public.payroll_import_finalization_plans as plan_row
  where plan_row.id = v_current_action.plan_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'PAYROLL_FINALIZATION_PLAN_NOT_FOUND';
  end if;

  if v_current_plan.status = 'INVALIDATED' then
    raise exception using
      errcode = '40901',
      message = 'PAYROLL_FINALIZATION_PLAN_INVALIDATED';
  end if;

  if v_current_action.source_hash <> requested_source_hash
    or v_current_action.analysis_hash <> requested_analysis_hash
    or v_current_action.core_state_hash <> requested_core_state_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_STATE_HASH_MISMATCH';
  end if;

  if v_current_plan.source_hash <> requested_source_hash
    or v_current_plan.analysis_hash <> requested_analysis_hash
    or v_current_plan.core_state_hash <> requested_core_state_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_STATE_HASH_MISMATCH';
  end if;

  if v_current_action.plan_hash <> v_current_plan.plan_hash then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_IDENTITY_MISMATCH';
  end if;

  select count(*)::bigint,
    count(*) filter (where action_row.status = 'COMPLETED')::bigint
  into v_plan_total_count, v_plan_completed_count
  from public.payroll_import_finalization_actions as action_row
  where action_row.plan_id = v_current_plan.id;

  if v_plan_total_count > v_current_plan.expected_action_count
    or v_plan_completed_count > v_current_plan.expected_action_count then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_ACTION_COUNT_INVALID';
  end if;

  select event_row.*
  into v_existing_event
  from public.payroll_import_finalization_action_events as event_row
  where event_row.tenant_id = requested_tenant_id
    and event_row.hr_group_id = requested_hr_group_id
    and event_row.batch_id = requested_batch_id
    and event_row.action_id = requested_action_id
    and event_row.event_key = requested_event_key;

  if found then
    if v_existing_event.event_type <> requested_event_type
      or v_existing_event.actor_user_id <> requested_actor_user_id
      or v_existing_event.attempt_number <> requested_attempt_number
      or v_existing_event.lease_owner is distinct from requested_lease_owner
      or v_existing_event.lease_until is distinct from requested_lease_until
      or v_existing_event.source_hash <> requested_source_hash
      or v_existing_event.analysis_hash <> requested_analysis_hash
      or v_existing_event.core_state_hash <> requested_core_state_hash
      or v_existing_event.checkpoint is distinct from requested_checkpoint
      or v_existing_event.error_code is distinct from requested_error_code then
      raise exception using
        errcode = '23505',
        message = 'PAYROLL_FINALIZATION_EVENT_KEY_REUSED';
    end if;

    if requested_event_type = 'CLAIMED'
      and (v_current_action.status <> 'IN_PROGRESS'
        or v_current_action.attempt_count <> requested_attempt_number
        or v_current_action.lease_owner is distinct from requested_lease_owner
        or v_current_action.lease_token_hash is distinct from requested_lease_token_hash
        or v_current_action.lease_until is distinct from requested_lease_until
        or v_current_action.lease_until <= pg_catalog.clock_timestamp()) then
      raise exception using
        errcode = '40901',
        message = 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE';
    end if;

    return query
    select v_current_action.action_id, v_current_action.status, v_current_action.attempt_count, v_existing_event.id;
    return;
  end if;

  v_next_status := v_current_action.status;
  v_next_attempt_count := v_current_action.attempt_count;
  v_next_lease_until := v_current_action.lease_until;
  v_next_lease_owner := v_current_action.lease_owner;
  v_next_lease_token_hash := v_current_action.lease_token_hash;
  v_next_completed_at := v_current_action.completed_at;
  v_next_error_code := v_current_action.last_error_code;

  if requested_event_type = 'PLANNED' then
    if v_current_action.status <> 'PENDING'
      or v_current_plan.status <> 'PENDING'
      or v_plan_total_count <> v_current_plan.expected_action_count
      or requested_attempt_number <> 0
      or requested_lease_until is not null
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_EVENT_STATE_CONFLICT';
    end if;
    v_next_status := 'PENDING';
    v_next_lease_until := null;
    v_next_lease_owner := null;
    v_next_lease_token_hash := null;
    v_next_completed_at := null;
    v_next_error_code := null;
  elsif requested_event_type = 'CLAIMED' then
    if v_current_action.status <> 'PENDING'
      or v_current_plan.status not in ('PENDING', 'IN_PROGRESS')
      or v_plan_total_count <> v_current_plan.expected_action_count
      or requested_attempt_number <> v_current_action.attempt_count + 1
      or requested_lease_until is null
      or requested_lease_owner is null
      or requested_lease_token_hash is null
      or requested_lease_until <= pg_catalog.clock_timestamp() then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_NOT_CLAIMABLE';
    end if;

    if cardinality(v_current_action.depends_on_action_ids) <> (
      select count(*)::integer
      from public.payroll_import_finalization_actions as dependency
      where dependency.tenant_id = v_current_action.tenant_id
        and dependency.hr_group_id = v_current_action.hr_group_id
        and dependency.batch_id = v_current_action.batch_id
        and dependency.plan_id = v_current_action.plan_id
        and dependency.import_person_id = v_current_action.import_person_id
        and dependency.action_id = any(v_current_action.depends_on_action_ids)
        and dependency.sequence_no < v_current_action.sequence_no
        and dependency.status = 'COMPLETED'
    ) then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_ACTION_DEPENDENCIES_INCOMPLETE';
    end if;

    v_next_status := 'IN_PROGRESS';
    v_next_attempt_count := requested_attempt_number;
    v_next_lease_until := requested_lease_until;
    v_next_lease_owner := requested_lease_owner;
    v_next_lease_token_hash := requested_lease_token_hash;
    v_next_completed_at := null;
    v_next_error_code := null;
  elsif requested_event_type = 'CHECKPOINT' then
    if v_current_action.status <> 'IN_PROGRESS'
      or v_current_plan.status <> 'IN_PROGRESS'
      or requested_attempt_number <> v_current_action.attempt_count
      or requested_lease_until is null
      or requested_lease_until <= pg_catalog.clock_timestamp()
      or v_current_action.lease_until is null
      or v_current_action.lease_until <= pg_catalog.clock_timestamp()
      or requested_lease_owner is distinct from v_current_action.lease_owner
      or requested_lease_token_hash is distinct from v_current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_CHECKPOINT_CONFLICT';
    end if;
    v_next_lease_until := requested_lease_until;
  elsif requested_event_type = 'COMPLETED' then
    if v_current_action.status <> 'IN_PROGRESS'
      or v_current_plan.status <> 'IN_PROGRESS'
      or v_plan_total_count <> v_current_plan.expected_action_count
      or requested_attempt_number <> v_current_action.attempt_count
      or v_current_action.lease_until is null
      or v_current_action.lease_until <= pg_catalog.clock_timestamp()
      or requested_lease_owner is distinct from v_current_action.lease_owner
      or requested_lease_token_hash is distinct from v_current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_COMPLETION_CONFLICT';
    end if;
    v_next_status := 'COMPLETED';
    v_next_lease_until := null;
    v_next_lease_owner := null;
    v_next_lease_token_hash := null;
    v_next_completed_at := pg_catalog.clock_timestamp();
    v_next_error_code := null;
  elsif requested_event_type = 'FAILED' then
    if v_current_action.status <> 'IN_PROGRESS'
      or v_current_plan.status <> 'IN_PROGRESS'
      or requested_attempt_number <> v_current_action.attempt_count
      or requested_error_code is null
      or v_current_action.lease_until is null
      or v_current_action.lease_until <= pg_catalog.clock_timestamp()
      or requested_lease_owner is distinct from v_current_action.lease_owner
      or requested_lease_token_hash is distinct from v_current_action.lease_token_hash then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_FAILURE_CONFLICT';
    end if;
    v_next_status := 'FAILED';
    v_next_lease_until := null;
    v_next_lease_owner := null;
    v_next_lease_token_hash := null;
    v_next_completed_at := null;
    v_next_error_code := requested_error_code;
  elsif requested_event_type = 'RETRY' then
    if v_current_action.status <> 'FAILED'
      or v_current_plan.status in ('COMPLETED', 'INVALIDATED', 'BLOCKED')
      or requested_attempt_number <> v_current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_RETRY_CONFLICT';
    end if;
    v_next_status := 'PENDING';
    v_next_lease_until := null;
    v_next_lease_owner := null;
    v_next_lease_token_hash := null;
    v_next_completed_at := null;
    v_next_error_code := null;
  elsif requested_event_type = 'RECOVERED' then
    if v_current_action.status <> 'IN_PROGRESS'
      or v_current_plan.status <> 'IN_PROGRESS'
      or v_current_action.lease_until is null
      or v_current_action.lease_owner is null
      or v_current_action.lease_token_hash is null
      or v_current_action.lease_until > pg_catalog.clock_timestamp()
      or requested_attempt_number <> v_current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_RECOVERY_CONFLICT';
    end if;
    v_next_status := 'PENDING';
    v_next_lease_until := null;
    v_next_lease_owner := null;
    v_next_lease_token_hash := null;
    v_next_completed_at := null;
    v_next_error_code := coalesce(requested_error_code, 'LEASE_EXPIRED');
  elsif requested_event_type = 'BLOCKED' then
    if v_current_action.status not in ('PENDING', 'FAILED')
      or v_current_plan.status in ('COMPLETED', 'INVALIDATED')
      or requested_attempt_number <> v_current_action.attempt_count
      or requested_lease_owner is not null
      or requested_lease_token_hash is not null then
      raise exception using errcode = '40901', message = 'PAYROLL_FINALIZATION_BLOCK_CONFLICT';
    end if;
    v_next_status := 'BLOCKED';
    v_next_lease_until := null;
    v_next_lease_owner := null;
    v_next_lease_token_hash := null;
    v_next_completed_at := null;
    v_next_error_code := requested_error_code;
  end if;

  update public.payroll_import_finalization_actions as action_row
  set status = v_next_status,
      attempt_count = v_next_attempt_count,
      lease_until = v_next_lease_until,
      lease_owner = v_next_lease_owner,
      lease_token_hash = v_next_lease_token_hash,
      last_attempt_at = case when requested_event_type = 'CLAIMED' then pg_catalog.clock_timestamp() else v_current_action.last_attempt_at end,
      completed_at = v_next_completed_at,
      last_error_code = v_next_error_code,
      checkpoint = requested_checkpoint,
      updated_at = pg_catalog.clock_timestamp()
  where action_row.id = v_current_action.id;

  select count(*)::bigint,
    count(*) filter (where action_row.status = 'COMPLETED')::bigint
  into v_plan_total_count, v_plan_completed_count
  from public.payroll_import_finalization_actions as action_row
  where action_row.plan_id = v_current_plan.id;

  if v_plan_total_count <> v_current_plan.expected_action_count then
    raise exception using
      errcode = '23514',
      message = 'PAYROLL_FINALIZATION_PLAN_INCOMPLETE';
  end if;

  v_next_plan_status := v_current_plan.status;
  if requested_event_type = 'COMPLETED' then
    v_next_plan_status := case when v_plan_completed_count = v_current_plan.expected_action_count then 'COMPLETED' else 'IN_PROGRESS' end;
  elsif requested_event_type = 'CLAIMED' or requested_event_type = 'CHECKPOINT' then
    v_next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'FAILED' then
    v_next_plan_status := 'FAILED';
  elsif requested_event_type = 'RETRY' then
    v_next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'RECOVERED' then
    v_next_plan_status := 'IN_PROGRESS';
  elsif requested_event_type = 'BLOCKED' then
    v_next_plan_status := 'BLOCKED';
  end if;

  update public.payroll_import_finalization_plans as plan_row
  set completed_action_count = v_plan_completed_count,
      status = v_next_plan_status,
      updated_at = pg_catalog.clock_timestamp()
  where plan_row.id = v_current_plan.id;

  insert into public.payroll_import_finalization_action_events as inserted_event (
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
  ) returning inserted_event.id into v_next_event_id;

  return query select v_current_action.action_id, v_next_status, v_next_attempt_count, v_next_event_id;
end;
$function$;
revoke all on function public.record_payroll_import_finalization_event(uuid, uuid, uuid, text, text, text, uuid, integer, text, text, text, jsonb, text, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.record_payroll_import_finalization_event(uuid, uuid, uuid, text, text, text, uuid, integer, text, text, text, jsonb, text, timestamptz, uuid, text) to service_role;
commit;
