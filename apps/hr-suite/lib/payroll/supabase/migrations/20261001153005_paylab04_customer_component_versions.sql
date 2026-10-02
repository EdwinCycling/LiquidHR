begin;

create table public.customer_component_versions (
  id uuid primary key default gen_random_uuid(),
  payroll_administration_id uuid not null,
  source_tenant_id uuid not null,
  source_hr_group_id uuid not null,
  source_administration_id uuid not null,
  component_id text not null,
  component_code text not null,
  component_version text not null check (length(trim(component_version)) > 0),
  status text not null default 'DRAFT' check (status = 'DRAFT'),
  ownership text not null check (ownership in ('CUSTOMER_FORK', 'CUSTOMER_CUSTOM')),
  effective_from date not null,
  effective_to date,
  origin_component_id text,
  origin_component_code text,
  origin_component_version text,
  origin_composition_id text,
  origin_package_id text,
  origin_package_version text,
  origin_package_hash text,
  forked_at timestamptz,
  catalog_metadata_json jsonb not null check (jsonb_typeof(catalog_metadata_json) = 'object'),
  definition_json jsonb not null,
  definition_hash text not null check (definition_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null,
  constraint customer_component_versions_administration_scope_fk
    foreign key (payroll_administration_id, source_tenant_id, source_hr_group_id, source_administration_id)
    references public.payroll_administrations (id, source_tenant_id, source_hr_group_id, source_administration_id),
  constraint customer_component_versions_customer_identity
    check (
      component_id = component_code
      and component_code ~ '^CUSTOM_[A-F0-9]{32}$'
    ),
  constraint customer_component_versions_definition_matches_identity
    check (
      jsonb_typeof(definition_json) = 'object'
      and definition_json ? 'effectiveTo'
      and (definition_json ->> 'id') is not distinct from component_id
      and (definition_json ->> 'code') is not distinct from component_code
      and (definition_json ->> 'version') is not distinct from component_version
      and (definition_json ->> 'effectiveFrom') is not distinct from effective_from::text
      and (definition_json ->> 'effectiveTo') is not distinct from case when effective_to is null then null else effective_to::text end
      and (definition_json #>> '{ownership,kind}') is not distinct from ownership
      and (definition_json #>> '{method,kind}' in ('source', 'passThrough', 'expression', 'aggregate')) is true
      and (catalog_metadata_json ->> 'snapshotOnly' = 'true') is true
    ),
  constraint customer_component_versions_provenance_matches_ownership
    check (
      (
        ownership = 'CUSTOMER_FORK'
        and origin_component_id is not null
        and origin_component_code is not null
        and origin_component_version is not null
        and origin_composition_id is not null
        and length(trim(origin_composition_id)) > 0
        and forked_at is not null
        and component_id <> origin_component_id
        and component_code <> origin_component_code
        and (definition_json #>> '{ownership,origin,id}') is not distinct from origin_component_id
        and (definition_json #>> '{ownership,origin,code}') is not distinct from origin_component_code
        and (definition_json #>> '{ownership,origin,version}') is not distinct from origin_component_version
        and (definition_json #>> '{ownership,forkedAt}') is not null
        and (definition_json #>> '{ownership,forkedAt}')::timestamptz = forked_at
        and (catalog_metadata_json #>> '{package,compositionId}') is not distinct from origin_composition_id
        and (catalog_metadata_json #>> '{package,packageId}') is not distinct from origin_package_id
        and (catalog_metadata_json #>> '{package,version}') is not distinct from origin_package_version
        and (catalog_metadata_json #>> '{package,packageHash}') is not distinct from origin_package_hash
      )
      or
      (
        ownership = 'CUSTOMER_CUSTOM'
        and origin_component_id is null
        and origin_component_code is null
        and origin_component_version is null
        and origin_composition_id is null
        and origin_package_id is null
        and origin_package_version is null
        and origin_package_hash is null
        and forked_at is null
        and not ((definition_json -> 'ownership') ? 'origin')
        and not ((definition_json -> 'ownership') ? 'forkedAt')
      )
    ),
  constraint customer_component_versions_origin_package_hash
    check (origin_package_hash is null or origin_package_hash ~ '^[0-9a-f]{64}$'),
  constraint customer_component_versions_date_order
    check (effective_to is null or effective_to >= effective_from),
  constraint customer_component_versions_identity_unique
    unique (source_tenant_id, source_hr_group_id, source_administration_id, component_code, component_version)
);

comment on table public.customer_component_versions is
  'Append-only, scope-bound customer component drafts. Draft definitions are detached snapshots and never enter a rule package automatically.';
comment on column public.customer_component_versions.definition_json is
  'Deep detached PayrollComponentDefinition snapshot. RegisteredRule methods are prohibited.';

create index customer_component_versions_scope_created_idx
  on public.customer_component_versions (source_tenant_id, source_hr_group_id, source_administration_id, created_at desc);

alter table public.customer_component_versions enable row level security;

create policy customer_component_versions_service_select
  on public.customer_component_versions for select to service_role using (true);
create policy customer_component_versions_service_insert
  on public.customer_component_versions for insert to service_role with check (true);

revoke all on table public.customer_component_versions from public, anon, authenticated, service_role;
grant select, insert on table public.customer_component_versions to service_role;

commit;
