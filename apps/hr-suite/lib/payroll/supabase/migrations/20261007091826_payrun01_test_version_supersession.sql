-- Preserve failed TEST-only input versions as immutable history while allowing
-- a later explicit scenario revision to replace them for the same period.
-- Successful calculations keep their version pinned and cannot be superseded
-- across an overlapping effective period.

create or replace function public.guard_payroll_individual_effective_version()
returns trigger
language plpgsql
as $$
declare
  latest_version integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    new.payroll_administration_id::text || ':' || new.source_employment_id::text || ':' || tg_table_name,
    0
  ));

  if tg_table_name = 'payroll_individual_arrangement_assignment_versions' then
    if exists (
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
      select max(existing.assignment_version)
        into latest_version
        from public.payroll_individual_arrangement_assignment_versions as existing
        where existing.payroll_administration_id = new.payroll_administration_id
          and existing.source_tenant_id = new.source_tenant_id
          and existing.source_hr_group_id = new.source_hr_group_id
          and existing.source_administration_id = new.source_administration_id
          and existing.source_employment_id = new.source_employment_id
          and existing.assignment_id = new.assignment_id;

      if new.provenance_status = 'TEST_ONLY'
        and latest_version is not null
        and new.assignment_version = latest_version + 1
        and new.assignment_json ->> 'supersedesVersion' = latest_version::text
        and not exists (
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
              or existing.provenance_status <> 'TEST_ONLY'
              or exists (
                select 1
                from public.individual_payroll_input_references as input_ref
                join public.calculation_runs as calculation_run
                  on calculation_run.calculation_input_set_id = input_ref.calculation_input_set_id
                join public.calculation_input_sets as input_set
                  on input_set.id = input_ref.calculation_input_set_id
                join public.payroll_periods as payroll_period
                  on payroll_period.id = input_set.payroll_period_id
                where input_ref.assignment_version_id = existing.id
                  and calculation_run.status = 'SUCCEEDED'
                  and payroll_period.starts_on <= coalesce(new.effective_to, 'infinity'::date)
                  and payroll_period.ends_on >= new.effective_from
              )
            )
        ) then
        return new;
      end if;

      raise exception using errcode = '23514', message = 'PAYRUN01 effective-dated versions may not overlap for one employment.';
    end if;
  elsif tg_table_name = 'payroll_individual_calculation_config_versions' then
    if exists (
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
      select max(existing.config_version)
        into latest_version
        from public.payroll_individual_calculation_config_versions as existing
        where existing.payroll_administration_id = new.payroll_administration_id
          and existing.source_tenant_id = new.source_tenant_id
          and existing.source_hr_group_id = new.source_hr_group_id
          and existing.source_administration_id = new.source_administration_id
          and existing.source_employment_id = new.source_employment_id;

      if new.provenance_status = 'TEST_ONLY'
        and latest_version is not null
        and new.config_version = latest_version + 1
        and new.config_json ->> 'supersedesVersion' = latest_version::text
        and not exists (
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
              existing.provenance_status <> 'TEST_ONLY'
              or exists (
                select 1
                from public.individual_payroll_input_references as input_ref
                join public.calculation_runs as calculation_run
                  on calculation_run.calculation_input_set_id = input_ref.calculation_input_set_id
                join public.calculation_input_sets as input_set
                  on input_set.id = input_ref.calculation_input_set_id
                join public.payroll_periods as payroll_period
                  on payroll_period.id = input_set.payroll_period_id
                where input_ref.config_version_id = existing.id
                  and calculation_run.status = 'SUCCEEDED'
                  and payroll_period.starts_on <= coalesce(new.effective_to, 'infinity'::date)
                  and payroll_period.ends_on >= new.effective_from
              )
            )
        ) then
        return new;
      end if;

      raise exception using errcode = '23514', message = 'PAYRUN01 effective-dated versions may not overlap for one employment.';
    end if;
  end if;

  return new;
end;
$$;

alter function public.guard_payroll_individual_effective_version()
  set search_path = '';
