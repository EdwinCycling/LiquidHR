-- Job Architecture contract checks. The script raises on an integrity regression.

do $$
declare
  orphan_count integer;
  duplicate_count integer;
  demo_tenant_id uuid;
  demo_group_id uuid;
  demo_family_id uuid;
  demo_seniority_id uuid;
  duplicate_name text;
  other_tenant_id uuid;
  cross_tenant_rejected boolean;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_groups' and column_name = 'job_family_id'
  ) then
    raise exception 'JOB_FAMILY_COLUMN_MISSING';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'seniority_id'
  ) then
    raise exception 'SENIORITY_COLUMN_MISSING';
  end if;

  select count(*) into orphan_count
  from public.job_group_jobs relation
  left join public.job_groups job_group
    on job_group.tenant_id = relation.tenant_id and job_group.id = relation.job_group_id
  left join public.jobs job
    on job.tenant_id = relation.tenant_id and job.id = relation.job_id
  where job_group.id is null or job.id is null;
  if orphan_count <> 0 then raise exception 'ORPHAN_JOB_GROUP_RELATION'; end if;

  select count(*) into orphan_count
  from public.job_groups job_group
  left join public.job_families family
    on family.tenant_id = job_group.tenant_id and family.id = job_group.job_family_id
  where job_group.job_family_id is not null and family.id is null;
  if orphan_count <> 0 then raise exception 'ORPHAN_JOB_FAMILY_RELATION'; end if;

  select count(*) into orphan_count
  from public.jobs job
  left join public.talent_seniorities seniority
    on seniority.tenant_id = job.tenant_id and seniority.id = job.seniority_id
  where job.seniority_id is not null and seniority.id is null;
  if orphan_count <> 0 then raise exception 'ORPHAN_SENIORITY_RELATION'; end if;

  with current_revisions as (
    select distinct on (tenant_id, job_id)
      tenant_id, job_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) as normalized_name
    from public.job_revisions
    where valid_until is null
    order by tenant_id, job_id, valid_from desc
  )
  select count(*) into duplicate_count
  from (
    select job.tenant_id, job.job_group_id, job.seniority_id, current_revisions.normalized_name
    from public.jobs job
    join current_revisions on current_revisions.tenant_id = job.tenant_id and current_revisions.job_id = job.id
    where job.is_active
    group by job.tenant_id, job.job_group_id, job.seniority_id, current_revisions.normalized_name
    having count(*) > 1
  ) duplicates;
  if duplicate_count <> 0 then raise exception 'DUPLICATE_ACTIVE_JOB_FUNCTION'; end if;

  select id into demo_tenant_id from public.tenants where name = 'Liquid HR Demo Holding' limit 1;
  if demo_tenant_id is not null then
    if not exists (select 1 from public.job_groups where tenant_id = demo_tenant_id and job_family_id is null) then raise exception 'OPTIONAL_FAMILY_FLOW_NOT_SEEDED'; end if;
    if not exists (select 1 from public.jobs where tenant_id = demo_tenant_id and seniority_id is null) then raise exception 'OPTIONAL_SENIORITY_FLOW_NOT_SEEDED'; end if;

    select job.job_group_id, job.seniority_id, revision.name
      into demo_group_id, demo_seniority_id, duplicate_name
      from public.jobs job
      join public.job_revisions revision
        on revision.tenant_id = job.tenant_id
       and revision.job_id = job.id
       and revision.valid_until is null
     where job.tenant_id = demo_tenant_id
       and job.seniority_id is not null
       and revision.name is not null
     order by job.code
     limit 1;
    select family.id
      into demo_family_id
      from public.job_families family
     where family.tenant_id = demo_tenant_id
     limit 1;
    select tenant.id
      into other_tenant_id
      from public.tenants tenant
     where tenant.id <> demo_tenant_id
     limit 1;
    begin
      insert into public.jobs (tenant_id, job_group_id, seniority_id, code)
      values (demo_tenant_id, demo_group_id, demo_seniority_id, 'NEGATIVE-DUPLICATE');
      insert into public.job_revisions (
        tenant_id, job_id, name, valid_from
      ) values (
        demo_tenant_id,
        (select id from public.jobs where tenant_id = demo_tenant_id and code = 'NEGATIVE-DUPLICATE'),
        duplicate_name,
        current_date
      );
      raise exception 'DUPLICATE_BUSINESS_KEY_ACCEPTED';
    exception when others then
      if sqlerrm <> 'JOB_DUPLICATE_NAME_SENIORITY' then raise; end if;
    end;

    if other_tenant_id is not null and demo_family_id is not null then
      cross_tenant_rejected := false;
      begin
        insert into public.job_groups (
          tenant_id, code, name, job_family_id
        ) values (
          other_tenant_id,
          'NEGATIVE-CROSS-TENANT',
          'Cross tenant rejection test',
          demo_family_id
        );
      exception when foreign_key_violation then
        cross_tenant_rejected := true;
      end;
      if not cross_tenant_rejected then raise exception 'CROSS_TENANT_FAMILY_REFERENCE_ACCEPTED'; end if;
    end if;
  end if;
end;
$$;

select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('job_families', 'talent_seniorities')
order by tablename, policyname;
