create or replace function public.guard_individual_payroll_input_reference()
returns trigger
language plpgsql
as $$
declare
  assignment_employment_id uuid;
  config_employment_id uuid;
  opening_employment_id uuid;
  snapshot_assignment_version_id uuid;
  input_set_snapshot_id uuid;
  input_set_period_id uuid;
  source_employment_id uuid;
  source_period_reference date;
  period_start date;
  assignment_start date;
  assignment_end date;
  arrangement_snapshot_as_of date;
  config_start date;
  config_end date;
  opening_as_of date;
  period_end date;
begin
  select assignment.source_employment_id, assignment.effective_from, assignment.effective_to
    into assignment_employment_id, assignment_start, assignment_end
    from public.payroll_individual_arrangement_assignment_versions as assignment
    where assignment.id = new.assignment_version_id
      and assignment.payroll_administration_id = new.payroll_administration_id
      and assignment.source_tenant_id = new.source_tenant_id
      and assignment.source_hr_group_id = new.source_hr_group_id
      and assignment.source_administration_id = new.source_administration_id;
  select config.source_employment_id, config.effective_from, config.effective_to
    into config_employment_id, config_start, config_end
    from public.payroll_individual_calculation_config_versions as config
    where config.id = new.config_version_id
      and config.payroll_administration_id = new.payroll_administration_id
      and config.source_tenant_id = new.source_tenant_id
      and config.source_hr_group_id = new.source_hr_group_id
      and config.source_administration_id = new.source_administration_id;
  select opening.source_employment_id, opening.as_of_date
    into opening_employment_id, opening_as_of
    from public.payroll_opening_cumulative_snapshots as opening
    where opening.id = new.opening_cumulative_snapshot_id
      and opening.payroll_administration_id = new.payroll_administration_id
      and opening.source_tenant_id = new.source_tenant_id
      and opening.source_hr_group_id = new.source_hr_group_id
      and opening.source_administration_id = new.source_administration_id;
  select composition.assignment_version_id, composition.as_of_date
    into snapshot_assignment_version_id, arrangement_snapshot_as_of
    from public.payroll_individual_arrangement_composition_snapshots as composition
    where composition.id = new.arrangement_snapshot_id
      and composition.payroll_administration_id = new.payroll_administration_id
      and composition.source_tenant_id = new.source_tenant_id
      and composition.source_hr_group_id = new.source_hr_group_id
      and composition.source_administration_id = new.source_administration_id;
  select input_set.source_snapshot_id, input_set.payroll_period_id,
         source_snapshot.source_employment_id, source_snapshot.period_reference,
         payroll_period.starts_on, payroll_period.ends_on
    into input_set_snapshot_id, input_set_period_id, source_employment_id,
         source_period_reference, period_start, period_end
    from public.calculation_input_sets as input_set
    join public.source_snapshots as source_snapshot
      on source_snapshot.id = input_set.source_snapshot_id
     and source_snapshot.source_tenant_id = input_set.source_tenant_id
     and source_snapshot.source_hr_group_id = input_set.source_hr_group_id
     and source_snapshot.source_administration_id = input_set.source_administration_id
    join public.payroll_periods as payroll_period
      on payroll_period.id = input_set.payroll_period_id
     and payroll_period.source_tenant_id = input_set.source_tenant_id
     and payroll_period.source_hr_group_id = input_set.source_hr_group_id
     and payroll_period.source_administration_id = input_set.source_administration_id
    where input_set.id = new.calculation_input_set_id
      and input_set.payroll_administration_id = new.payroll_administration_id
      and input_set.source_tenant_id = new.source_tenant_id
      and input_set.source_hr_group_id = new.source_hr_group_id
      and input_set.source_administration_id = new.source_administration_id;

  if not found
    or assignment_employment_id is distinct from new.source_employment_id
    or config_employment_id is distinct from new.source_employment_id
    or opening_employment_id is distinct from new.source_employment_id
    or source_employment_id is distinct from new.source_employment_id
    or snapshot_assignment_version_id is distinct from new.assignment_version_id
    or input_set_snapshot_id is null
    or input_set_period_id is null
    or source_period_reference is distinct from period_start
    or arrangement_snapshot_as_of is distinct from period_start
    or assignment_start > period_start
    or (assignment_end is not null and assignment_end < period_end)
    or config_start > period_start
    or (config_end is not null and config_end < period_end)
    or opening_as_of <> (period_start - 1) then
    raise exception using errcode = '23514', message = 'PAYRUN01 input references must pin one employment, its effective versions, source snapshot, period, and prior opening balance.';
  end if;
  return new;
end;
$$;

alter function public.guard_individual_payroll_input_reference()
  set search_path = '';
