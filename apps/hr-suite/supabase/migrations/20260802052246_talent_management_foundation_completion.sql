begin;

-- Complete the tenant-owned Talent configuration contracts without creating a
-- second tag catalog. Existing Cloud Tags remain the canonical tag source.
alter table public.talent_categories
  add column if not exists capability_types text[] not null
    default array['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE']::text[];

alter table public.talent_categories
  drop constraint if exists talent_categories_capability_types_check;
alter table public.talent_categories
  add constraint talent_categories_capability_types_check
  check (
    cardinality(capability_types) > 0
    and capability_types <@ array['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE']::text[]
  );

alter table public.talent_capabilities
  add column if not exists language_code text,
  add column if not exists language_cefr text,
  add column if not exists language_is_native boolean not null default false,
  add column if not exists certificate_issuing_body text,
  add column if not exists certificate_validity_months integer,
  add column if not exists certificate_is_permanent boolean not null default false,
  add column if not exists certificate_code text,
  add column if not exists certificate_renewal_required boolean not null default false;

alter table public.talent_capabilities
  drop constraint if exists talent_capabilities_language_cefr_check;
alter table public.talent_capabilities
  add constraint talent_capabilities_language_cefr_check
  check (language_cefr is null or language_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.talent_capabilities
  drop constraint if exists talent_capabilities_certificate_validity_check;
alter table public.talent_capabilities
  add constraint talent_capabilities_certificate_validity_check
  check (certificate_validity_months is null or certificate_validity_months between 1 and 1200);

alter table public.talent_capabilities
  drop constraint if exists talent_capabilities_type_specific_fields_check;
alter table public.talent_capabilities
  add constraint talent_capabilities_type_specific_fields_check
  check (
    (
      capability_type = 'LANGUAGE'
      and certificate_issuing_body is null
      and certificate_validity_months is null
      and certificate_is_permanent = false
      and certificate_code is null
      and certificate_renewal_required = false
    )
    or (
      capability_type = 'CERTIFICATE'
      and language_code is null
      and language_cefr is null
      and language_is_native = false
    )
    or (
      capability_type in ('COMPETENCY', 'SKILL', 'KNOWLEDGE')
      and language_code is null
      and language_cefr is null
      and language_is_native = false
      and certificate_issuing_body is null
      and certificate_validity_months is null
      and certificate_is_permanent = false
      and certificate_code is null
      and certificate_renewal_required = false
    )
  );

create unique index if not exists talent_level_models_tenant_code_normalized_key
  on public.talent_level_models (tenant_id, lower(btrim(code)));
create unique index if not exists talent_levels_tenant_model_code_normalized_key
  on public.talent_levels (tenant_id, level_model_id, lower(btrim(code)));
create unique index if not exists talent_levels_tenant_model_name_normalized_key
  on public.talent_levels (tenant_id, level_model_id, lower(btrim(name)));
create unique index if not exists talent_categories_tenant_name_normalized_key
  on public.talent_categories (tenant_id, lower(btrim(name)));
create unique index if not exists talent_capabilities_tenant_type_name_normalized_key
  on public.talent_capabilities (tenant_id, capability_type, normalized_name);

create table if not exists public.talent_capability_tags (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  capability_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (capability_id, tag_id),
  unique (tenant_id, capability_id, tag_id),
  foreign key (tenant_id, capability_id)
    references public.talent_capabilities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, tag_id)
    references public.star_performer_tags(tenant_id, id) on delete restrict
);

create index if not exists talent_capability_tags_tenant_tag_idx
  on public.talent_capability_tags (tenant_id, tag_id);

create or replace function internal_security.validate_talent_capability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  category_types text[];
begin
  if new.category_id is not null then
    select capability_types into category_types
    from public.talent_categories
    where tenant_id = new.tenant_id and id = new.category_id;
    if category_types is null or not (new.capability_type = any(category_types)) then
      raise exception 'CAPABILITY_CATEGORY_TYPE_MISMATCH' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function internal_security.normalize_talent_capability_name()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.normalized_name := lower(regexp_replace(btrim(new.name), '\\s+', ' ', 'g'));
  return new;
end;
$$;

create or replace function internal_security.validate_talent_capability_level_content()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  capability_kind text;
begin
  select capability_type into capability_kind
  from public.talent_capabilities
  where tenant_id = new.tenant_id and id = new.capability_id;
  if capability_kind is null then
    raise exception 'CAPABILITY_NOT_FOUND' using errcode = 'P0001';
  end if;
  if capability_kind not in ('COMPETENCY', 'SKILL', 'KNOWLEDGE') then
    raise exception 'CAPABILITY_LEVEL_CONTENT_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function internal_security.validate_talent_profile_requirement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  capability_kind text;
  capability_status text;
begin
  select capability_type, status into capability_kind, capability_status
  from public.talent_capabilities
  where tenant_id = new.tenant_id and id = new.capability_id;
  if capability_kind is null then
    raise exception 'CAPABILITY_NOT_FOUND' using errcode = 'P0001';
  end if;
  if capability_status <> 'ACTIVE' then
    raise exception 'CAPABILITY_INACTIVE' using errcode = 'P0001';
  end if;
  if new.target_level_id is not null and capability_kind not in ('COMPETENCY', 'SKILL', 'KNOWLEDGE') then
    raise exception 'CAPABILITY_LEVEL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if new.target_level_id is not null and not exists (
    select 1 from public.talent_levels level
    where level.tenant_id = new.tenant_id and level.id = new.target_level_id
  ) then
    raise exception 'TALENT_LEVEL_NOT_FOUND' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_talent_category_delete_when_used()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.talent_capabilities capability
    where capability.tenant_id = old.tenant_id and capability.category_id = old.id
  ) then
    raise exception 'CATEGORY_IN_USE' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists talent_capability_validate on public.talent_capabilities;
create trigger talent_capability_validate
before insert or update of tenant_id, category_id, capability_type on public.talent_capabilities
for each row execute function internal_security.validate_talent_capability();

drop trigger if exists talent_capability_normalize_name on public.talent_capabilities;
create trigger talent_capability_normalize_name
before insert or update of name, normalized_name on public.talent_capabilities
for each row execute function internal_security.normalize_talent_capability_name();

drop trigger if exists talent_capability_level_content_validate on public.talent_capability_level_content;
create trigger talent_capability_level_content_validate
before insert or update of tenant_id, capability_id, talent_level_id on public.talent_capability_level_content
for each row execute function internal_security.validate_talent_capability_level_content();

drop trigger if exists talent_profile_requirement_validate on public.job_profile_capability_requirements;
create trigger talent_profile_requirement_validate
before insert or update of tenant_id, capability_id, target_level_id on public.job_profile_capability_requirements
for each row execute function internal_security.validate_talent_profile_requirement();

drop trigger if exists talent_category_delete_guard on public.talent_categories;
create trigger talent_category_delete_guard
before delete on public.talent_categories
for each row execute function internal_security.prevent_talent_category_delete_when_used();

create or replace function internal_security.lock_talent_level_model_on_content_use()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.talent_level_models model
  set locked_at = coalesce(model.locked_at, timezone('utc', now()))
  from public.talent_levels level
  where level.tenant_id = new.tenant_id
    and level.id = new.talent_level_id
    and model.tenant_id = level.tenant_id
    and model.id = level.level_model_id
    and model.locked_at is null;
  return new;
end;
$$;

drop trigger if exists talent_level_model_lock_on_capability_level_content on public.talent_capability_level_content;
create trigger talent_level_model_lock_on_capability_level_content
after insert or update of talent_level_id on public.talent_capability_level_content
for each row execute function internal_security.lock_talent_level_model_on_content_use();

alter table public.talent_capability_tags enable row level security;
revoke all on table public.talent_capability_tags from public, anon;
grant select, insert, update, delete on table public.talent_capability_tags to authenticated;

drop policy if exists talent_capability_tags_talent_read on public.talent_capability_tags;
create policy talent_capability_tags_talent_read
on public.talent_capability_tags
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
);

drop policy if exists talent_capability_tags_talent_insert on public.talent_capability_tags;
create policy talent_capability_tags_talent_insert
on public.talent_capability_tags
for insert to authenticated
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage')));

drop policy if exists talent_capability_tags_talent_update on public.talent_capability_tags;
create policy talent_capability_tags_talent_update
on public.talent_capability_tags
for update to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage')))
with check ((select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage')));

drop policy if exists talent_capability_tags_talent_delete on public.talent_capability_tags;
create policy talent_capability_tags_talent_delete
on public.talent_capability_tags
for delete to authenticated
using ((select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage')));

drop policy if exists star_performer_tags_talent_read on public.star_performer_tags;
create policy star_performer_tags_talent_read
on public.star_performer_tags
for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
);

create or replace function internal_security.audit_talent_capability_tag_relation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  old_data jsonb;
  audit_action text;
  audit_tenant uuid;
  audit_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    old_data := '{}'::jsonb;
    audit_action := 'DELETE';
    audit_tenant := old.tenant_id;
    audit_entity_id := md5(old.capability_id::text || ':' || old.tag_id::text)::uuid;
  else
    row_data := to_jsonb(new);
    old_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
    audit_action := case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end;
    audit_tenant := new.tenant_id;
    audit_entity_id := md5(new.capability_id::text || ':' || new.tag_id::text)::uuid;
  end if;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    audit_tenant,
    'talent_capability_tags',
    audit_entity_id,
    auth.uid(),
    audit_action,
    jsonb_build_object('before', old_data, 'after', row_data)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists talent_capability_tags_audit on public.talent_capability_tags;
create trigger talent_capability_tags_audit
after insert or update or delete on public.talent_capability_tags
for each row execute function internal_security.audit_talent_capability_tag_relation();

create or replace view public.talent_job_profile_readmodel
with (security_invoker = true)
as
select
  job_profile.tenant_id,
  job_profile.id as job_profile_id,
  job_profile.job_id,
  job.code as job_code,
  job.is_active as job_is_active,
  job_group.id as job_group_id,
  job_group.code as job_group_code,
  job_group.name as job_group_name,
  job_family.id as job_family_id,
  job_family.code as job_family_code,
  job_family.name as job_family_name,
  seniority.id as seniority_id,
  seniority.code as seniority_code,
  seniority.name as seniority_name,
  profile_version.id as profile_version_id,
  profile_version.version_number,
  profile_version.status,
  profile_version.valid_from,
  profile_version.valid_until,
  profile_version.purpose,
  profile_version.summary,
  profile_version.organizational_context,
  profile_version.tasks,
  profile_version.responsibilities,
  profile_version.result_areas
from public.job_profiles job_profile
join public.jobs job on job.tenant_id = job_profile.tenant_id and job.id = job_profile.job_id
join public.job_groups job_group on job_group.tenant_id = job.tenant_id and job_group.id = job.job_group_id
left join public.job_families job_family on job_family.tenant_id = job_group.tenant_id and job_family.id = job_group.job_family_id
left join public.talent_seniorities seniority on seniority.tenant_id = job.tenant_id and seniority.id = job.seniority_id
left join public.job_profile_versions profile_version
  on profile_version.tenant_id = job_profile.tenant_id
  and profile_version.job_profile_id = job_profile.id
  and profile_version.status = 'ACTIVE'
  and profile_version.valid_from <= current_date
  and (profile_version.valid_until is null or profile_version.valid_until > current_date);

drop policy if exists job_profile_versions_talent_read on public.job_profile_versions;
create policy job_profile_versions_talent_read on public.job_profile_versions for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and status = 'ACTIVE'
    and valid_from <= current_date
    and (valid_until is null or valid_until > current_date)
    and exists (
      select 1
      from public.job_profiles profile
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
      where profile.tenant_id = job_profile_versions.tenant_id
        and profile.id = job_profile_versions.job_profile_id
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

drop policy if exists job_profile_capability_requirements_talent_read on public.job_profile_capability_requirements;
create policy job_profile_capability_requirements_talent_read on public.job_profile_capability_requirements for select to authenticated
using (
  (select internal_security.current_user_has_permission(tenant_id, null, 'talent:read'))
  or (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manage'))
  or (
    (select internal_security.current_user_has_permission(tenant_id, null, 'talent:manager-read'))
    and exists (
      select 1
      from public.job_profile_versions profile_version
      join public.job_profiles profile
        on profile.tenant_id = profile_version.tenant_id and profile.id = profile_version.job_profile_id
      join public.employee_organizations organization
        on organization.tenant_id = profile.tenant_id and organization.job_id = profile.job_id
      where profile_version.tenant_id = job_profile_capability_requirements.tenant_id
        and profile_version.id = job_profile_capability_requirements.profile_version_id
        and profile_version.status = 'ACTIVE'
        and profile_version.valid_from <= current_date
        and (profile_version.valid_until is null or profile_version.valid_until > current_date)
        and organization.direct_manager_id = internal_security.current_employee_id()
        and organization.effective_from <= current_date
        and (organization.effective_to is null or organization.effective_to > current_date)
    )
  )
);

commit;
