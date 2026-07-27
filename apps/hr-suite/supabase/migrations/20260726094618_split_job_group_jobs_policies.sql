drop policy if exists job_group_jobs_write on public.job_group_jobs;

create policy job_group_jobs_insert
on public.job_group_jobs for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));

create policy job_group_jobs_update
on public.job_group_jobs for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')))
with check ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));

create policy job_group_jobs_delete
on public.job_group_jobs for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, administration_id, 'job-catalog:write')));
