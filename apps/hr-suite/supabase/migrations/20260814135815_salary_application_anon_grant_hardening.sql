-- Salarytabellen zijn uitsluitend via authenticated + RLS bereikbaar.
revoke all on table public.salary_structures,
  public.salary_structure_revisions,
  public.salary_scale_revision_values,
  public.salary_scale_steps,
  public.salary_bands,
  public.salary_band_values,
  public.labor_condition_salary_structures,
  public.salary_structure_migration_conflicts,
  public.employment_salaries,
  public.administration_hr_settings
from public, anon;
