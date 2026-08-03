with existing_jobs as (
  select distinct on (job.tenant_id, job.id)
    job.tenant_id,
    job.id as job_id,
    revision.name,
    revision.description
  from public.jobs job
  left join public.job_revisions revision
    on revision.tenant_id = job.tenant_id
   and revision.job_id = job.id
  order by job.tenant_id, job.id, revision.valid_from desc nulls last, revision.updated_at desc nulls last
)
insert into public.job_profiles (tenant_id, job_id)
select tenant_id, job_id
from existing_jobs
on conflict (tenant_id, job_id) do nothing;

with existing_jobs as (
  select distinct on (job.tenant_id, job.id)
    job.tenant_id,
    job.id as job_id,
    revision.name,
    revision.description
  from public.jobs job
  left join public.job_revisions revision
    on revision.tenant_id = job.tenant_id
   and revision.job_id = job.id
  order by job.tenant_id, job.id, revision.valid_from desc nulls last, revision.updated_at desc nulls last
)
insert into public.job_profile_versions (
  tenant_id, job_profile_id, version_number, status, purpose, summary
)
select profile.tenant_id, profile.id, 1, 'DRAFT', existing_jobs.name, existing_jobs.description
from existing_jobs
join public.job_profiles profile
  on profile.tenant_id = existing_jobs.tenant_id
 and profile.job_id = existing_jobs.job_id
on conflict (tenant_id, job_profile_id, version_number) do nothing;
