-- Narrow TEST-only continuation for explicit correction successors after failed, result-less attempts.
-- Failed runs, input references, traces, and BLOCKED lifecycle events remain immutable audit history.
-- The same-scope, same-scenario, effective-slice, explicit-successor, RLS, and grants remain guarded.

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
      or (
        exists (
          select 1
          from public.individual_payroll_input_references as predecessor_input_ref
          where predecessor_input_ref.assignment_version_id = predecessor_id
            and predecessor_input_ref.payroll_administration_id = new.payroll_administration_id
            and predecessor_input_ref.source_tenant_id = new.source_tenant_id
            and predecessor_input_ref.source_hr_group_id = new.source_hr_group_id
            and predecessor_input_ref.source_administration_id = new.source_administration_id
            and predecessor_input_ref.source_employment_id = new.source_employment_id
        )
        and not exists (
          select 1
          from public.individual_payroll_input_references as predecessor_input_ref
          left join public.calculation_runs as predecessor_run
            on predecessor_run.calculation_input_set_id = predecessor_input_ref.calculation_input_set_id
           and predecessor_run.payroll_administration_id = predecessor_input_ref.payroll_administration_id
           and predecessor_run.source_tenant_id = predecessor_input_ref.source_tenant_id
           and predecessor_run.source_hr_group_id = predecessor_input_ref.source_hr_group_id
           and predecessor_run.source_administration_id = predecessor_input_ref.source_administration_id
          where predecessor_input_ref.assignment_version_id = predecessor_id
            and predecessor_input_ref.payroll_administration_id = new.payroll_administration_id
            and predecessor_input_ref.source_tenant_id = new.source_tenant_id
            and predecessor_input_ref.source_hr_group_id = new.source_hr_group_id
            and predecessor_input_ref.source_administration_id = new.source_administration_id
            and predecessor_input_ref.source_employment_id = new.source_employment_id
            and (
              predecessor_run.id is null
              or predecessor_run.run_type is distinct from 'INDIVIDUAL_PAYROLL'
              or predecessor_run.status is distinct from 'FAILED'
              or predecessor_run.result_hash is not null
              or exists (
                select 1
                from public.component_results as prior_result
                where prior_result.calculation_run_id = predecessor_run.id
                  and prior_result.payroll_administration_id = predecessor_run.payroll_administration_id
                  and prior_result.source_tenant_id = predecessor_run.source_tenant_id
                  and prior_result.source_hr_group_id = predecessor_run.source_hr_group_id
                  and prior_result.source_administration_id = predecessor_run.source_administration_id
              )
              or exists (
                select 1
                from public.individual_payroll_lifecycle_events as prior_event
                where prior_event.calculation_run_id = predecessor_run.id
                  and prior_event.payroll_administration_id = predecessor_run.payroll_administration_id
                  and prior_event.source_tenant_id = predecessor_run.source_tenant_id
                  and prior_event.source_hr_group_id = predecessor_run.source_hr_group_id
                  and prior_event.source_administration_id = predecessor_run.source_administration_id
                  and prior_event.source_employment_id = new.source_employment_id
                  and prior_event.event_type is distinct from 'BLOCKED'
              )
            )
        )
      )
    ) then
      raise exception using errcode = '23514', message = 'PAYRUN01 successors require a finalized successful predecessor, no predecessor references, or only failed no-result predecessor attempts.';
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
