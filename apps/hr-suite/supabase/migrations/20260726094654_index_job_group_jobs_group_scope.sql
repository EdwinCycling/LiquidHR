create index job_group_jobs_group_scope_idx
  on public.job_group_jobs (tenant_id, administration_id, job_group_id);
