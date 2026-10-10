CREATE INDEX IF NOT EXISTS labor_condition_pension_arrangements_supersedes_scope_idx
  ON public.labor_condition_pension_arrangements
    (supersedes_mapping_id, tenant_id, hr_group_id, administration_id, labor_condition_set_id, participant_group);

CREATE INDEX IF NOT EXISTS employment_pension_assignments_supersedes_scope_idx
  ON public.employment_pension_arrangement_assignments
    (supersedes_assignment_id, tenant_id, hr_group_id, administration_id, employment_id);
