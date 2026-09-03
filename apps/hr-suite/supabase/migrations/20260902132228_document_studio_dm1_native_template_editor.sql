begin;

create type public.document_studio_template_kind as enum ('DOCUMENT', 'COVER', 'APPENDIX');
create type public.document_studio_language as enum ('NL', 'EN');
create type public.document_studio_template_lifecycle as enum ('ACTIVE', 'ARCHIVED');
create type public.document_studio_template_version_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type public.document_studio_retention_kind as enum ('PERMANENT', 'YEARS');
create type public.document_studio_category as enum (
  'EMPLOYMENT',
  'COMPENSATION',
  'ABSENCE_LEAVE',
  'PERFORMANCE_DEVELOPMENT',
  'ONBOARDING',
  'OFFBOARDING',
  'POLICY_COMPLIANCE',
  'GENERAL'
);
create type public.document_studio_asset_status as enum ('PENDING', 'APPROVED', 'RETIRED');

insert into public.permissions (code, name, category, description)
values
  ('document-template:read', 'Document templates lezen', 'Document Studio', 'Document Studio templates binnen de actieve HR-groep lezen.'),
  ('document-template:write', 'Document templates beheren', 'Document Studio', 'Document Studio drafts en templategegevens beheren.'),
  ('document-template:activate', 'Document templates activeren', 'Document Studio', 'Een gevalideerde templateversie immutable activeren.'),
  ('document-template:archive', 'Document templates archiveren', 'Document Studio', 'Een Document Studio template archiveren.'),
  ('document-type:read', 'Documenttypen lezen', 'Document Studio', 'Documenttypen binnen de actieve HR-groep lezen.'),
  ('document-type:write', 'Documenttypen beheren', 'Document Studio', 'Documenttypen binnen de actieve HR-groep beheren.'),
  ('document-profile:read', 'Document Profiles lezen', 'Document Studio', 'Document Profiles binnen de actieve HR-groep lezen.'),
  ('document-profile:write', 'Document Profiles beheren', 'Document Studio', 'Document Profiles binnen de actieve HR-groep beheren.'),
  ('document-asset:read', 'Document assets lezen', 'Document Studio', 'Structurele Document Studio-assets lezen.'),
  ('document-asset:write', 'Document assets beheren', 'Document Studio', 'Structurele Document Studio-assets uploaden en beheren.')
on conflict (code) do update
set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code = 'TENANT_ADMIN'
  and permission.code in (
    'document-template:read',
    'document-template:write',
    'document-template:activate',
    'document-template:archive',
    'document-type:read',
    'document-type:write',
    'document-profile:read',
    'document-profile:write',
    'document-asset:read',
    'document-asset:write'
  )
on conflict do nothing;

create table public.document_studio_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  status public.document_studio_asset_status not null default 'PENDING',
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 180),
  normalized_mime text not null check (normalized_mime in ('image/png', 'image/jpeg')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 2097152),
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  pixel_count bigint not null check (pixel_count between 1 and 16000000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text not null check (storage_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/normalized\.(png|jpg)$'),
  uploaded_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  retired_at timestamptz,
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, sha256),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  check ((status in ('PENDING', 'APPROVED') and retired_at is null) or (status = 'RETIRED' and retired_at is not null))
);

create table public.document_studio_document_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  code text not null check (code ~ '^[a-z][a-z0-9_-]{0,79}$'),
  name jsonb not null check (
    jsonb_typeof(name) = 'object'
    and nullif(btrim(name ->> 'nl'), '') is not null
    and nullif(btrim(name ->> 'en'), '') is not null
  ),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  retention_kind public.document_studio_retention_kind not null,
  retention_years integer check (
    (retention_kind = 'PERMANENT' and retention_years is null)
    or (retention_kind = 'YEARS' and retention_years between 1 and 100)
  ),
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, code),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.document_studio_document_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  source_administration_id uuid not null,
  logo_asset_id uuid,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, name),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, source_administration_id)
    references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, logo_asset_id)
    references public.document_studio_assets(tenant_id, hr_group_id, id) on delete restrict
);

create unique index document_studio_profiles_one_default_idx
  on public.document_studio_document_profiles (tenant_id, hr_group_id)
  where is_default and is_active;

create table public.document_studio_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_key text not null check (template_key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  kind public.document_studio_template_kind not null,
  language public.document_studio_language not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  lifecycle public.document_studio_template_lifecycle not null default 'ACTIVE',
  current_active_version_id uuid,
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, template_key),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create table public.document_studio_template_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_id uuid not null,
  status public.document_studio_template_version_status not null default 'DRAFT',
  version_number integer,
  revision integer not null default 1 check (revision > 0),
  schema_id text not null default 'liquid-hr.document-studio.native.v1',
  schema_version integer not null default 1 check (schema_version = 1),
  document_json jsonb not null check (
    jsonb_typeof(document_json) = 'object'
    and document_json -> 'schema' ->> 'id' = 'liquid-hr.document-studio.native.v1'
    and (document_json -> 'schema' ->> 'version')::integer = 1
  ),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  validation_state text not null default 'INVALID' check (validation_state in ('VALID', 'INVALID')),
  validation_diagnostics jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_diagnostics) = 'array'),
  document_type_id uuid not null,
  category_code public.document_studio_category not null,
  default_dossier boolean not null default false,
  document_profile_id uuid,
  created_by_user_id uuid not null references auth.users(id),
  updated_by_user_id uuid not null references auth.users(id),
  activated_by_user_id uuid references auth.users(id),
  archived_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  archived_at timestamptz,
  unique (tenant_id, hr_group_id, id),
  foreign key (tenant_id, hr_group_id, template_id)
    references public.document_studio_templates(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, document_type_id)
    references public.document_studio_document_types(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, document_profile_id)
    references public.document_studio_document_profiles(tenant_id, hr_group_id, id) on delete restrict,
  check (
    (status = 'DRAFT' and version_number is null and activated_at is null and archived_at is null)
    or (status = 'ACTIVE' and version_number is not null and version_number > 0 and activated_at is not null and archived_at is null)
    or (status = 'ARCHIVED' and version_number is not null and version_number > 0 and activated_at is not null and archived_at is not null)
  )
);

create unique index document_studio_versions_one_draft_idx
  on public.document_studio_template_versions (tenant_id, hr_group_id, template_id)
  where status = 'DRAFT';

create unique index document_studio_versions_one_active_idx
  on public.document_studio_template_versions (tenant_id, hr_group_id, template_id)
  where status = 'ACTIVE';

create unique index document_studio_versions_number_idx
  on public.document_studio_template_versions (tenant_id, hr_group_id, template_id, version_number)
  where version_number is not null;

alter table public.document_studio_templates
  add constraint document_studio_current_active_version_fk
  foreign key (tenant_id, hr_group_id, current_active_version_id)
  references public.document_studio_template_versions(tenant_id, hr_group_id, id);

create table public.document_studio_template_compositions (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  document_template_version_id uuid not null,
  component_kind public.document_studio_template_kind not null,
  component_template_version_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  primary key (tenant_id, hr_group_id, document_template_version_id, component_kind, component_template_version_id),
  unique (tenant_id, hr_group_id, document_template_version_id, component_kind, sort_order),
  foreign key (tenant_id, hr_group_id, document_template_version_id)
    references public.document_studio_template_versions(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, component_template_version_id)
    references public.document_studio_template_versions(tenant_id, hr_group_id, id) on delete restrict,
  check (component_kind in ('COVER', 'APPENDIX'))
);

create unique index document_studio_compositions_one_cover_idx
  on public.document_studio_template_compositions (tenant_id, hr_group_id, document_template_version_id)
  where component_kind = 'COVER';

create table public.document_studio_template_tags (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_id uuid not null,
  tag_id uuid not null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, hr_group_id, template_id, tag_id),
  foreign key (tenant_id, hr_group_id, template_id)
    references public.document_studio_templates(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, tag_id)
    references public.star_performer_tags(tenant_id, id) on delete restrict
);

create table public.document_studio_template_version_assets (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_version_id uuid not null,
  asset_id uuid not null,
  primary key (tenant_id, hr_group_id, template_version_id, asset_id),
  foreign key (tenant_id, hr_group_id, template_version_id)
    references public.document_studio_template_versions(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, asset_id)
    references public.document_studio_assets(tenant_id, hr_group_id, id) on delete restrict
);

create table public.document_studio_operation_idempotency (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  operation text not null check (operation in ('CREATE', 'SAVE', 'ACTIVATE', 'ARCHIVE', 'DISCARD', 'ASSET')),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32,64}$'),
  result jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, hr_group_id, actor_user_id, operation, idempotency_key),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade
);

create index document_studio_templates_scope_idx
  on public.document_studio_templates (tenant_id, hr_group_id, lifecycle, updated_at desc);
create index document_studio_versions_template_idx
  on public.document_studio_template_versions (tenant_id, hr_group_id, template_id, status, updated_at desc);
create index document_studio_compositions_parent_idx
  on public.document_studio_template_compositions (tenant_id, hr_group_id, document_template_version_id, sort_order);
create index document_studio_assets_scope_idx
  on public.document_studio_assets (tenant_id, hr_group_id, status, created_at desc);

create trigger set_document_studio_document_types_updated_at
before update on public.document_studio_document_types
for each row execute function internal_security.set_updated_at();

create trigger set_document_studio_document_profiles_updated_at
before update on public.document_studio_document_profiles
for each row execute function internal_security.set_updated_at();

create trigger set_document_studio_templates_updated_at
before update on public.document_studio_templates
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.document_studio_guard_template()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' then
    if old.tenant_id is distinct from new.tenant_id
      or old.hr_group_id is distinct from new.hr_group_id
      or old.template_key is distinct from new.template_key
      or old.kind is distinct from new.kind
      or old.language is distinct from new.language
      or old.created_by_user_id is distinct from new.created_by_user_id
      or old.created_at is distinct from new.created_at then
      raise exception 'DOCUMENT_TEMPLATE_IDENTITY_IMMUTABLE' using errcode = '55000';
    end if;
    if (old.lifecycle is distinct from new.lifecycle or old.current_active_version_id is distinct from new.current_active_version_id)
      and coalesce(current_setting('document_studio.lifecycle_rpc', true), '') <> '1' then
      raise exception 'DOCUMENT_TEMPLATE_LIFECYCLE_RPC_REQUIRED' using errcode = '42501';
    end if;
    if old.lifecycle = 'ARCHIVED' and new.lifecycle <> 'ARCHIVED' then
      raise exception 'DOCUMENT_TEMPLATE_ARCHIVED_TERMINAL' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_studio_guard_template_trigger
before update on public.document_studio_templates
for each row execute function internal_security.document_studio_guard_template();

create or replace function internal_security.document_studio_guard_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and (
    old.id is distinct from new.id
    or old.tenant_id is distinct from new.tenant_id
    or old.hr_group_id is distinct from new.hr_group_id
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'DOCUMENT_STUDIO_CONFIG_IDENTITY_IMMUTABLE' using errcode = '55000';
  end if;
  if new.logo_asset_id is not null and not exists (
    select 1
    from public.document_studio_assets asset
    where asset.tenant_id = new.tenant_id
      and asset.hr_group_id = new.hr_group_id
      and asset.id = new.logo_asset_id
      and asset.status = 'APPROVED'
  ) then
    raise exception 'DOCUMENT_ASSET_NOT_APPROVED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function internal_security.document_studio_guard_document_type()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and (
    old.id is distinct from new.id
    or old.tenant_id is distinct from new.tenant_id
    or old.hr_group_id is distinct from new.hr_group_id
    or old.created_by_user_id is distinct from new.created_by_user_id
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'DOCUMENT_STUDIO_CONFIG_IDENTITY_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger document_studio_guard_document_type_trigger
before update on public.document_studio_document_types
for each row execute function internal_security.document_studio_guard_document_type();

create trigger document_studio_guard_profile_trigger
before insert or update on public.document_studio_document_profiles
for each row execute function internal_security.document_studio_guard_profile();

create trigger set_document_studio_template_versions_updated_at
before update on public.document_studio_template_versions
for each row execute function internal_security.set_updated_at();

create or replace function internal_security.document_studio_guard_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  template_kind text;
begin
  if tg_op = 'UPDATE' and old.status <> 'DRAFT' then
    if not (old.status = 'ACTIVE' and new.status = 'ARCHIVED'
      and old.id = new.id
      and old.tenant_id = new.tenant_id
      and old.hr_group_id = new.hr_group_id
      and old.template_id = new.template_id
      and old.version_number = new.version_number
      and old.revision = new.revision
      and old.schema_id = new.schema_id
      and old.schema_version = new.schema_version
      and old.document_json = new.document_json
      and old.content_hash = new.content_hash
      and old.validation_state = new.validation_state
      and old.validation_diagnostics = new.validation_diagnostics
      and old.document_type_id = new.document_type_id
      and old.category_code = new.category_code
      and old.default_dossier = new.default_dossier
      and old.document_profile_id is not distinct from new.document_profile_id
      and old.created_by_user_id = new.created_by_user_id
      and old.created_at = new.created_at
      and old.activated_by_user_id is not distinct from new.activated_by_user_id
      and old.activated_at is not distinct from new.activated_at
      and old.updated_by_user_id = new.updated_by_user_id
      and new.archived_at is not null
      and new.archived_by_user_id is not null) then
      raise exception 'DOCUMENT_TEMPLATE_VERSION_IMMUTABLE' using errcode = '55000';
    end if;
  end if;

  select kind::text into template_kind
  from public.document_studio_templates
  where tenant_id = new.tenant_id and hr_group_id = new.hr_group_id and id = new.template_id;

  if template_kind is null or new.document_json ->> 'kind' <> template_kind then
    raise exception 'DOCUMENT_TEMPLATE_KIND_MISMATCH' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger document_studio_guard_version_trigger
before insert or update on public.document_studio_template_versions
for each row execute function internal_security.document_studio_guard_version();

create or replace function internal_security.document_studio_guard_composition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  parent_kind text;
  component_kind text;
  component_status text;
begin
  select template.kind::text into parent_kind
  from public.document_studio_template_versions version
  join public.document_studio_templates template
    on template.tenant_id = version.tenant_id
   and template.hr_group_id = version.hr_group_id
   and template.id = version.template_id
  where version.tenant_id = new.tenant_id
    and version.hr_group_id = new.hr_group_id
    and version.id = new.document_template_version_id;

  select template.kind::text, version.status::text
    into component_kind, component_status
  from public.document_studio_template_versions version
  join public.document_studio_templates template
    on template.tenant_id = version.tenant_id
   and template.hr_group_id = version.hr_group_id
   and template.id = version.template_id
  where version.tenant_id = new.tenant_id
    and version.hr_group_id = new.hr_group_id
    and version.id = new.component_template_version_id;

  if parent_kind <> 'DOCUMENT' or component_kind <> new.component_kind::text or component_status <> 'ACTIVE' then
    raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger document_studio_guard_composition_trigger
before insert or update on public.document_studio_template_compositions
for each row execute function internal_security.document_studio_guard_composition();

create or replace function internal_security.document_studio_write_idempotency(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_operation text,
  requested_key uuid,
  requested_hash text,
  requested_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  previous public.document_studio_operation_idempotency%rowtype;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  select *
    into previous
  from public.document_studio_operation_idempotency
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and actor_user_id = actor_id
    and operation = requested_operation
    and idempotency_key = requested_key
  for update;

  if found then
    if previous.request_hash <> requested_hash then
      raise exception 'DOCUMENT_STUDIO_IDEMPOTENCY_REUSE' using errcode = '40001';
    end if;
    return jsonb_build_object('existing', true, 'result', previous.result);
  end if;

  insert into public.document_studio_operation_idempotency (
    tenant_id, hr_group_id, actor_user_id, operation, idempotency_key, request_hash, result
  ) values (
    requested_tenant_id, requested_hr_group_id, actor_id, requested_operation, requested_key, requested_hash, requested_result
  );
  return jsonb_build_object('existing', false, 'result', requested_result);
end;
$$;

create or replace function internal_security.document_studio_replay_idempotency(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_operation text,
  requested_key uuid,
  requested_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  previous_request_hash text;
  previous_result jsonb;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select request_hash, result
    into previous_request_hash, previous_result
  from public.document_studio_operation_idempotency
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_hr_group_id
    and actor_user_id = actor_id
    and operation = requested_operation
    and idempotency_key = requested_key
  for update;
  if not found then return null; end if;
  if previous_request_hash <> requested_hash then
    raise exception 'DOCUMENT_STUDIO_IDEMPOTENCY_REUSE' using errcode = '40001';
  end if;
  return previous_result;
end;
$$;

create or replace function internal_security.document_studio_replay_discard_idempotency(
  requested_draft_id uuid,
  requested_key uuid,
  requested_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  previous_request_hash text;
  previous_result jsonb;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select request_hash, result
    into previous_request_hash, previous_result
  from public.document_studio_operation_idempotency
  where actor_user_id = actor_id
    and operation = 'DISCARD'
    and idempotency_key = requested_key
    and result ->> 'draftId' = requested_draft_id::text
  for update;
  if not found then return null; end if;
  if previous_request_hash <> requested_hash then
    raise exception 'DOCUMENT_STUDIO_IDEMPOTENCY_REUSE' using errcode = '40001';
  end if;
  return previous_result;
end;
$$;

create or replace function internal_security.document_studio_audit(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_entity_name text,
  requested_entity_id uuid,
  requested_action text,
  requested_changes jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if requested_action not in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE') then
    raise exception 'DOCUMENT_STUDIO_AUDIT_ACTION_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(requested_changes, '{}'::jsonb)) <> 'object' then
    raise exception 'DOCUMENT_STUDIO_AUDIT_CHANGES_INVALID' using errcode = '22023';
  end if;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    requested_tenant_id,
    requested_entity_name,
    requested_entity_id,
    auth.uid(),
    requested_action,
    coalesce(requested_changes, '{}'::jsonb) || jsonb_build_object('hrGroupId', requested_hr_group_id)
  );
end;
$$;

create or replace function internal_security.document_studio_audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform internal_security.document_studio_audit(
    new.tenant_id,
    new.hr_group_id,
    tg_table_name,
    new.id,
    case when tg_op = 'INSERT' then 'CREATE' else 'UPDATE' end,
    jsonb_build_object('operation', tg_op)
  );
  return new;
end;
$$;

create trigger document_studio_document_types_audit_trigger
after insert or update on public.document_studio_document_types
for each row execute function internal_security.document_studio_audit_config_change();

create trigger document_studio_document_profiles_audit_trigger
after insert or update on public.document_studio_document_profiles
for each row execute function internal_security.document_studio_audit_config_change();

create or replace function internal_security.document_studio_asset_refs(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_assets jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(requested_assets) <> 'array' then
    raise exception 'DOCUMENT_ASSET_REFS_INVALID' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(requested_assets) loop
    if jsonb_typeof(item) <> 'string' then
      raise exception 'DOCUMENT_ASSET_REF_INVALID' using errcode = '22023';
    end if;
    if (item #>> '{}') !~ '^[0-9a-f-]{36}$' then
      raise exception 'DOCUMENT_ASSET_REF_INVALID' using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.document_studio_assets asset
      where asset.tenant_id = requested_tenant_id
        and asset.hr_group_id = requested_hr_group_id
        and asset.id = (item #>> '{}')::uuid
        and asset.status = 'APPROVED'
    ) then
      raise exception 'DOCUMENT_ASSET_NOT_APPROVED' using errcode = '23514';
    end if;
  end loop;
end;
$$;

create or replace function internal_security.document_studio_json_asset_refs(requested_document jsonb)
returns table(asset_ref text)
language sql
immutable
set search_path = pg_catalog
as $$
  with recursive nodes(value) as (
    select requested_document
    union all
    select child.value
    from nodes
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(nodes.value) = 'array' then nodes.value else '[]'::jsonb end
    ) child(value)
    union all
    select child.value
    from nodes
    cross join lateral jsonb_each(
      case when jsonb_typeof(nodes.value) = 'object' then nodes.value else '{}'::jsonb end
    ) child(key, value)
  )
  select distinct value -> 'attrs' ->> 'assetRef'
  from nodes
  where value ->> 'type' = 'blockImage'
    and value -> 'attrs' ->> 'assetRef' is not null;
$$;

create or replace function internal_security.document_studio_assert_document_assets(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_document jsonb,
  requested_assets jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if exists (
    select 1
    from internal_security.document_studio_json_asset_refs(requested_document) document_asset
    where not exists (
      select 1
      from jsonb_array_elements(requested_assets) requested_asset
      where requested_asset #>> '{}' = document_asset.asset_ref
    )
  ) or exists (
    select 1
    from jsonb_array_elements(requested_assets) requested_asset
    where not exists (
      select 1
      from internal_security.document_studio_json_asset_refs(requested_document) document_asset
      where document_asset.asset_ref = requested_asset #>> '{}'
    )
  ) then
    raise exception 'DOCUMENT_ASSET_REFS_MISMATCH' using errcode = '22023';
  end if;
end;
$$;

create or replace function internal_security.document_studio_assert_object_keys(
  requested_value jsonb,
  requested_required text[],
  requested_allowed text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if jsonb_typeof(requested_value) <> 'object'
    or exists (
      select 1
      from unnest(coalesce(requested_required, array[]::text[])) required_key
      where not requested_value ? required_key
    )
    or exists (
      select 1
      from jsonb_object_keys(requested_value) actual_key
      where not actual_key = any(coalesce(requested_allowed, array[]::text[]))
    ) then
    raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023';
  end if;
end;
$$;

create or replace function internal_security.document_studio_assert_node(
  requested_node jsonb,
  requested_path text,
  requested_depth integer,
  requested_context text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  node_type text;
  child jsonb;
  mark jsonb;
  mark_type text;
  attrs jsonb;
  value_number numeric;
  column_count integer;
  row_count integer;
  row_value jsonb;
  cell_value jsonb;
  column_value jsonb;
  index_value integer := 0;
begin
  if requested_depth > 32 then
    raise exception 'DOCUMENT_DEPTH_LIMIT' using errcode = '22023';
  end if;
  perform internal_security.document_studio_assert_object_keys(requested_node, array['type'], array['type', 'attrs', 'content', 'text', 'marks']);
  node_type := requested_node ->> 'type';

  if requested_context = 'INLINE' then
    if node_type not in ('text', 'knownPlaceholder', 'temporalPlaceholder', 'freePlaceholder') then
      raise exception 'DOCUMENT_INLINE_NODE_UNSUPPORTED' using errcode = '22023';
    end if;
  elsif requested_context = 'LIST_ITEM' then
    if node_type <> 'listItem' then raise exception 'DOCUMENT_LIST_ITEM_INVALID' using errcode = '22023'; end if;
  elsif requested_context = 'TABLE_ROW' then
    if node_type <> 'tableRow' then raise exception 'DOCUMENT_TABLE_ROW_INVALID' using errcode = '22023'; end if;
  elsif requested_context = 'CELL' then
    if node_type <> 'paragraph' then raise exception 'DOCUMENT_TABLE_CELL_CONTENT_INVALID' using errcode = '22023'; end if;
  elsif requested_context = 'PARAGRAPH_ONLY' then
    if node_type <> 'paragraph' then raise exception 'DOCUMENT_TABLE_CELL_CONTENT_INVALID' using errcode = '22023'; end if;
  elsif node_type not in ('paragraph', 'heading', 'bulletList', 'orderedList', 'horizontalRule', 'pageBreak', 'blockImage', 'table', 'twoColumnBlock') then
    raise exception 'DOCUMENT_BLOCK_NODE_UNSUPPORTED' using errcode = '22023';
  end if;

  if node_type = 'text' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'text'], array['type', 'text', 'marks']);
    if jsonb_typeof(requested_node -> 'text') <> 'string' or char_length(requested_node ->> 'text') > 10000 then
      raise exception 'DOCUMENT_TEXT_NODE_TOO_LARGE' using errcode = '22023';
    end if;
    if requested_node ? 'marks' then
      if jsonb_typeof(requested_node -> 'marks') <> 'array' then raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023'; end if;
      for mark in select value from jsonb_array_elements(requested_node -> 'marks') loop
        perform internal_security.document_studio_assert_object_keys(mark, array['type'], array['type', 'attrs']);
        mark_type := mark ->> 'type';
        if mark_type not in ('bold', 'italic', 'underline', 'fontSize') then raise exception 'DOCUMENT_MARK_UNSUPPORTED' using errcode = '22023'; end if;
        if mark_type = 'fontSize' then
          perform internal_security.document_studio_assert_object_keys(mark, array['type', 'attrs'], array['type', 'attrs']);
          attrs := mark -> 'attrs';
          perform internal_security.document_studio_assert_object_keys(attrs, array['size'], array['size']);
          if jsonb_typeof(attrs -> 'size') <> 'number' or (attrs ->> 'size') !~ '^(10|11|12|14|16|18|24|32)$' then
            raise exception 'DOCUMENT_FONT_SIZE_INVALID' using errcode = '22023';
          end if;
        elsif mark ? 'attrs' then
          raise exception 'DOCUMENT_SCHEMA_UNKNOWN_ATTRIBUTE' using errcode = '22023';
        end if;
      end loop;
    end if;
    return;
  end if;

  if node_type = 'knownPlaceholder' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs'], array['type', 'attrs']);
    attrs := requested_node -> 'attrs';
    perform internal_security.document_studio_assert_object_keys(attrs, array['field'], array['field']);
    if attrs ->> 'field' not in ('employee.first_name', 'employee.last_name', 'employee.employee_number', 'employment.start_date') then
      raise exception 'DOCUMENT_KNOWN_FIELD_UNKNOWN' using errcode = '22023';
    end if;
    return;
  end if;

  if node_type = 'temporalPlaceholder' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs'], array['type', 'attrs']);
    attrs := requested_node -> 'attrs';
    perform internal_security.document_studio_assert_object_keys(attrs, array['field', 'temporal'], array['field', 'temporal']);
    if attrs ->> 'field' !~ '^[a-z][a-z0-9]*(?:[._][a-z][a-z0-9]*)*$' or attrs ->> 'temporal' not in ('was', 'is', 'wordt') then
      raise exception 'DOCUMENT_TEMPORAL_FIELD_INVALID' using errcode = '22023';
    end if;
    return;
  end if;

  if node_type = 'freePlaceholder' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs'], array['type', 'attrs']);
    attrs := requested_node -> 'attrs';
    perform internal_security.document_studio_assert_object_keys(attrs, array['key'], array['key']);
    if attrs ->> 'key' !~ '^[A-Z][A-Za-z0-9]{0,79}$' then raise exception 'DOCUMENT_FREE_FIELD_INVALID' using errcode = '22023'; end if;
    return;
  end if;

  if node_type = 'paragraph' or node_type = 'heading' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs', 'content'], array['type', 'attrs', 'content']);
    attrs := requested_node -> 'attrs';
    if node_type = 'paragraph' then
      perform internal_security.document_studio_assert_object_keys(attrs, array['align'], array['align']);
    else
      perform internal_security.document_studio_assert_object_keys(attrs, array['level', 'align'], array['level', 'align']);
      if jsonb_typeof(attrs -> 'level') <> 'number' or (attrs ->> 'level') !~ '^[123]$' then raise exception 'DOCUMENT_HEADING_LEVEL_INVALID' using errcode = '22023'; end if;
    end if;
    if attrs ->> 'align' not in ('LEFT', 'CENTER', 'RIGHT', 'JUSTIFY') or jsonb_typeof(requested_node -> 'content') <> 'array' then
      raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023';
    end if;
    for child in select value from jsonb_array_elements(requested_node -> 'content') loop
      perform internal_security.document_studio_assert_node(child, requested_path || '.content', requested_depth + 1, 'INLINE');
    end loop;
    return;
  end if;

  if node_type = 'bulletList' or node_type = 'orderedList' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'content'], array['type', 'content']);
    if jsonb_typeof(requested_node -> 'content') <> 'array' then raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023'; end if;
    for child in select value from jsonb_array_elements(requested_node -> 'content') loop
      perform internal_security.document_studio_assert_node(child, requested_path || '.content', requested_depth + 1, 'LIST_ITEM');
    end loop;
    return;
  end if;

  if node_type = 'listItem' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'content'], array['type', 'content']);
    if jsonb_typeof(requested_node -> 'content') <> 'array' then raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023'; end if;
    for child in select value from jsonb_array_elements(requested_node -> 'content') loop
      perform internal_security.document_studio_assert_node(child, requested_path || '.content', requested_depth + 1, 'PARAGRAPH_ONLY');
    end loop;
    return;
  end if;

  if node_type = 'horizontalRule' or node_type = 'pageBreak' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type'], array['type']);
    return;
  end if;

  if node_type = 'blockImage' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs'], array['type', 'attrs']);
    attrs := requested_node -> 'attrs';
    perform internal_security.document_studio_assert_object_keys(attrs, array['assetRef', 'altText', 'width', 'align'], array['assetRef', 'altText', 'width', 'align']);
    if attrs ->> 'assetRef' !~ '^[0-9a-f-]{36}$' or char_length(attrs ->> 'altText') not between 1 and 240
      or (attrs ->> 'width') !~ '^(25|50|75|100)$' or attrs ->> 'align' not in ('LEFT', 'CENTER', 'RIGHT') then
      raise exception 'DOCUMENT_IMAGE_INVALID' using errcode = '22023';
    end if;
    return;
  end if;

  if node_type = 'table' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs', 'content'], array['type', 'attrs', 'content']);
    attrs := requested_node -> 'attrs';
    perform internal_security.document_studio_assert_object_keys(attrs, array[]::text[], array['columnWidths']);
    if attrs ? 'columnWidths' then
      if jsonb_typeof(attrs -> 'columnWidths') <> 'array' then raise exception 'DOCUMENT_TABLE_WIDTH_INVALID' using errcode = '22023'; end if;
      for child in select value from jsonb_array_elements(attrs -> 'columnWidths') loop
        if jsonb_typeof(child) <> 'number' or (child #>> '{}') !~ '^(10|15|20|25|30|35|40|45|50|55|60|65|70|75|80|85|90|95|100)$' then raise exception 'DOCUMENT_TABLE_WIDTH_INVALID' using errcode = '22023'; end if;
      end loop;
      if (select coalesce(sum((value #>> '{}')::integer), 0) from jsonb_array_elements(attrs -> 'columnWidths')) <> 100 then raise exception 'DOCUMENT_TABLE_WIDTH_TOTAL_INVALID' using errcode = '22023'; end if;
    end if;
    if jsonb_typeof(requested_node -> 'content') <> 'array' then raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023'; end if;
    select count(*) into row_count from jsonb_array_elements(requested_node -> 'content');
    if row_count < 1 or row_count > 200 then raise exception 'DOCUMENT_TABLE_ROW_LIMIT' using errcode = '22023'; end if;
    column_count := null;
    for row_value in select value from jsonb_array_elements(requested_node -> 'content') loop
      perform internal_security.document_studio_assert_node(row_value, requested_path || '.content', requested_depth + 1, 'TABLE_ROW');
      if column_count is null then select count(*) into column_count from jsonb_array_elements(row_value -> 'content'); end if;
      if column_count < 1 or column_count > 8 then raise exception 'DOCUMENT_TABLE_COLUMN_LIMIT' using errcode = '22023'; end if;
      if (select count(*) from jsonb_array_elements(row_value -> 'content')) <> column_count then raise exception 'DOCUMENT_TABLE_RECTANGULAR_INVALID' using errcode = '22023'; end if;
    end loop;
    if attrs ? 'columnWidths' and jsonb_array_length(attrs -> 'columnWidths') <> column_count then raise exception 'DOCUMENT_TABLE_WIDTH_COUNT_INVALID' using errcode = '22023'; end if;
    return;
  end if;

  if node_type = 'tableRow' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'content'], array['type', 'content']);
    if jsonb_typeof(requested_node -> 'content') <> 'array' then raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023'; end if;
    for cell_value in select value from jsonb_array_elements(requested_node -> 'content') loop
      perform internal_security.document_studio_assert_object_keys(cell_value, array['type', 'attrs', 'content'], array['type', 'attrs', 'content']);
      if cell_value ->> 'type' not in ('tableCell', 'tableHeader') then raise exception 'DOCUMENT_TABLE_CELL_CONTENT_INVALID' using errcode = '22023'; end if;
      attrs := cell_value -> 'attrs';
      perform internal_security.document_studio_assert_object_keys(attrs, array['align'], array['align']);
      if attrs ->> 'align' not in ('LEFT', 'CENTER', 'RIGHT', 'JUSTIFY') or jsonb_typeof(cell_value -> 'content') <> 'array' then raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023'; end if;
      for child in select value from jsonb_array_elements(cell_value -> 'content') loop
        perform internal_security.document_studio_assert_node(child, requested_path || '.content', requested_depth + 1, 'PARAGRAPH_ONLY');
      end loop;
    end loop;
    return;
  end if;

  if node_type = 'twoColumnBlock' then
    perform internal_security.document_studio_assert_object_keys(requested_node, array['type', 'attrs', 'content'], array['type', 'attrs', 'content']);
    attrs := requested_node -> 'attrs';
    perform internal_security.document_studio_assert_object_keys(attrs, array['ratio'], array['ratio']);
    if attrs ->> 'ratio' not in ('25_75', '33_67', '50_50', '67_33', '75_25') or jsonb_typeof(requested_node -> 'content') <> 'array' or jsonb_array_length(requested_node -> 'content') <> 2 then
      raise exception 'DOCUMENT_COLUMN_INVALID' using errcode = '22023';
    end if;
    for column_value in select value from jsonb_array_elements(requested_node -> 'content') loop
      perform internal_security.document_studio_assert_object_keys(column_value, array['type', 'attrs', 'content'], array['type', 'attrs', 'content']);
      if column_value ->> 'type' <> 'column' then raise exception 'DOCUMENT_COLUMN_INVALID' using errcode = '22023'; end if;
      attrs := column_value -> 'attrs';
      perform internal_security.document_studio_assert_object_keys(attrs, array['side'], array['side']);
      if attrs ->> 'side' not in ('left', 'right') or jsonb_typeof(column_value -> 'content') <> 'array' then raise exception 'DOCUMENT_COLUMN_INVALID' using errcode = '22023'; end if;
      for child in select value from jsonb_array_elements(column_value -> 'content') loop
        perform internal_security.document_studio_assert_node(child, requested_path || '.content', requested_depth + 1, 'BLOCKS');
      end loop;
      index_value := index_value + 1;
    end loop;
    if (requested_node -> 'content' -> 0 -> 'attrs' ->> 'side') <> 'left' or (requested_node -> 'content' -> 1 -> 'attrs' ->> 'side') <> 'right' then
      raise exception 'DOCUMENT_COLUMN_ORDER_INVALID' using errcode = '22023';
    end if;
    return;
  end if;

  raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023';
end;
$$;

create or replace function internal_security.document_studio_assert_canonical_document(
  requested_document jsonb,
  requested_kind text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  root_regions jsonb;
  region_name text;
  region_value jsonb;
  block_value jsonb;
  node_count bigint;
  text_count bigint;
begin
  if jsonb_typeof(requested_document) <> 'object' or octet_length(convert_to(requested_document::text, 'UTF8')) > 1048576 then
    raise exception 'DOCUMENT_SCHEMA_INVALID' using errcode = '22023';
  end if;
  perform internal_security.document_studio_assert_object_keys(requested_document, array['schema', 'kind', 'page', 'regions'], array['schema', 'kind', 'page', 'regions']);
  if requested_kind not in ('DOCUMENT', 'COVER', 'APPENDIX') or requested_document ->> 'kind' <> requested_kind then
    raise exception 'DOCUMENT_KIND_MISMATCH' using errcode = '22023';
  end if;
  perform internal_security.document_studio_assert_object_keys(requested_document -> 'schema', array['id', 'version'], array['id', 'version']);
  if requested_document -> 'schema' ->> 'id' <> 'liquid-hr.document-studio.native.v1' or requested_document -> 'schema' ->> 'version' <> '1' then
    raise exception 'DOCUMENT_SCHEMA_VERSION_UNSUPPORTED' using errcode = '22023';
  end if;
  perform internal_security.document_studio_assert_object_keys(requested_document -> 'page', array['size', 'marginPreset', 'fontFamily'], array['size', 'marginPreset', 'fontFamily']);
  if requested_document -> 'page' ->> 'size' <> 'A4' or requested_document -> 'page' ->> 'fontFamily' <> 'WORK_SANS' or requested_document -> 'page' ->> 'marginPreset' not in ('NARROW', 'NORMAL', 'WIDE') then
    raise exception 'DOCUMENT_PAGE_SETTING_UNSUPPORTED' using errcode = '22023';
  end if;
  root_regions := requested_document -> 'regions';
  perform internal_security.document_studio_assert_object_keys(root_regions, array['cover', 'header', 'body', 'appendix', 'footer'], array['cover', 'header', 'body', 'appendix', 'footer']);
  for region_name in select unnest(array['cover', 'header', 'body', 'appendix', 'footer']) loop
    region_value := root_regions -> region_name;
    if jsonb_typeof(region_value) <> 'null' then
      perform internal_security.document_studio_assert_object_keys(region_value, array['type', 'content'], array['type', 'content']);
      if region_value ->> 'type' <> 'region' or jsonb_typeof(region_value -> 'content') <> 'array' then raise exception 'DOCUMENT_REGION_INVALID' using errcode = '22023'; end if;
      for block_value in select value from jsonb_array_elements(region_value -> 'content') loop
        perform internal_security.document_studio_assert_node(block_value, 'regions.' || region_name, 0, 'BLOCKS');
      end loop;
    end if;
  end loop;
  if (requested_kind = 'DOCUMENT' and jsonb_typeof(root_regions -> 'body') <> 'object')
    or (requested_kind = 'COVER' and jsonb_typeof(root_regions -> 'cover') <> 'object')
    or (requested_kind = 'APPENDIX' and jsonb_typeof(root_regions -> 'appendix') <> 'object') then
    raise exception 'DOCUMENT_REQUIRED_REGION_MISSING' using errcode = '22023';
  end if;
  if (requested_kind = 'DOCUMENT' and (jsonb_typeof(root_regions -> 'cover') <> 'null' or jsonb_typeof(root_regions -> 'appendix') <> 'null'))
    or (requested_kind = 'COVER' and (jsonb_typeof(root_regions -> 'header') <> 'null' or jsonb_typeof(root_regions -> 'body') <> 'null' or jsonb_typeof(root_regions -> 'appendix') <> 'null' or jsonb_typeof(root_regions -> 'footer') <> 'null'))
    or (requested_kind = 'APPENDIX' and (jsonb_typeof(root_regions -> 'cover') <> 'null' or jsonb_typeof(root_regions -> 'header') <> 'null' or jsonb_typeof(root_regions -> 'body') <> 'null' or jsonb_typeof(root_regions -> 'footer') <> 'null')) then
    raise exception 'DOCUMENT_REGION_KIND_MISMATCH' using errcode = '22023';
  end if;
  with recursive nodes(value) as (
    select requested_document
    union all
    select child.value from nodes cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.value) = 'array' then nodes.value else '[]'::jsonb end) child(value)
    union all
    select child.value from nodes cross join lateral jsonb_each(case when jsonb_typeof(nodes.value) = 'object' then nodes.value else '{}'::jsonb end) child(key, value)
  )
  select count(*) filter (where value ? 'type'), coalesce(sum(char_length(value ->> 'text')) filter (where value ->> 'type' = 'text'), 0)
    into node_count, text_count
  from nodes;
  if node_count > 10000 then raise exception 'DOCUMENT_NODE_LIMIT' using errcode = '22023'; end if;
  if text_count > 250000 then raise exception 'DOCUMENT_TEXT_LIMIT' using errcode = '22023'; end if;
end;
$$;

create or replace function internal_security.document_studio_assert_composition(
  requested_parent_version_id uuid,
  requested_composition jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  parent_tenant_id uuid;
  parent_group_id uuid;
  parent_kind text;
  item jsonb;
  component_kind text;
  component_version_id uuid;
  component_template_kind text;
  component_status text;
  index_value integer := 0;
  cover_count integer := 0;
begin
  select version.tenant_id, version.hr_group_id, template.kind::text
    into parent_tenant_id, parent_group_id, parent_kind
  from public.document_studio_template_versions version
  join public.document_studio_templates template
    on template.tenant_id = version.tenant_id and template.hr_group_id = version.hr_group_id and template.id = version.template_id
  where version.id = requested_parent_version_id;
  if parent_kind is null then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if jsonb_typeof(requested_composition) <> 'array' or jsonb_array_length(requested_composition) > 201 then raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID' using errcode = '22023'; end if;
  if parent_kind <> 'DOCUMENT' and jsonb_array_length(requested_composition) > 0 then raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID' using errcode = '23514'; end if;
  for item in select value from jsonb_array_elements(requested_composition) loop
    perform internal_security.document_studio_assert_object_keys(item, array['kind', 'versionId', 'sortOrder'], array['kind', 'versionId', 'sortOrder']);
    if item ->> 'kind' not in ('COVER', 'APPENDIX') or item ->> 'versionId' !~ '^[0-9a-f-]{36}$' or item ->> 'sortOrder' !~ '^[0-9]+$' or (item ->> 'sortOrder')::integer <> index_value then
      raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID' using errcode = '23514';
    end if;
    component_kind := item ->> 'kind';
    component_version_id := (item ->> 'versionId')::uuid;
    if component_kind = 'COVER' then cover_count := cover_count + 1; end if;
    select template.kind::text, version.status::text
      into component_template_kind, component_status
    from public.document_studio_template_versions version
    join public.document_studio_templates template
      on template.tenant_id = version.tenant_id and template.hr_group_id = version.hr_group_id and template.id = version.template_id
    where version.tenant_id = parent_tenant_id and version.hr_group_id = parent_group_id and version.id = component_version_id;
    if component_template_kind is null or component_template_kind <> component_kind or component_status <> 'ACTIVE' then
      raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID' using errcode = '23514';
    end if;
    index_value := index_value + 1;
  end loop;
  if cover_count > 1 then raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_COVER_LIMIT' using errcode = '23505'; end if;
end;
$$;

create or replace function internal_security.create_document_studio_template_draft(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_template_key text,
  requested_kind public.document_studio_template_kind,
  requested_language public.document_studio_language,
  requested_name text,
  requested_description text,
  requested_document_type_id uuid,
  requested_category public.document_studio_category,
  requested_default_dossier boolean,
  requested_profile_id uuid,
  requested_document jsonb,
  requested_composition jsonb,
  requested_assets jsonb,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  template_row public.document_studio_templates%rowtype;
  version_row public.document_studio_template_versions%rowtype;
  result jsonb;
  item jsonb;
  sort_index integer := 0;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_hr_group_id, 'document-template:write') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if requested_template_key is null or requested_template_key !~ '^[a-z][a-z0-9_-]{0,79}$' then
    raise exception 'DOCUMENT_TEMPLATE_KEY_INVALID' using errcode = '22023';
  end if;
  perform internal_security.document_studio_assert_canonical_document(requested_document, requested_kind::text);
  perform internal_security.document_studio_asset_refs(requested_tenant_id, requested_hr_group_id, requested_assets);
  perform internal_security.document_studio_assert_document_assets(requested_tenant_id, requested_hr_group_id, requested_document, requested_assets);

  result := pg_catalog.jsonb_build_object('templateId', gen_random_uuid(), 'draftId', gen_random_uuid(), 'revision', 1);
  result := internal_security.document_studio_write_idempotency(
    requested_tenant_id, requested_hr_group_id, 'CREATE', requested_idempotency_key, requested_request_hash, result
  );
  if (result ->> 'existing')::boolean then
    return result -> 'result';
  end if;
  result := result -> 'result';

  insert into public.document_studio_templates (
    id, tenant_id, hr_group_id, template_key, kind, language, name, description,
    lifecycle, created_by_user_id, updated_by_user_id
  )
  values (
    (result ->> 'templateId')::uuid, requested_tenant_id, requested_hr_group_id, requested_template_key,
    requested_kind, requested_language, requested_name, requested_description, 'ACTIVE', actor_id, actor_id
  )
  returning * into template_row;

  insert into public.document_studio_template_versions (
    id, tenant_id, hr_group_id, template_id, status, revision, document_json, content_hash,
    validation_state, validation_diagnostics, document_type_id, category_code, default_dossier,
    document_profile_id, created_by_user_id, updated_by_user_id
  )
  values (
    (result ->> 'draftId')::uuid, requested_tenant_id, requested_hr_group_id, template_row.id, 'DRAFT',
    1, requested_document, repeat('0', 64), 'INVALID', '[]'::jsonb, requested_document_type_id,
    requested_category, requested_default_dossier, requested_profile_id, actor_id, actor_id
  )
  returning * into version_row;

  perform internal_security.document_studio_assert_composition(version_row.id, requested_composition);

  for item in select value from jsonb_array_elements(requested_composition) loop
    insert into public.document_studio_template_compositions (
      tenant_id, hr_group_id, document_template_version_id, component_kind, component_template_version_id, sort_order
    ) values (
      requested_tenant_id, requested_hr_group_id, version_row.id,
      (item ->> 'kind')::public.document_studio_template_kind,
      (item ->> 'versionId')::uuid, sort_index
    );
    sort_index := sort_index + 1;
  end loop;

  for item in select value from jsonb_array_elements(requested_assets) loop
    insert into public.document_studio_template_version_assets (
      tenant_id, hr_group_id, template_version_id, asset_id
    ) values (
      requested_tenant_id, requested_hr_group_id, version_row.id, (item #>> '{}')::uuid
    );
  end loop;

  perform internal_security.document_studio_audit(
    requested_tenant_id,
    requested_hr_group_id,
    'document_studio_templates',
    template_row.id,
    'CREATE',
    jsonb_build_object(
      'draftVersionId', version_row.id,
      'revision', version_row.revision,
      'kind', requested_kind,
      'language', requested_language
    )
  );

  return result;
end;
$$;

create or replace function internal_security.save_document_studio_template_draft(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_name text,
  requested_description text,
  requested_document_type_id uuid,
  requested_category public.document_studio_category,
  requested_default_dossier boolean,
  requested_profile_id uuid,
  requested_document jsonb,
  requested_composition jsonb,
  requested_assets jsonb,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  draft_row public.document_studio_template_versions%rowtype;
  template_row public.document_studio_templates%rowtype;
  result jsonb;
  item jsonb;
  sort_index integer := 0;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  select * into draft_row
  from public.document_studio_template_versions
  where id = requested_draft_id
  for update;

  if not found then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into template_row
  from public.document_studio_templates
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id and id = draft_row.template_id
  for update;
  if not found then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(draft_row.tenant_id, draft_row.hr_group_id, 'document-template:write') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  result := internal_security.document_studio_replay_idempotency(
    draft_row.tenant_id, draft_row.hr_group_id, 'SAVE', requested_idempotency_key, requested_request_hash
  );
  if result is not null then return result; end if;
  if draft_row.status <> 'DRAFT' then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if template_row.lifecycle = 'ARCHIVED' then raise exception 'DOCUMENT_TEMPLATE_ARCHIVED' using errcode = '55000'; end if;
  if draft_row.revision <> requested_expected_revision then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_CONFLICT' using errcode = '40001';
  end if;
  perform internal_security.document_studio_assert_canonical_document(requested_document, template_row.kind::text);
  perform internal_security.document_studio_asset_refs(draft_row.tenant_id, draft_row.hr_group_id, requested_assets);
  perform internal_security.document_studio_assert_document_assets(draft_row.tenant_id, draft_row.hr_group_id, requested_document, requested_assets);
  perform internal_security.document_studio_assert_composition(draft_row.id, requested_composition);

  result := pg_catalog.jsonb_build_object(
    'templateId', draft_row.template_id,
    'draftId', draft_row.id,
    'revision', draft_row.revision + 1
  );
  result := internal_security.document_studio_write_idempotency(
    draft_row.tenant_id, draft_row.hr_group_id, 'SAVE', requested_idempotency_key, requested_request_hash, result
  );
  if (result ->> 'existing')::boolean then
    return result -> 'result';
  end if;
  result := result -> 'result';

  update public.document_studio_template_versions
  set revision = revision + 1,
      document_json = requested_document,
      document_type_id = requested_document_type_id,
      category_code = requested_category,
      default_dossier = requested_default_dossier,
      document_profile_id = requested_profile_id,
      validation_state = 'INVALID',
      validation_diagnostics = '[]'::jsonb,
      updated_by_user_id = actor_id
  where id = draft_row.id;

  update public.document_studio_templates
  set name = requested_name, description = requested_description, updated_by_user_id = actor_id
  where id = draft_row.template_id;

  delete from public.document_studio_template_compositions
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id
    and document_template_version_id = draft_row.id;

  for item in select value from jsonb_array_elements(requested_composition) loop
    insert into public.document_studio_template_compositions (
      tenant_id, hr_group_id, document_template_version_id, component_kind, component_template_version_id, sort_order
    ) values (
      draft_row.tenant_id, draft_row.hr_group_id, draft_row.id,
      (item ->> 'kind')::public.document_studio_template_kind,
      (item ->> 'versionId')::uuid, sort_index
    );
    sort_index := sort_index + 1;
  end loop;

  delete from public.document_studio_template_version_assets
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id
    and template_version_id = draft_row.id;

  for item in select value from jsonb_array_elements(requested_assets) loop
    insert into public.document_studio_template_version_assets (
      tenant_id, hr_group_id, template_version_id, asset_id
    ) values (
      draft_row.tenant_id, draft_row.hr_group_id, draft_row.id, (item #>> '{}')::uuid
    );
  end loop;

  perform internal_security.document_studio_audit(
    draft_row.tenant_id,
    draft_row.hr_group_id,
    'document_studio_template_versions',
    draft_row.id,
    'UPDATE',
    jsonb_build_object(
      'operation', 'SAVE',
      'templateId', draft_row.template_id,
      'revision', result -> 'revision'
    )
  );

  return result;
end;
$$;

create or replace function internal_security.create_document_studio_draft_from_active(
  requested_template_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  template_row public.document_studio_templates%rowtype;
  active_row public.document_studio_template_versions%rowtype;
  draft_id uuid := gen_random_uuid();
  result jsonb;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select * into template_row from public.document_studio_templates where id = requested_template_id for update;
  if not found then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(template_row.tenant_id, template_row.hr_group_id, 'document-template:write') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if template_row.lifecycle = 'ARCHIVED' then raise exception 'DOCUMENT_TEMPLATE_ARCHIVED' using errcode = '55000'; end if;
  select * into active_row
  from public.document_studio_template_versions
  where template_id = template_row.id and status = 'ACTIVE'
  for update;
  if not found then raise exception 'DOCUMENT_TEMPLATE_ACTIVE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from public.document_studio_template_versions where template_id = template_row.id and status = 'DRAFT') then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_ALREADY_EXISTS' using errcode = '23505';
  end if;

  result := jsonb_build_object('templateId', template_row.id, 'draftId', draft_id, 'revision', 1);
  result := internal_security.document_studio_write_idempotency(
    template_row.tenant_id, template_row.hr_group_id, 'CREATE', requested_idempotency_key, requested_request_hash, result
  );
  if (result ->> 'existing')::boolean then return result -> 'result'; end if;
  result := result -> 'result';

  insert into public.document_studio_template_versions (
    id, tenant_id, hr_group_id, template_id, status, revision, document_json, content_hash,
    validation_state, validation_diagnostics, document_type_id, category_code, default_dossier,
    document_profile_id, created_by_user_id, updated_by_user_id
  ) values (
    draft_id, active_row.tenant_id, active_row.hr_group_id, active_row.template_id, 'DRAFT', 1,
    active_row.document_json, active_row.content_hash, active_row.validation_state, active_row.validation_diagnostics,
    active_row.document_type_id, active_row.category_code, active_row.default_dossier,
    active_row.document_profile_id, actor_id, actor_id
  );

  insert into public.document_studio_template_compositions (tenant_id, hr_group_id, document_template_version_id, component_kind, component_template_version_id, sort_order)
  select tenant_id, hr_group_id, draft_id, component_kind, component_template_version_id, sort_order
  from public.document_studio_template_compositions
  where document_template_version_id = active_row.id;

  insert into public.document_studio_template_version_assets (tenant_id, hr_group_id, template_version_id, asset_id)
  select tenant_id, hr_group_id, draft_id, asset_id
  from public.document_studio_template_version_assets
  where template_version_id = active_row.id;

  perform internal_security.document_studio_audit(
    active_row.tenant_id,
    active_row.hr_group_id,
    'document_studio_template_versions',
    draft_id,
    'CREATE',
    jsonb_build_object(
      'operation', 'CLONE_ACTIVE',
      'templateId', active_row.template_id,
      'revision', 1,
      'sourceVersionId', active_row.id
    )
  );

  return result;
end;
$$;

create or replace function internal_security.mark_document_studio_draft_valid(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_hash text,
  requested_diagnostics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  draft_row public.document_studio_template_versions%rowtype;
  stored_assets jsonb;
begin
  select * into draft_row
  from public.document_studio_template_versions
  where id = requested_draft_id
  for update;
  if not found then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(draft_row.tenant_id, draft_row.hr_group_id, 'document-template:write') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if draft_row.revision <> requested_expected_revision then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_CONFLICT' using errcode = '40001';
  end if;
  declare
    template_kind text;
  begin
    select template.kind::text into template_kind
    from public.document_studio_templates template
    where template.tenant_id = draft_row.tenant_id and template.hr_group_id = draft_row.hr_group_id and template.id = draft_row.template_id;
    perform internal_security.document_studio_assert_canonical_document(draft_row.document_json, template_kind);
  end;
  select coalesce(jsonb_agg(asset_id::text order by asset_id), '[]'::jsonb)
    into stored_assets
  from public.document_studio_template_version_assets
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id and template_version_id = draft_row.id;
  perform internal_security.document_studio_assert_document_assets(draft_row.tenant_id, draft_row.hr_group_id, draft_row.document_json, stored_assets);
  update public.document_studio_template_versions
  set content_hash = encode(extensions.digest(convert_to(draft_row.document_json::text, 'UTF8'), 'sha256'), 'hex'),
      validation_state = 'VALID', validation_diagnostics = '[]'::jsonb, updated_by_user_id = actor_id
  where id = draft_row.id;
  perform internal_security.document_studio_audit(
    draft_row.tenant_id,
    draft_row.hr_group_id,
    'document_studio_template_versions',
    draft_row.id,
    'UPDATE',
    jsonb_build_object(
      'operation', 'VALIDATE',
      'revision', draft_row.revision,
      'valid', true,
      'diagnosticsCount', 0
    )
  );
  return jsonb_build_object('draftId', draft_row.id, 'valid', true);
end;
$$;

create or replace function internal_security.activate_document_studio_template_draft(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  draft_row public.document_studio_template_versions%rowtype;
  template_row public.document_studio_templates%rowtype;
  previous_active public.document_studio_template_versions%rowtype;
  next_version integer;
  stored_assets jsonb;
  stored_composition jsonb;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  select * into draft_row
  from public.document_studio_template_versions
  where id = requested_draft_id
  for update;
  if not found then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into template_row
  from public.document_studio_templates
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id and id = draft_row.template_id
  for update;
  if not found then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(draft_row.tenant_id, draft_row.hr_group_id, 'document-template:activate') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  result := internal_security.document_studio_replay_idempotency(
    draft_row.tenant_id, draft_row.hr_group_id, 'ACTIVATE', requested_idempotency_key, requested_request_hash
  );
  if result is not null then return result; end if;
  if draft_row.status <> 'DRAFT' then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if template_row.lifecycle = 'ARCHIVED' then raise exception 'DOCUMENT_TEMPLATE_ARCHIVED' using errcode = '55000'; end if;
  if draft_row.revision <> requested_expected_revision then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_CONFLICT' using errcode = '40001';
  end if;
  perform internal_security.document_studio_assert_canonical_document(draft_row.document_json, template_row.kind::text);
  if draft_row.validation_state <> 'VALID' then
    raise exception 'DOCUMENT_TEMPLATE_VALIDATION_REQUIRED' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.document_studio_document_types document_type
    where document_type.tenant_id = draft_row.tenant_id
      and document_type.hr_group_id = draft_row.hr_group_id
      and document_type.id = draft_row.document_type_id
      and document_type.is_active
  ) then
    raise exception 'DOCUMENT_TYPE_NOT_ACTIVE' using errcode = '23514';
  end if;
  if draft_row.document_profile_id is not null then
    if not exists (
      select 1 from public.document_studio_document_profiles profile
      where profile.tenant_id = draft_row.tenant_id
        and profile.hr_group_id = draft_row.hr_group_id
        and profile.id = draft_row.document_profile_id
        and profile.is_active
    ) then
      raise exception 'DOCUMENT_PROFILE_NOT_ACTIVE' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.document_studio_document_profiles profile
      join public.administrations administration
        on administration.tenant_id = profile.tenant_id
       and administration.hr_group_id = profile.hr_group_id
       and administration.id = profile.source_administration_id
      where profile.tenant_id = draft_row.tenant_id
        and profile.hr_group_id = draft_row.hr_group_id
        and profile.id = draft_row.document_profile_id
        and administration.is_active
    ) then
      raise exception 'DOCUMENT_PROFILE_SOURCE_INVALID' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.document_studio_document_profiles profile
      where profile.tenant_id = draft_row.tenant_id and profile.hr_group_id = draft_row.hr_group_id
        and profile.id = draft_row.document_profile_id and profile.logo_asset_id is not null
        and not exists (
          select 1 from public.document_studio_assets asset
          where asset.tenant_id = profile.tenant_id and asset.hr_group_id = profile.hr_group_id
            and asset.id = profile.logo_asset_id and asset.status = 'APPROVED'
        )
    ) then
      raise exception 'DOCUMENT_ASSET_NOT_APPROVED' using errcode = '23514';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', component_kind,
    'versionId', component_template_version_id,
    'sortOrder', sort_order
  ) order by sort_order), '[]'::jsonb)
    into stored_composition
  from public.document_studio_template_compositions
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id and document_template_version_id = draft_row.id;
  perform internal_security.document_studio_assert_composition(draft_row.id, stored_composition);

  if exists (
    select 1
    from public.document_studio_template_compositions composition
    join public.document_studio_template_versions component
      on component.tenant_id = composition.tenant_id
     and component.hr_group_id = composition.hr_group_id
     and component.id = composition.component_template_version_id
    where composition.tenant_id = draft_row.tenant_id
      and composition.hr_group_id = draft_row.hr_group_id
      and composition.document_template_version_id = draft_row.id
      and component.status <> 'ACTIVE'
  ) then
    raise exception 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.document_studio_template_version_assets reference
    join public.document_studio_assets asset
      on asset.tenant_id = reference.tenant_id
     and asset.hr_group_id = reference.hr_group_id
     and asset.id = reference.asset_id
    where reference.tenant_id = draft_row.tenant_id
      and reference.hr_group_id = draft_row.hr_group_id
      and reference.template_version_id = draft_row.id
      and asset.status <> 'APPROVED'
  ) then
    raise exception 'DOCUMENT_ASSET_NOT_APPROVED' using errcode = '23514';
  end if;

  stored_assets := coalesce(
    (
      select jsonb_agg(asset_id::text order by asset_id)
      from public.document_studio_template_version_assets
      where tenant_id = draft_row.tenant_id
        and hr_group_id = draft_row.hr_group_id
        and template_version_id = draft_row.id
    ),
    '[]'::jsonb
  );
  perform internal_security.document_studio_asset_refs(draft_row.tenant_id, draft_row.hr_group_id, stored_assets);
  perform internal_security.document_studio_assert_document_assets(
    draft_row.tenant_id,
    draft_row.hr_group_id,
    draft_row.document_json,
    stored_assets
  );

  select * into previous_active
  from public.document_studio_template_versions
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id
    and template_id = draft_row.template_id and status = 'ACTIVE'
  for update;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.document_studio_template_versions
  where tenant_id = draft_row.tenant_id and hr_group_id = draft_row.hr_group_id
    and template_id = draft_row.template_id;

  result := jsonb_build_object(
    'templateId', draft_row.template_id,
    'versionId', draft_row.id,
    'versionNumber', next_version,
    'revision', draft_row.revision
  );
  result := internal_security.document_studio_write_idempotency(
    draft_row.tenant_id, draft_row.hr_group_id, 'ACTIVATE', requested_idempotency_key, requested_request_hash, result
  );
  if (result ->> 'existing')::boolean then
    return result -> 'result';
  end if;
  result := result -> 'result';

  if previous_active.id is not null then
    update public.document_studio_template_versions
    set status = 'ARCHIVED', archived_by_user_id = actor_id, archived_at = timezone('utc', now())
    where id = previous_active.id;
    perform internal_security.document_studio_audit(
      previous_active.tenant_id,
      previous_active.hr_group_id,
      'document_studio_template_versions',
      previous_active.id,
      'ARCHIVE',
      jsonb_build_object(
        'operation', 'ACTIVATE_REPLACED',
        'templateId', previous_active.template_id,
        'versionNumber', previous_active.version_number,
        'revision', previous_active.revision
      )
    );
  end if;

  update public.document_studio_template_versions
  set status = 'ACTIVE', version_number = next_version, activated_by_user_id = actor_id,
      activated_at = timezone('utc', now()), updated_by_user_id = actor_id
  where id = draft_row.id;

  perform set_config('document_studio.lifecycle_rpc', '1', true);
  update public.document_studio_templates
  set lifecycle = 'ACTIVE', current_active_version_id = draft_row.id, updated_by_user_id = actor_id
  where id = draft_row.template_id;

  perform internal_security.document_studio_audit(
    draft_row.tenant_id,
    draft_row.hr_group_id,
    'document_studio_template_versions',
    draft_row.id,
    'UPDATE',
    jsonb_build_object(
      'operation', 'ACTIVATE',
      'templateId', draft_row.template_id,
      'versionNumber', next_version,
      'revision', draft_row.revision
    )
  );
  perform internal_security.document_studio_audit(
    draft_row.tenant_id,
    draft_row.hr_group_id,
    'document_studio_templates',
    draft_row.template_id,
    'UPDATE',
    jsonb_build_object(
      'operation', 'ACTIVATE',
      'activeVersionId', draft_row.id,
      'versionNumber', next_version,
      'revision', draft_row.revision
    )
  );

  return result;
end;
$$;

create or replace function internal_security.archive_document_studio_template(
  requested_template_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  template_row public.document_studio_templates%rowtype;
  active_row public.document_studio_template_versions%rowtype;
  result jsonb;
begin
  if actor_id is null then raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into template_row from public.document_studio_templates where id = requested_template_id for update;
  if not found then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(template_row.tenant_id, template_row.hr_group_id, 'document-template:archive') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  result := internal_security.document_studio_replay_idempotency(
    template_row.tenant_id, template_row.hr_group_id, 'ARCHIVE', requested_idempotency_key, requested_request_hash
  );
  if result is not null then return result; end if;
  if template_row.lifecycle = 'ARCHIVED' then raise exception 'DOCUMENT_TEMPLATE_ARCHIVED_TERMINAL' using errcode = '55000'; end if;
  if exists (select 1 from public.document_studio_template_versions where template_id = template_row.id and status = 'DRAFT') then
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_EXISTS' using errcode = '23514';
  end if;
  select * into active_row
  from public.document_studio_template_versions
  where template_id = template_row.id and status = 'ACTIVE'
  for update;
  result := jsonb_build_object('templateId', template_row.id, 'archived', true);
  result := internal_security.document_studio_write_idempotency(
    template_row.tenant_id, template_row.hr_group_id, 'ARCHIVE', requested_idempotency_key, requested_request_hash, result
  );
  if (result ->> 'existing')::boolean then return result -> 'result'; end if;
  result := result -> 'result';

  update public.document_studio_template_versions
  set status = 'ARCHIVED', archived_by_user_id = actor_id, archived_at = timezone('utc', now())
  where template_id = template_row.id and status = 'ACTIVE';

  perform set_config('document_studio.lifecycle_rpc', '1', true);
  update public.document_studio_templates
  set lifecycle = 'ARCHIVED', current_active_version_id = null, updated_by_user_id = actor_id
  where id = template_row.id;

  if active_row.id is not null then
    perform internal_security.document_studio_audit(
      active_row.tenant_id,
      active_row.hr_group_id,
      'document_studio_template_versions',
      active_row.id,
      'ARCHIVE',
      jsonb_build_object(
        'operation', 'ARCHIVE_TEMPLATE',
        'templateId', active_row.template_id,
        'versionNumber', active_row.version_number,
        'revision', active_row.revision
      )
    );
  end if;
  perform internal_security.document_studio_audit(
    template_row.tenant_id,
    template_row.hr_group_id,
    'document_studio_templates',
    template_row.id,
    'ARCHIVE',
    jsonb_build_object(
      'operation', 'ARCHIVE',
      'activeVersionId', active_row.id,
      'versionNumber', active_row.version_number,
      'revision', active_row.revision
    )
  );

  return result;
end;
$$;

create or replace function internal_security.discard_document_studio_template_draft(
  requested_draft_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  draft_row public.document_studio_template_versions%rowtype;
  result jsonb;
begin
  if actor_id is null then raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into draft_row from public.document_studio_template_versions where id = requested_draft_id for update;
  if not found then
    result := internal_security.document_studio_replay_discard_idempotency(requested_draft_id, requested_idempotency_key, requested_request_hash);
    if result is not null then return result; end if;
    raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.current_user_has_hr_group_permission(draft_row.tenant_id, draft_row.hr_group_id, 'document-template:write') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  result := internal_security.document_studio_replay_idempotency(
    draft_row.tenant_id, draft_row.hr_group_id, 'DISCARD', requested_idempotency_key, requested_request_hash
  );
  if result is not null then return result; end if;
  if draft_row.status <> 'DRAFT' then raise exception 'DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND' using errcode = 'P0002'; end if;
  result := jsonb_build_object('templateId', draft_row.template_id, 'draftId', requested_draft_id, 'discarded', true);
  result := internal_security.document_studio_write_idempotency(
    draft_row.tenant_id, draft_row.hr_group_id, 'DISCARD', requested_idempotency_key, requested_request_hash, result
  );
  if (result ->> 'existing')::boolean then return result -> 'result'; end if;
  result := result -> 'result';
  perform internal_security.document_studio_audit(
    draft_row.tenant_id,
    draft_row.hr_group_id,
    'document_studio_template_versions',
    draft_row.id,
    'DELETE',
    jsonb_build_object(
      'operation', 'DISCARD',
      'templateId', draft_row.template_id,
      'revision', draft_row.revision
    )
  );
  delete from public.document_studio_template_versions where id = requested_draft_id;
  return result;
end;
$$;

create or replace function internal_security.create_document_studio_asset_server(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_asset_id uuid,
  requested_filename text,
  requested_mime text,
  requested_byte_size integer,
  requested_width integer,
  requested_height integer,
  requested_pixel_count bigint,
  requested_sha256 text,
  requested_storage_key text,
  requested_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  asset_row public.document_studio_assets%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'DOCUMENT_ASSET_SERVER_ONLY' using errcode = '42501'; end if;
  if requested_actor_user_id is null then raise exception 'DOCUMENT_ASSET_ACTOR_REQUIRED' using errcode = '22023'; end if;
  if requested_storage_key <> requested_tenant_id::text || '/' || requested_hr_group_id::text || '/' || requested_asset_id::text || '/normalized.' || case when requested_mime = 'image/png' then 'png' else 'jpg' end then
    raise exception 'DOCUMENT_ASSET_STORAGE_KEY_INVALID' using errcode = '22023';
  end if;
  insert into public.document_studio_assets (
    id, tenant_id, hr_group_id, status, original_filename, normalized_mime, byte_size,
    width, height, pixel_count, sha256, storage_key, uploaded_by_user_id
  ) values (
    requested_asset_id, requested_tenant_id, requested_hr_group_id, 'PENDING', requested_filename,
    requested_mime, requested_byte_size, requested_width, requested_height, requested_pixel_count,
    requested_sha256, requested_storage_key, requested_actor_user_id
  ) returning * into asset_row;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    asset_row.tenant_id, 'document_studio_assets', asset_row.id, requested_actor_user_id, 'CREATE',
    jsonb_build_object('hrGroupId', asset_row.hr_group_id, 'status', 'PENDING', 'normalizedMime', asset_row.normalized_mime, 'byteSize', asset_row.byte_size, 'width', asset_row.width, 'height', asset_row.height, 'sha256', asset_row.sha256)
  );
  return jsonb_build_object('assetId', asset_row.id, 'storageKey', asset_row.storage_key);
end;
$$;

create or replace function internal_security.finalize_document_studio_asset_server(
  requested_asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  storage_name text;
  actor_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'DOCUMENT_ASSET_SERVER_ONLY' using errcode = '42501'; end if;
  select storage_key, uploaded_by_user_id into storage_name, actor_id
  from public.document_studio_assets
  where id = requested_asset_id and status = 'PENDING'
  for update;
  if storage_name is null then raise exception 'DOCUMENT_ASSET_NOT_FOUND' using errcode = 'P0002'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'document-studio-assets' and name = storage_name) then
    raise exception 'DOCUMENT_ASSET_STORAGE_MISSING' using errcode = '23514';
  end if;
  update public.document_studio_assets
  set status = 'APPROVED'
  where id = requested_asset_id and status = 'PENDING';
  if not found then raise exception 'DOCUMENT_ASSET_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  select tenant_id, 'document_studio_assets', id, actor_id, 'UPDATE', jsonb_build_object('hrGroupId', hr_group_id, 'status', 'APPROVED')
  from public.document_studio_assets where id = requested_asset_id;
end;
$$;

create or replace function internal_security.retire_document_studio_asset_server(
  requested_asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'DOCUMENT_ASSET_SERVER_ONLY' using errcode = '42501'; end if;
  update public.document_studio_assets
  set status = 'RETIRED', retired_at = timezone('utc', now())
  where id = requested_asset_id and status = 'PENDING';
end;
$$;

create or replace function internal_security.retire_document_studio_asset(
  requested_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  asset_row public.document_studio_assets%rowtype;
begin
  select * into asset_row from public.document_studio_assets where id = requested_asset_id for update;
  if not found then raise exception 'DOCUMENT_ASSET_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(asset_row.tenant_id, asset_row.hr_group_id, 'document-asset:write') then
    raise exception 'DOCUMENT_ASSET_FORBIDDEN' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.document_studio_template_version_assets reference
    where reference.tenant_id = asset_row.tenant_id
      and reference.hr_group_id = asset_row.hr_group_id
      and reference.asset_id = asset_row.id
  ) then
    raise exception 'DOCUMENT_ASSET_REFERENCED' using errcode = '40901';
  end if;
  update public.document_studio_assets
  set status = 'RETIRED', retired_at = timezone('utc', now())
  where id = asset_row.id;
  perform internal_security.document_studio_audit(
    asset_row.tenant_id,
    asset_row.hr_group_id,
    'document_studio_assets',
    asset_row.id,
    'ARCHIVE',
    jsonb_build_object('operation', 'RETIRE')
  );
  return jsonb_build_object('assetId', asset_row.id, 'retired', true);
end;
$$;

create or replace function internal_security.replace_document_studio_template_tags(
  requested_template_id uuid,
  requested_tag_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  template_row public.document_studio_templates%rowtype;
  item jsonb;
  tag_id uuid;
begin
  if actor_id is null then raise exception 'DOCUMENT_STUDIO_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into template_row from public.document_studio_templates where id = requested_template_id for update;
  if not found then raise exception 'DOCUMENT_TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(template_row.tenant_id, template_row.hr_group_id, 'document-template:write') then
    raise exception 'DOCUMENT_TEMPLATE_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(requested_tag_ids) <> 'array' or jsonb_array_length(requested_tag_ids) > 50 then
    raise exception 'DOCUMENT_TEMPLATE_TAGS_INVALID' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(requested_tag_ids) loop
    if jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^[0-9a-f-]{36}$' then
      raise exception 'DOCUMENT_TEMPLATE_TAGS_INVALID' using errcode = '22023';
    end if;
    tag_id := (item #>> '{}')::uuid;
    if not exists (select 1 from public.star_performer_tags tag where tag.tenant_id = template_row.tenant_id and tag.id = tag_id and tag.is_active) then
      raise exception 'DOCUMENT_TEMPLATE_TAG_NOT_FOUND' using errcode = 'P0002';
    end if;
  end loop;
  delete from public.document_studio_template_tags where template_id = template_row.id;
  for item in select value from jsonb_array_elements(requested_tag_ids) loop
    insert into public.document_studio_template_tags (tenant_id, hr_group_id, template_id, tag_id, created_by_user_id)
    values (template_row.tenant_id, template_row.hr_group_id, template_row.id, (item #>> '{}')::uuid, actor_id)
    on conflict do nothing;
  end loop;
  perform internal_security.document_studio_audit(
    template_row.tenant_id,
    template_row.hr_group_id,
    'document_studio_templates',
    template_row.id,
    'UPDATE',
    jsonb_build_object('operation', 'REPLACE_TAGS', 'tagIds', requested_tag_ids)
  );
  return jsonb_build_object('templateId', template_row.id, 'tagIds', requested_tag_ids);
end;
$$;

create or replace function public.create_document_studio_template_draft(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_template_key text,
  requested_kind public.document_studio_template_kind,
  requested_language public.document_studio_language,
  requested_name text,
  requested_description text,
  requested_document_type_id uuid,
  requested_category public.document_studio_category,
  requested_default_dossier boolean,
  requested_profile_id uuid,
  requested_document jsonb,
  requested_composition jsonb,
  requested_assets jsonb,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.create_document_studio_template_draft(
    requested_tenant_id, requested_hr_group_id, requested_template_key, requested_kind,
    requested_language, requested_name, requested_description, requested_document_type_id,
    requested_category, requested_default_dossier, requested_profile_id, requested_document,
    requested_composition, requested_assets, requested_idempotency_key, requested_request_hash
  );
$$;

create or replace function public.save_document_studio_template_draft(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_name text,
  requested_description text,
  requested_document_type_id uuid,
  requested_category public.document_studio_category,
  requested_default_dossier boolean,
  requested_profile_id uuid,
  requested_document jsonb,
  requested_composition jsonb,
  requested_assets jsonb,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.save_document_studio_template_draft(
    requested_draft_id, requested_expected_revision, requested_name, requested_description,
    requested_document_type_id, requested_category, requested_default_dossier, requested_profile_id,
    requested_document, requested_composition, requested_assets, requested_idempotency_key, requested_request_hash
  );
$$;

create or replace function public.create_document_studio_draft_from_active(
  requested_template_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.create_document_studio_draft_from_active(requested_template_id, requested_idempotency_key, requested_request_hash);
$$;

create or replace function public.validate_document_studio_template_draft(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_hash text,
  requested_diagnostics jsonb
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.mark_document_studio_draft_valid(requested_draft_id, requested_expected_revision, requested_hash, requested_diagnostics);
$$;

create or replace function public.activate_document_studio_template_draft(
  requested_draft_id uuid,
  requested_expected_revision integer,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.activate_document_studio_template_draft(
    requested_draft_id, requested_expected_revision, requested_idempotency_key, requested_request_hash
  );
$$;

create or replace function public.archive_document_studio_template(
  requested_template_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.archive_document_studio_template(
    requested_template_id, requested_idempotency_key, requested_request_hash
  );
$$;

create or replace function public.discard_document_studio_template_draft(
  requested_draft_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.discard_document_studio_template_draft(
    requested_draft_id, requested_idempotency_key, requested_request_hash
  );
$$;

create or replace function public.create_document_studio_asset_server(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_asset_id uuid,
  requested_filename text,
  requested_mime text,
  requested_byte_size integer,
  requested_width integer,
  requested_height integer,
  requested_pixel_count bigint,
  requested_sha256 text,
  requested_storage_key text,
  requested_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'DOCUMENT_ASSET_SERVER_ONLY' using errcode = '42501'; end if;
  return internal_security.create_document_studio_asset_server(
    requested_tenant_id, requested_hr_group_id, requested_asset_id, requested_filename,
    requested_mime, requested_byte_size, requested_width, requested_height,
    requested_pixel_count, requested_sha256, requested_storage_key, requested_actor_user_id
  );
end;
$$;

create or replace function public.finalize_document_studio_asset_server(requested_asset_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'DOCUMENT_ASSET_SERVER_ONLY' using errcode = '42501'; end if;
  perform internal_security.finalize_document_studio_asset_server(requested_asset_id);
end;
$$;

create or replace function public.retire_document_studio_asset_server(requested_asset_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'DOCUMENT_ASSET_SERVER_ONLY' using errcode = '42501'; end if;
  perform internal_security.retire_document_studio_asset_server(requested_asset_id);
end;
$$;

create or replace function public.retire_document_studio_asset(requested_asset_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.retire_document_studio_asset(requested_asset_id);
$$;

create or replace function public.replace_document_studio_template_tags(requested_template_id uuid, requested_tag_ids jsonb)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.replace_document_studio_template_tags(requested_template_id, requested_tag_ids);
$$;

revoke all on function public.create_document_studio_template_draft(
  uuid, uuid, text, public.document_studio_template_kind, public.document_studio_language, text, text,
  uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text
) from public, anon;
revoke all on function public.save_document_studio_template_draft(
  uuid, integer, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text
) from public, anon;
revoke all on function public.create_document_studio_draft_from_active(uuid, uuid, text) from public, anon;
revoke all on function public.validate_document_studio_template_draft(uuid, integer, text, jsonb) from public, anon;
revoke all on function public.activate_document_studio_template_draft(uuid, integer, uuid, text) from public, anon;
revoke all on function public.archive_document_studio_template(uuid, uuid, text) from public, anon;
revoke all on function public.discard_document_studio_template_draft(uuid, uuid, text) from public, anon;
revoke all on function public.create_document_studio_asset_server(
  uuid, uuid, uuid, text, text, integer, integer, integer, bigint, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.finalize_document_studio_asset_server(uuid) from public, anon, authenticated;
revoke all on function public.retire_document_studio_asset_server(uuid) from public, anon, authenticated;
revoke all on function public.retire_document_studio_asset(uuid) from public, anon;
revoke all on function public.replace_document_studio_template_tags(uuid, jsonb) from public, anon;

revoke all on function internal_security.document_studio_guard_version() from public, anon, authenticated;
revoke all on function internal_security.document_studio_guard_template() from public, anon, authenticated;
revoke all on function internal_security.document_studio_guard_profile() from public, anon, authenticated;
revoke all on function internal_security.document_studio_guard_document_type() from public, anon, authenticated;
revoke all on function internal_security.document_studio_guard_composition() from public, anon, authenticated;
revoke all on function internal_security.document_studio_write_idempotency(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function internal_security.document_studio_replay_idempotency(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.document_studio_replay_discard_idempotency(uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.document_studio_audit(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function internal_security.document_studio_audit_config_change() from public, anon, authenticated;
revoke all on function internal_security.document_studio_asset_refs(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.document_studio_json_asset_refs(jsonb) from public, anon, authenticated;
revoke all on function internal_security.document_studio_assert_document_assets(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function internal_security.document_studio_assert_object_keys(jsonb, text[], text[]) from public, anon, authenticated;
revoke all on function internal_security.document_studio_assert_node(jsonb, text, integer, text) from public, anon, authenticated;
revoke all on function internal_security.document_studio_assert_canonical_document(jsonb, text) from public, anon, authenticated;
revoke all on function internal_security.document_studio_assert_composition(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal_security.create_document_studio_template_draft(uuid, uuid, text, public.document_studio_template_kind, public.document_studio_language, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.save_document_studio_template_draft(uuid, integer, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.create_document_studio_draft_from_active(uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.mark_document_studio_draft_valid(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function internal_security.activate_document_studio_template_draft(uuid, integer, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.archive_document_studio_template(uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.discard_document_studio_template_draft(uuid, uuid, text) from public, anon, authenticated;
revoke all on function internal_security.create_document_studio_asset_server(uuid, uuid, uuid, text, text, integer, integer, integer, bigint, text, text, uuid) from public, anon, authenticated;
revoke all on function internal_security.finalize_document_studio_asset_server(uuid) from public, anon, authenticated;
revoke all on function internal_security.retire_document_studio_asset_server(uuid) from public, anon, authenticated;
revoke all on function internal_security.retire_document_studio_asset(uuid) from public, anon, authenticated;
revoke all on function internal_security.replace_document_studio_template_tags(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_document_studio_template_draft(
  uuid, uuid, text, public.document_studio_template_kind, public.document_studio_language,
  text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text
) to authenticated;
grant execute on function public.save_document_studio_template_draft(
  uuid, integer, text, text, uuid, public.document_studio_category, boolean, uuid, jsonb, jsonb, jsonb, uuid, text
) to authenticated;
grant execute on function public.create_document_studio_draft_from_active(uuid, uuid, text) to authenticated;
grant execute on function public.validate_document_studio_template_draft(uuid, integer, text, jsonb) to authenticated;
grant execute on function public.activate_document_studio_template_draft(uuid, integer, uuid, text) to authenticated;
grant execute on function public.archive_document_studio_template(uuid, uuid, text) to authenticated;
grant execute on function public.discard_document_studio_template_draft(uuid, uuid, text) to authenticated;
grant usage on schema internal_security to service_role;
grant execute on function public.create_document_studio_asset_server(uuid, uuid, uuid, text, text, integer, integer, integer, bigint, text, text, uuid) to service_role;
grant execute on function public.finalize_document_studio_asset_server(uuid) to service_role;
grant execute on function public.retire_document_studio_asset_server(uuid) to service_role;
grant execute on function internal_security.create_document_studio_asset_server(uuid, uuid, uuid, text, text, integer, integer, integer, bigint, text, text, uuid) to service_role;
grant execute on function internal_security.finalize_document_studio_asset_server(uuid) to service_role;
grant execute on function internal_security.retire_document_studio_asset_server(uuid) to service_role;
grant execute on function public.retire_document_studio_asset(uuid) to authenticated;
grant execute on function public.replace_document_studio_template_tags(uuid, jsonb) to authenticated;

alter table public.document_studio_assets enable row level security;
alter table public.document_studio_document_types enable row level security;
alter table public.document_studio_document_profiles enable row level security;
alter table public.document_studio_templates enable row level security;
alter table public.document_studio_template_versions enable row level security;
alter table public.document_studio_template_compositions enable row level security;
alter table public.document_studio_template_tags enable row level security;
alter table public.document_studio_template_version_assets enable row level security;
alter table public.document_studio_operation_idempotency enable row level security;

create policy document_studio_assets_select
on public.document_studio_assets for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-asset:read'))
  and status = 'APPROVED');

create policy document_studio_document_types_select
on public.document_studio_document_types for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-type:read')));

create policy document_studio_document_types_insert
on public.document_studio_document_types for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-type:write'))
  and created_by_user_id = (select auth.uid())
  and updated_by_user_id = (select auth.uid()));

create policy document_studio_document_types_update
on public.document_studio_document_types for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-type:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-type:write'))
  and updated_by_user_id = (select auth.uid()));

create policy document_studio_document_profiles_select
on public.document_studio_document_profiles for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-profile:read')));

create policy document_studio_document_profiles_insert
on public.document_studio_document_profiles for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-profile:write'))
  and created_by_user_id = (select auth.uid())
  and updated_by_user_id = (select auth.uid()));

create policy document_studio_document_profiles_update
on public.document_studio_document_profiles for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-profile:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-profile:write'))
  and updated_by_user_id = (select auth.uid()));

create policy document_studio_templates_select
on public.document_studio_templates for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:read')));

create policy document_studio_templates_update
on public.document_studio_templates for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:write')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:write'))
  and updated_by_user_id = (select auth.uid()));

create policy document_studio_versions_select
on public.document_studio_template_versions for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:read')));

create policy document_studio_compositions_select
on public.document_studio_template_compositions for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:read')));

create policy document_studio_template_tags_select
on public.document_studio_template_tags for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:read')));

create policy document_studio_version_assets_select
on public.document_studio_template_version_assets for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-template:read')));

revoke all on public.document_studio_assets from anon, public;
revoke all on public.document_studio_document_types from anon, public;
revoke all on public.document_studio_document_profiles from anon, public;
revoke all on public.document_studio_templates from anon, public;
revoke all on public.document_studio_template_versions from anon, public;
revoke all on public.document_studio_template_compositions from anon, public;
revoke all on public.document_studio_template_tags from anon, public;
revoke all on public.document_studio_template_version_assets from anon, public;
revoke all on public.document_studio_operation_idempotency from anon, public;
grant select on public.document_studio_assets to authenticated;
grant select, insert, update on public.document_studio_document_types to authenticated;
grant select, insert, update on public.document_studio_document_profiles to authenticated;
grant select on public.document_studio_templates to authenticated;
grant update (name, description, updated_by_user_id) on public.document_studio_templates to authenticated;
grant select on public.document_studio_template_versions to authenticated;
grant select on public.document_studio_template_compositions to authenticated;
grant select on public.document_studio_template_tags to authenticated;
grant select on public.document_studio_template_version_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('document-studio-assets', 'document-studio-assets', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy document_studio_asset_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'document-studio-assets'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/normalized\.(png|jpg)$'
  and exists (
    select 1 from public.document_studio_assets asset
    where asset.storage_key = name
      and asset.status = 'APPROVED'
      and (select internal_security.current_user_has_hr_group_permission(asset.tenant_id, asset.hr_group_id, 'document-asset:write'))
  )
);

create policy document_studio_asset_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'document-studio-assets'
  and exists (
    select 1 from public.document_studio_assets asset
    where asset.storage_key = name
      and asset.status = 'APPROVED'
      and (select internal_security.current_user_has_hr_group_permission(asset.tenant_id, asset.hr_group_id, 'document-asset:read'))
  )
);

create policy document_studio_asset_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'document-studio-assets'
  and exists (
    select 1 from public.document_studio_assets asset
    where asset.storage_key = name
      and asset.status = 'RETIRED'
      and (select internal_security.current_user_has_hr_group_permission(asset.tenant_id, asset.hr_group_id, 'document-asset:write'))
  )
);

commit;
