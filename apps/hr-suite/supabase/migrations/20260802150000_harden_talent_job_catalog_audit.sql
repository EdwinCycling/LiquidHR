begin;

-- The Talent blueprint treats the tenant-owned function house as Talent data.
-- Existing job catalog tables therefore need the same append-only audit trail as
-- the newer Talent tables. The composite relation table receives a stable
-- derived identifier because it has no standalone primary-key column.
create or replace function internal_security.audit_talent_job_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  after_data jsonb;
  before_data jsonb;
  audit_tenant uuid;
  audit_entity_id uuid;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    after_data := to_jsonb(old);
    before_data := '{}'::jsonb;
    audit_tenant := old.tenant_id;
    audit_action := 'DELETE';
  else
    after_data := to_jsonb(new);
    before_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    audit_tenant := new.tenant_id;
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
  end if;

  audit_entity_id := case
    when tg_table_name = 'job_group_jobs'
      then md5(coalesce(after_data->>'job_group_id', before_data->>'job_group_id', '') || ':' || coalesce(after_data->>'job_id', before_data->>'job_id', ''))::uuid
    else coalesce(nullif(after_data->>'id', '')::uuid, nullif(before_data->>'id', '')::uuid)
  end;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    audit_tenant,
    'talent_' || tg_table_name,
    audit_entity_id,
    auth.uid(),
    audit_action,
    jsonb_build_object('before', before_data, 'after', after_data)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function internal_security.audit_talent_job_catalog_change() from public, anon, authenticated;

drop trigger if exists jobs_talent_audit on public.jobs;
create trigger jobs_talent_audit
after insert or update or delete on public.jobs
for each row execute function internal_security.audit_talent_job_catalog_change();

drop trigger if exists job_groups_talent_audit on public.job_groups;
create trigger job_groups_talent_audit
after insert or update or delete on public.job_groups
for each row execute function internal_security.audit_talent_job_catalog_change();

drop trigger if exists job_revisions_talent_audit on public.job_revisions;
create trigger job_revisions_talent_audit
after insert or update or delete on public.job_revisions
for each row execute function internal_security.audit_talent_job_catalog_change();

drop trigger if exists job_group_jobs_talent_audit on public.job_group_jobs;
create trigger job_group_jobs_talent_audit
after insert or update or delete on public.job_group_jobs
for each row execute function internal_security.audit_talent_job_catalog_change();

commit;
