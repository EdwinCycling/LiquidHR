begin;

alter function public.reject_payroll_arrangement_mutation()
  set search_path = '';

create index payroll_arrangement_composition_snapshots_assignment_scope_idx
  on public.payroll_arrangement_composition_snapshots (
    assignment_id,
    payroll_administration_id,
    source_tenant_id,
    source_hr_group_id,
    source_administration_id,
    source_employment_id
  );

commit;
