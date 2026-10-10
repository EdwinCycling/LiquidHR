-- Narrow TEST-only extension for a first explicit successor when the predecessor has no payroll input history.
-- Any predecessor input reference keeps the finalized-success guard in force.
-- This changes guard functions only; existing triggers, RLS, grants, and historical rows remain untouched.

create or replace function public.guard_payroll_individual_effective_version()
returns trigger
language plpgsql
as $$
declare
  latest_version integer;
  predecessor_id uuid;
  predecessor_effective_from date;
  predecessor_effective_to date;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    new.payroll_administration_id::text || ':' || new.source_employment_id::text || ':' || tg_table_name,
    0
  ));

  if tg_table_name = 'payroll_individual_arrangement_assignment_versions' then
    if not exists (
      select 1
      from public.payroll_individual_arrangement_assignment_versions as existing
      where existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.source_employment_id = new.source_employment_id
        and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
        and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
    ) then
      return new;
    end if;

    select max(existing.assignment_version)
      into latest_version
      from public.payroll_individual_arrangement_assignment_versions as existing
      where existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.source_employment_id = new.source_employment_id
        and existing.assignment_id = new.assignment_id;

    if new.provenance_status is distinct from 'TEST_ONLY'
      or latest_version is null
      or new.assignment_version <> latest_version + 1
      or new.assignment_json ->> 'supersedesVersion' is distinct from latest_version::text
      or new.assignment_json ->> 'versionIntent' is distinct from 'CORRECTION_SUCCESSOR'
      or coalesce(pg_catalog.btrim(new.assignment_json ->> 'correctionReasonCode'), '') = ''
      or exists (
        select 1
        from public.payroll_individual_arrangement_assignment_versions as existing
        where existing.payroll_administration_id = new.payroll_administration_id
          and existing.source_tenant_id = new.source_tenant_id
          and existing.source_hr_group_id = new.source_hr_group_id
          and existing.source_administration_id = new.source_administration_id
          and existing.source_employment_id = new.source_employment_id
          and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
          and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
          and (
            existing.assignment_id is distinct from new.assignment_id
            or existing.provenance_status is distinct from new.provenance_status
            or existing.assignment_json ->> 'scenario' is distinct from new.assignment_json ->> 'scenario'
          )
      ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 effective-dated versions may not overlap without an explicit same-scope correction successor.';
    end if;

    select existing.id, existing.effective_from, existing.effective_to
      into predecessor_id, predecessor_effective_from, predecessor_effective_to
      from public.payroll_individual_arrangement_assignment_versions as existing
      where existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.source_employment_id = new.source_employment_id
        and existing.assignment_id = new.assignment_id
        and existing.assignment_version = latest_version;

    if predecessor_id is null
      or new.effective_from is distinct from predecessor_effective_from
      or new.effective_to is distinct from predecessor_effective_to
      or new.assignment_json ->> 'supersedesAssignmentVersionId' is distinct from predecessor_id::text
      or not (
      exists (
select 1
        from public.individual_payroll_input_references as input_ref
        join public.calculation_runs as calculation_run
          on calculation_run.calculation_input_set_id = input_ref.calculation_input_set_id
         and calculation_run.payroll_administration_id = input_ref.payroll_administration_id
         and calculation_run.source_tenant_id = input_ref.source_tenant_id
         and calculation_run.source_hr_group_id = input_ref.source_hr_group_id
         and calculation_run.source_administration_id = input_ref.source_administration_id
        join public.calculation_input_sets as input_set
          on input_set.id = input_ref.calculation_input_set_id
         and input_set.payroll_administration_id = input_ref.payroll_administration_id
         and input_set.source_tenant_id = input_ref.source_tenant_id
         and input_set.source_hr_group_id = input_ref.source_hr_group_id
         and input_set.source_administration_id = input_ref.source_administration_id
        join public.payroll_periods as payroll_period
          on payroll_period.id = input_set.payroll_period_id
         and payroll_period.payroll_administration_id = input_set.payroll_administration_id
         and payroll_period.source_tenant_id = input_set.source_tenant_id
         and payroll_period.source_hr_group_id = input_set.source_hr_group_id
         and payroll_period.source_administration_id = input_set.source_administration_id
        join public.individual_payroll_lifecycle_events as finalized_event
          on finalized_event.calculation_run_id = calculation_run.id
         and finalized_event.payroll_administration_id = calculation_run.payroll_administration_id
         and finalized_event.source_tenant_id = calculation_run.source_tenant_id
         and finalized_event.source_hr_group_id = calculation_run.source_hr_group_id
         and finalized_event.source_administration_id = calculation_run.source_administration_id
         and finalized_event.payroll_period_id = payroll_period.id
         and finalized_event.source_employment_id = input_ref.source_employment_id
         and finalized_event.event_type = 'FINALIZED'
        where input_ref.assignment_version_id = predecessor_id
          and input_ref.payroll_administration_id = new.payroll_administration_id
          and input_ref.source_tenant_id = new.source_tenant_id
          and input_ref.source_hr_group_id = new.source_hr_group_id
          and input_ref.source_administration_id = new.source_administration_id
          and input_ref.source_employment_id = new.source_employment_id
          and calculation_run.run_type = 'INDIVIDUAL_PAYROLL'
          and calculation_run.status = 'SUCCEEDED'
          and calculation_run.result_hash is not null
          and payroll_period.starts_on <= coalesce(new.effective_to, 'infinity'::date)
          and payroll_period.ends_on >= new.effective_from
      )
      or not exists (
        select 1
        from public.individual_payroll_input_references as predecessor_input_ref
        where predecessor_input_ref.assignment_version_id = predecessor_id
          and predecessor_input_ref.payroll_administration_id = new.payroll_administration_id
          and predecessor_input_ref.source_tenant_id = new.source_tenant_id
          and predecessor_input_ref.source_hr_group_id = new.source_hr_group_id
          and predecessor_input_ref.source_administration_id = new.source_administration_id
          and predecessor_input_ref.source_employment_id = new.source_employment_id
      )
    ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 successors require a finalized successful predecessor run or no predecessor input references.';
    end if;

    return new;
  elsif tg_table_name = 'payroll_individual_calculation_config_versions' then
    if not exists (
      select 1
      from public.payroll_individual_calculation_config_versions as existing
      where existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.source_employment_id = new.source_employment_id
        and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
        and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
    ) then
      return new;
    end if;

    select max(existing.config_version)
      into latest_version
      from public.payroll_individual_calculation_config_versions as existing
      where existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.source_employment_id = new.source_employment_id;

    if new.provenance_status is distinct from 'TEST_ONLY'
      or latest_version is null
      or new.config_version <> latest_version + 1
      or new.config_json ->> 'supersedesVersion' is distinct from latest_version::text
      or new.config_json ->> 'versionIntent' is distinct from 'CORRECTION_SUCCESSOR'
      or coalesce(pg_catalog.btrim(new.config_json ->> 'correctionReasonCode'), '') = ''
      or new.config_hash is null
      or exists (
        select 1
        from public.payroll_individual_calculation_config_versions as existing
        where existing.payroll_administration_id = new.payroll_administration_id
          and existing.source_tenant_id = new.source_tenant_id
          and existing.source_hr_group_id = new.source_hr_group_id
          and existing.source_administration_id = new.source_administration_id
          and existing.source_employment_id = new.source_employment_id
          and existing.effective_from <= coalesce(new.effective_to, 'infinity'::date)
          and coalesce(existing.effective_to, 'infinity'::date) >= new.effective_from
          and (
            existing.provenance_status is distinct from new.provenance_status
            or existing.config_json ->> 'scenario' is distinct from new.config_json ->> 'scenario'
          )
      ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 effective-dated versions may not overlap without an explicit same-scope correction successor.';
    end if;

    select existing.id, existing.effective_from, existing.effective_to
      into predecessor_id, predecessor_effective_from, predecessor_effective_to
      from public.payroll_individual_calculation_config_versions as existing
      where existing.payroll_administration_id = new.payroll_administration_id
        and existing.source_tenant_id = new.source_tenant_id
        and existing.source_hr_group_id = new.source_hr_group_id
        and existing.source_administration_id = new.source_administration_id
        and existing.source_employment_id = new.source_employment_id
        and existing.config_version = latest_version;

    if predecessor_id is null
      or new.effective_from is distinct from predecessor_effective_from
      or new.effective_to is distinct from predecessor_effective_to
      or new.config_json ->> 'supersedesConfigVersionId' is distinct from predecessor_id::text
      or new.config_hash = (
        select existing.config_hash
        from public.payroll_individual_calculation_config_versions as existing
        where existing.id = predecessor_id
      )
      or not (
      exists (
select 1
        from public.individual_payroll_input_references as input_ref
        join public.calculation_runs as calculation_run
          on calculation_run.calculation_input_set_id = input_ref.calculation_input_set_id
         and calculation_run.payroll_administration_id = input_ref.payroll_administration_id
         and calculation_run.source_tenant_id = input_ref.source_tenant_id
         and calculation_run.source_hr_group_id = input_ref.source_hr_group_id
         and calculation_run.source_administration_id = input_ref.source_administration_id
        join public.calculation_input_sets as input_set
          on input_set.id = input_ref.calculation_input_set_id
         and input_set.payroll_administration_id = input_ref.payroll_administration_id
         and input_set.source_tenant_id = input_ref.source_tenant_id
         and input_set.source_hr_group_id = input_ref.source_hr_group_id
         and input_set.source_administration_id = input_ref.source_administration_id
        join public.payroll_periods as payroll_period
          on payroll_period.id = input_set.payroll_period_id
         and payroll_period.payroll_administration_id = input_set.payroll_administration_id
         and payroll_period.source_tenant_id = input_set.source_tenant_id
         and payroll_period.source_hr_group_id = input_set.source_hr_group_id
         and payroll_period.source_administration_id = input_set.source_administration_id
        join public.individual_payroll_lifecycle_events as finalized_event
          on finalized_event.calculation_run_id = calculation_run.id
         and finalized_event.payroll_administration_id = calculation_run.payroll_administration_id
         and finalized_event.source_tenant_id = calculation_run.source_tenant_id
         and finalized_event.source_hr_group_id = calculation_run.source_hr_group_id
         and finalized_event.source_administration_id = calculation_run.source_administration_id
         and finalized_event.payroll_period_id = payroll_period.id
         and finalized_event.source_employment_id = input_ref.source_employment_id
         and finalized_event.event_type = 'FINALIZED'
        where input_ref.config_version_id = predecessor_id
          and input_ref.payroll_administration_id = new.payroll_administration_id
          and input_ref.source_tenant_id = new.source_tenant_id
          and input_ref.source_hr_group_id = new.source_hr_group_id
          and input_ref.source_administration_id = new.source_administration_id
          and input_ref.source_employment_id = new.source_employment_id
          and calculation_run.run_type = 'INDIVIDUAL_PAYROLL'
          and calculation_run.status = 'SUCCEEDED'
          and calculation_run.result_hash is not null
          and payroll_period.starts_on <= coalesce(new.effective_to, 'infinity'::date)
          and payroll_period.ends_on >= new.effective_from
      )
      or not exists (
        select 1
        from public.individual_payroll_input_references as predecessor_input_ref
        where predecessor_input_ref.config_version_id = predecessor_id
          and predecessor_input_ref.payroll_administration_id = new.payroll_administration_id
          and predecessor_input_ref.source_tenant_id = new.source_tenant_id
          and predecessor_input_ref.source_hr_group_id = new.source_hr_group_id
          and predecessor_input_ref.source_administration_id = new.source_administration_id
          and predecessor_input_ref.source_employment_id = new.source_employment_id
      )
    ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 successors require a finalized successful predecessor run or no predecessor input references.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

alter function public.guard_payroll_individual_effective_version()
  set search_path = '';

revoke all on function public.guard_payroll_individual_effective_version() from public, anon, authenticated, service_role;

create or replace function public.guard_payroll_individual_correction_input_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_config public.payroll_individual_calculation_config_versions%rowtype;
  predecessor_config public.payroll_individual_calculation_config_versions%rowtype;
  current_input public.calculation_input_sets%rowtype;
  current_period public.payroll_periods%rowtype;
  current_source public.source_snapshots%rowtype;
  predecessor_input_set_id uuid;
  predecessor_snapshot_id uuid;
  predecessor_input_hash text;
  predecessor_source_hash text;
  predecessor_run_id uuid;
  predecessor_result_hash text;
  successor_metadata jsonb;
begin
  select config.*
    into current_config
    from public.payroll_individual_calculation_config_versions as config
    where config.id = new.config_version_id
      and config.payroll_administration_id = new.payroll_administration_id
      and config.source_tenant_id = new.source_tenant_id
      and config.source_hr_group_id = new.source_hr_group_id
      and config.source_administration_id = new.source_administration_id
      and config.source_employment_id = new.source_employment_id;

  if not found or current_config.config_json ->> 'versionIntent' is distinct from 'CORRECTION_SUCCESSOR' then
    return new;
  end if;

  if coalesce(current_config.config_json ->> 'supersedesVersion', '') !~ '^[0-9]+$'
    or current_config.config_version < 2 then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction provenance must identify one explicit predecessor version.';
  end if;

  select config.*
    into predecessor_config
    from public.payroll_individual_calculation_config_versions as config
    where config.payroll_administration_id = current_config.payroll_administration_id
      and config.source_tenant_id = current_config.source_tenant_id
      and config.source_hr_group_id = current_config.source_hr_group_id
      and config.source_administration_id = current_config.source_administration_id
      and config.source_employment_id = current_config.source_employment_id
      and config.config_version = (current_config.config_json ->> 'supersedesVersion')::integer;

  if not found
    or current_config.config_version <> predecessor_config.config_version + 1
    or current_config.effective_from is distinct from predecessor_config.effective_from
    or current_config.effective_to is distinct from predecessor_config.effective_to
    or current_config.config_json ->> 'supersedesConfigVersionId' is distinct from predecessor_config.id::text
    or current_config.config_hash = predecessor_config.config_hash
    or current_config.provenance_status is distinct from 'TEST_ONLY'
    or predecessor_config.provenance_status is distinct from 'TEST_ONLY'
    or current_config.config_json ->> 'scenario' is distinct from predecessor_config.config_json ->> 'scenario' then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction provenance must reference a same-scope, same-scenario successor config.';
  end if;

  successor_metadata := new.input_provenance_json -> 'supersession';
  if pg_catalog.jsonb_typeof(successor_metadata) is distinct from 'object'
    or coalesce(successor_metadata ->> 'kind', '') not in ('CORRECTION_SUCCESSOR', 'INITIAL_FIXTURE_SUCCESSOR')
    or successor_metadata ->> 'successorConfigVersionId' is distinct from current_config.id::text
    or successor_metadata ->> 'successorConfigVersion' is distinct from current_config.config_version::text
    or successor_metadata ->> 'supersedesConfigVersionId' is distinct from predecessor_config.id::text
    or successor_metadata ->> 'supersedesConfigVersion' is distinct from predecessor_config.config_version::text
    or successor_metadata ->> 'successorInputSetId' is distinct from new.calculation_input_set_id::text
    or successor_metadata ->> 'successorInputHash' is distinct from new.input_provenance_json ->> 'inputHash'
    or successor_metadata ->> 'successorSourceSnapshotId' is distinct from new.input_provenance_json -> 'versions' ->> 'sourceSnapshotId'
    or successor_metadata ->> 'successorSourceHash' is distinct from new.input_provenance_json ->> 'sourceHash'
    or successor_metadata ->> 'reasonCode' is distinct from current_config.config_json ->> 'correctionReasonCode'
    or coalesce(pg_catalog.btrim(successor_metadata ->> 'reasonCode'), '') = '' then
    raise exception using errcode = '23514', message = 'PAYRUN01 successor input reference must carry the explicit successor and correction provenance.';
  end if;

  if successor_metadata ->> 'kind' = 'CORRECTION_SUCCESSOR'
    and (
      coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesRunId'), '') = ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesInputSetId'), '') = ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesInputHash'), '') = ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesResultHash'), '') = ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesSourceSnapshotId'), '') = ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesSourceHash'), '') = ''
    ) then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction successor must identify its finalized predecessor run, input, result, and source.';
  end if;

  if successor_metadata ->> 'kind' = 'INITIAL_FIXTURE_SUCCESSOR'
    and (
      coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesRunId'), '') <> ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesInputSetId'), '') <> ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesInputHash'), '') <> ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesResultHash'), '') <> ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesSourceSnapshotId'), '') <> ''
      or coalesce(pg_catalog.btrim(successor_metadata ->> 'supersedesSourceHash'), '') <> ''
    ) then
    raise exception using errcode = '23514', message = 'PAYRUN01 initial fixture successor may not claim predecessor payroll evidence.';
  end if;

  select input_set.*
    into current_input
    from public.calculation_input_sets as input_set
    where input_set.id = new.calculation_input_set_id
      and input_set.payroll_administration_id = new.payroll_administration_id
      and input_set.source_tenant_id = new.source_tenant_id
      and input_set.source_hr_group_id = new.source_hr_group_id
      and input_set.source_administration_id = new.source_administration_id;
  if not found then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction input set must exist in the same scoped administration.';
  end if;

  select payroll_period.*
    into current_period
    from public.payroll_periods as payroll_period
    where payroll_period.id = current_input.payroll_period_id
      and payroll_period.payroll_administration_id = new.payroll_administration_id
      and payroll_period.source_tenant_id = new.source_tenant_id
      and payroll_period.source_hr_group_id = new.source_hr_group_id
      and payroll_period.source_administration_id = new.source_administration_id;
  if not found then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction period must exist in the same scoped administration.';
  end if;

  select source_snapshot.*
    into current_source
    from public.source_snapshots as source_snapshot
    where source_snapshot.id = current_input.source_snapshot_id
      and source_snapshot.payroll_administration_id = new.payroll_administration_id
      and source_snapshot.source_tenant_id = new.source_tenant_id
      and source_snapshot.source_hr_group_id = new.source_hr_group_id
      and source_snapshot.source_administration_id = new.source_administration_id;
  if not found
    or new.input_provenance_json ->> 'sourceHash' is distinct from current_source.source_hash
    or new.input_provenance_json ->> 'inputHash' is distinct from current_input.input_hash
    or new.input_provenance_json -> 'versions' ->> 'configHash' is distinct from current_config.config_hash
    or new.input_provenance_json -> 'versions' ->> 'configVersionId' is distinct from current_config.id::text
    or new.input_provenance_json -> 'versions' ->> 'configVersionNumber' is distinct from current_config.config_version::text then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction input hashes and config provenance must match the selected immutable rows.';
  end if;

  if successor_metadata ->> 'kind' = 'CORRECTION_SUCCESSOR' then
  select input_ref.calculation_input_set_id,
         input_set.source_snapshot_id,
         input_set.input_hash,
         predecessor_source.source_hash,
         calculation_run.id,
         calculation_run.result_hash
    into predecessor_input_set_id,
         predecessor_snapshot_id,
         predecessor_input_hash,
         predecessor_source_hash,
         predecessor_run_id,
         predecessor_result_hash
    from public.individual_payroll_input_references as input_ref
    join public.calculation_input_sets as input_set
      on input_set.id = input_ref.calculation_input_set_id
     and input_set.payroll_administration_id = input_ref.payroll_administration_id
     and input_set.source_tenant_id = input_ref.source_tenant_id
     and input_set.source_hr_group_id = input_ref.source_hr_group_id
     and input_set.source_administration_id = input_ref.source_administration_id
    join public.calculation_runs as calculation_run
      on calculation_run.calculation_input_set_id = input_ref.calculation_input_set_id
     and calculation_run.payroll_administration_id = input_ref.payroll_administration_id
     and calculation_run.source_tenant_id = input_ref.source_tenant_id
     and calculation_run.source_hr_group_id = input_ref.source_hr_group_id
     and calculation_run.source_administration_id = input_ref.source_administration_id
    join public.source_snapshots as predecessor_source
      on predecessor_source.id = input_set.source_snapshot_id
     and predecessor_source.payroll_administration_id = input_set.payroll_administration_id
     and predecessor_source.source_tenant_id = input_set.source_tenant_id
     and predecessor_source.source_hr_group_id = input_set.source_hr_group_id
     and predecessor_source.source_administration_id = input_set.source_administration_id
    join public.individual_payroll_lifecycle_events as finalized_event
      on finalized_event.calculation_run_id = calculation_run.id
     and finalized_event.payroll_administration_id = calculation_run.payroll_administration_id
     and finalized_event.source_tenant_id = calculation_run.source_tenant_id
     and finalized_event.source_hr_group_id = calculation_run.source_hr_group_id
     and finalized_event.source_administration_id = calculation_run.source_administration_id
     and finalized_event.payroll_period_id = current_period.id
     and finalized_event.source_employment_id = input_ref.source_employment_id
     and finalized_event.event_type = 'FINALIZED'
    where input_ref.config_version_id = predecessor_config.id
      and input_ref.payroll_administration_id = new.payroll_administration_id
      and input_ref.source_tenant_id = new.source_tenant_id
      and input_ref.source_hr_group_id = new.source_hr_group_id
      and input_ref.source_administration_id = new.source_administration_id
      and input_ref.source_employment_id = new.source_employment_id
      and input_set.payroll_administration_id = new.payroll_administration_id
      and input_set.payroll_period_id = current_period.id
      and calculation_run.id::text = successor_metadata ->> 'supersedesRunId'
      and calculation_run.run_type = 'INDIVIDUAL_PAYROLL'
      and calculation_run.status = 'SUCCEEDED'
      and calculation_run.result_hash is not null
    order by calculation_run.created_at desc
    limit 1;

  if predecessor_run_id is null
    or predecessor_input_set_id::text is distinct from successor_metadata ->> 'supersedesInputSetId'
    or predecessor_input_hash is distinct from successor_metadata ->> 'supersedesInputHash'
    or predecessor_result_hash is distinct from successor_metadata ->> 'supersedesResultHash'
    or predecessor_snapshot_id::text is distinct from successor_metadata ->> 'supersedesSourceSnapshotId'
    or predecessor_source_hash is distinct from successor_metadata ->> 'supersedesSourceHash'
    or new.calculation_input_set_id = predecessor_input_set_id
    or current_input.input_hash = predecessor_input_hash
    or (current_source.source_hash is distinct from predecessor_source_hash
      and current_input.source_snapshot_id = predecessor_snapshot_id) then
    raise exception using errcode = '23514', message = 'PAYRUN01 correction must create a new input set and changed source identity must produce a new snapshot and input hash.';
  end if;

  elsif successor_metadata ->> 'kind' = 'INITIAL_FIXTURE_SUCCESSOR' then
    if exists (
      select 1
      from public.individual_payroll_input_references as predecessor_input_ref
      where predecessor_input_ref.config_version_id = predecessor_config.id
        and predecessor_input_ref.payroll_administration_id = new.payroll_administration_id
        and predecessor_input_ref.source_tenant_id = new.source_tenant_id
        and predecessor_input_ref.source_hr_group_id = new.source_hr_group_id
        and predecessor_input_ref.source_administration_id = new.source_administration_id
        and predecessor_input_ref.source_employment_id = new.source_employment_id
    ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 initial fixture successor requires no predecessor input reference or payroll run.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_payroll_individual_correction_input_reference() from public, anon, authenticated, service_role;
