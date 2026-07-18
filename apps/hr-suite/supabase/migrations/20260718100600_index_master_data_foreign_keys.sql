create index employee_organizations_job_scope_idx on public.employee_organizations(tenant_id, administration_id, job_id) where job_id is not null;
create index jobs_group_scope_idx on public.jobs(tenant_id, administration_id, job_group_id);
create index job_revisions_job_scope_idx on public.job_revisions(tenant_id, administration_id, job_id);
create index salary_scale_revisions_scale_scope_idx on public.salary_scale_revisions(tenant_id, administration_id, salary_scale_id);
create index salary_scale_steps_revision_scope_idx on public.salary_scale_steps(tenant_id, administration_id, salary_scale_revision_id);
