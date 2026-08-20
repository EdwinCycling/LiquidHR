-- Dek de samengestelde foreign keys van salarisregels af met passende indexen.
create index if not exists employment_salaries_salary_band_idx
  on public.employment_salaries (tenant_id, hr_group_id, salary_band_id)
  where salary_band_id is not null;

create index if not exists employment_salaries_employment_hr_group_idx
  on public.employment_salaries (tenant_id, hr_group_id, employment_id);

create index if not exists employment_salaries_salary_scale_idx
  on public.employment_salaries (tenant_id, hr_group_id, salary_scale_id)
  where salary_scale_id is not null;

create index if not exists employment_salaries_salary_scale_step_scope_idx
  on public.employment_salaries (tenant_id, hr_group_id, salary_scale_step_id)
  where salary_scale_step_id is not null;
