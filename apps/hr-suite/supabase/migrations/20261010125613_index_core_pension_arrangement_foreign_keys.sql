-- Cover the two pension-arrangement foreign keys identified by the Core/DEV
-- performance advisor after the 20261008062756 schema was reconciled.
-- Repository-only while Core/DEV access remains read-only.

CREATE INDEX IF NOT EXISTS employment_pension_arrangement_assignments_arrangement_idx
  ON public.employment_pension_arrangement_assignments (pension_arrangement_id);

CREATE INDEX IF NOT EXISTS labor_condition_pension_arrangements_arrangement_idx
  ON public.labor_condition_pension_arrangements (pension_arrangement_id);
