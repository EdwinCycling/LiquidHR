-- Deterministic non-personal test records for the optional family/seniority flows.

do $$
declare
  demo_tenant_id uuid;
  unscoped_group_id uuid;
  unscoped_job_id uuid;
begin
  select id into demo_tenant_id
  from public.tenants
  where name = 'Liquid HR Demo Holding'
  limit 1;

  if demo_tenant_id is null then
    return;
  end if;

  insert into public.job_groups (tenant_id, code, name, description, is_active, job_family_id)
  values (demo_tenant_id, 'J3', 'Algemene projectfuncties', 'Testgroep zonder functiefamilie.', true, null)
  on conflict (tenant_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        is_active = excluded.is_active,
        job_family_id = null;

  select id into unscoped_group_id
  from public.job_groups
  where tenant_id = demo_tenant_id and code = 'J3';

  insert into public.jobs (tenant_id, job_group_id, code, is_active, seniority_id)
  values (demo_tenant_id, unscoped_group_id, 'J3-UNSCOPED', true, null)
  on conflict (tenant_id, code) do update
    set job_group_id = excluded.job_group_id,
        is_active = excluded.is_active,
        seniority_id = null;

  select id into unscoped_job_id
  from public.jobs
  where tenant_id = demo_tenant_id and code = 'J3-UNSCOPED';

  insert into public.job_group_jobs (tenant_id, job_group_id, job_id)
  values (demo_tenant_id, unscoped_group_id, unscoped_job_id)
  on conflict do nothing;

  insert into public.job_revisions (tenant_id, job_id, name, description, valid_from, valid_until)
  select demo_tenant_id, unscoped_job_id, 'Algemeen project', 'Testfunctie zonder senioriteit.', current_date, null
  where not exists (
    select 1 from public.job_revisions
    where tenant_id = demo_tenant_id and job_id = unscoped_job_id and valid_until is null
  );
end;
$$;
