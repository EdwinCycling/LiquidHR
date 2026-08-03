begin;

-- Tenant-owned Talent Foundation. Existing jobs and job_groups remain the
-- canonical catalog; these tables add the Talent vocabulary around them.
create table public.talent_level_models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  locked_at timestamptz,
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table public.talent_levels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  level_model_id uuid not null,
  code text not null,
  name text not null,
  description text,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, level_model_id, code),
  foreign key (tenant_id, level_model_id)
    references public.talent_level_models(tenant_id, id) on delete cascade
);

create table public.talent_seniorities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 1 check (sort_order > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table public.job_families (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

alter table public.job_groups add column if not exists job_family_id uuid;
alter table public.jobs add column if not exists seniority_id uuid;

alter table public.job_groups
  add constraint job_groups_job_family_tenant_fkey
  foreign key (tenant_id, job_family_id)
  references public.job_families(tenant_id, id) on delete set null;

alter table public.jobs
  add constraint jobs_seniority_tenant_fkey
  foreign key (tenant_id, seniority_id)
  references public.talent_seniorities(tenant_id, id) on delete set null;

create table public.talent_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table public.talent_capabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid,
  capability_type text not null check (capability_type in ('COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE')),
  code text not null,
  name text not null,
  normalized_name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, capability_type, normalized_name),
  unique (tenant_id, code),
  foreign key (tenant_id, category_id)
    references public.talent_categories(tenant_id, id) on delete set null
);

create table public.talent_capability_level_content (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  capability_id uuid not null,
  talent_level_id uuid not null,
  indicator_text text not null,
  examples text,
  coaching_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, capability_id, talent_level_id),
  foreign key (tenant_id, capability_id)
    references public.talent_capabilities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, talent_level_id)
    references public.talent_levels(tenant_id, id) on delete cascade
);

create table public.job_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, job_id),
  foreign key (tenant_id, job_id)
    references public.jobs(tenant_id, id) on delete cascade
);

create table public.job_profile_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_profile_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'INACTIVE')),
  valid_from date,
  valid_until date,
  purpose text,
  summary text,
  organizational_context text,
  tasks jsonb not null default '[]'::jsonb,
  responsibilities jsonb not null default '[]'::jsonb,
  result_areas jsonb not null default '[]'::jsonb,
  created_by_user_id uuid,
  activated_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, id),
  unique (tenant_id, job_profile_id, version_number),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  foreign key (tenant_id, job_profile_id)
    references public.job_profiles(tenant_id, id) on delete cascade
);

create table public.job_profile_capability_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_version_id uuid not null,
  capability_id uuid not null,
  requirement_type text not null default 'REQUIRED' check (requirement_type in ('REQUIRED', 'PREFERRED')),
  target_level_id uuid,
  language_level text,
  certificate_details jsonb,
  rationale text,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, profile_version_id, capability_id),
  foreign key (tenant_id, profile_version_id)
    references public.job_profile_versions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, capability_id)
    references public.talent_capabilities(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_level_id)
    references public.talent_levels(tenant_id, id) on delete restrict
);

create index talent_levels_tenant_model_order_idx
  on public.talent_levels (tenant_id, level_model_id, sort_order);
create index talent_capabilities_tenant_type_idx
  on public.talent_capabilities (tenant_id, capability_type, status);
create index job_profile_versions_tenant_status_idx
  on public.job_profile_versions (tenant_id, status, valid_from);
create index job_profile_requirements_tenant_version_idx
  on public.job_profile_capability_requirements (tenant_id, profile_version_id, sort_order);

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
  and profile_version.status = 'ACTIVE';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'talent_level_models', 'talent_levels', 'talent_seniorities',
    'job_families', 'talent_categories', 'talent_capabilities',
    'talent_capability_level_content', 'job_profiles',
    'job_profile_versions', 'job_profile_capability_requirements'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_talent_read', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_talent_write', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:read'')) or (select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage'')))',
      table_name || '_talent_read', table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage''))) with check ((select internal_security.current_user_has_permission(tenant_id, null, ''talent:manage'')))',
      table_name || '_talent_write', table_name
    );
  end loop;
end;
$$;

alter view public.talent_job_profile_readmodel set (security_invoker = true);
grant select on public.talent_job_profile_readmodel to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'talent_level_models', 'talent_levels', 'talent_seniorities',
    'job_families', 'talent_categories', 'talent_capabilities',
    'talent_capability_level_content', 'job_profiles',
    'job_profile_versions', 'job_profile_capability_requirements'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function internal_security.set_updated_at()', table_name || '_updated_at', table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function internal_security.audit_hr_change(%L)', table_name || '_audit', table_name, table_name);
  end loop;
end;
$$;

insert into public.permissions (code, name, description, category)
values
  ('talent:read', 'Talentcatalogus lezen', 'Leest tenant-brede talentstamdata en functieprofielen.', 'Talent'),
  ('talent:manage', 'Talentcatalogus beheren', 'Beheert tenant-brede talentstamdata en functieprofielen.', 'Talent'),
  ('talent:manager-read', 'Talentprofielen van teams lezen', 'Leest functieprofielen binnen de managementscope.', 'Talent'),
  ('self:talent:read', 'Eigen talentprofiel lezen', 'Leest het eigen functieprofiel en de eigen talentcontext.', 'Talent')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.tenant_id is null
  and ((role.code = 'TENANT_ADMIN' and permission.code in ('talent:read', 'talent:manage', 'talent:manager-read'))
    or (role.code = 'DIRECT_MANAGER' and permission.code in ('talent:read', 'talent:manager-read'))
    or (role.code = 'EMPLOYEE' and permission.code = 'self:talent:read'))
on conflict do nothing;

alter table public.tenant_modules drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules add constraint tenant_modules_module_code_check
  check (module_code = any (array['HERA', 'DOCUMENTS', 'REMINDERS', 'TALENT']::text[]));

insert into public.tenant_modules (tenant_id, module_code, is_enabled, enabled_at)
select tenant.id, 'TALENT', true, timezone('utc', now())
from public.tenants tenant
on conflict (tenant_id, module_code) do update
set is_enabled = true, enabled_at = coalesce(public.tenant_modules.enabled_at, excluded.enabled_at), disabled_at = null, disabled_by = null;

-- Seed a usable default level model and seniority catalog for every demo tenant.
with inserted_models as (
  insert into public.talent_level_models (tenant_id, code, name, description)
  select tenant.id, 'DEFAULT', 'Standaard functieniveaus', 'Demo-niveaumodel voor de tenant-brede functieprofielen.'
  from public.tenants tenant
  on conflict (tenant_id, code) do update set name = excluded.name
  returning id, tenant_id
)
insert into public.talent_levels (tenant_id, level_model_id, code, name, description, sort_order)
select inserted_models.tenant_id, inserted_models.id, levels.code, levels.name, levels.description, levels.sort_order
from inserted_models
cross join (values
  ('L1', 'Basis', 'Startniveau met begeleide uitvoering.', 1),
  ('L2', 'Zelfstandig', 'Zelfstandige uitvoering binnen afgesproken kaders.', 2),
  ('L3', 'Gevorderd', 'Complexe uitvoering en kennisdeling.', 3),
  ('L4', 'Strategisch', 'Richtinggevend op organisatie- en vakgebiedniveau.', 4)
) as levels(code, name, description, sort_order)
on conflict (tenant_id, level_model_id, code) do update
set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

insert into public.talent_seniorities (tenant_id, code, name, description, sort_order)
select tenant.id, seniority.code, seniority.name, seniority.description, seniority.sort_order
from public.tenants tenant
cross join (values
  ('JUNIOR', 'Junior', 'Vroege loopbaanfase.', 1),
  ('MEDIOR', 'Medior', 'Zelfstandige vakvolwassen fase.', 2),
  ('SENIOR', 'Senior', 'Ervaren en richtinggevende fase.', 3)
) as seniority(code, name, description, sort_order)
on conflict (tenant_id, code) do update
set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

commit;
