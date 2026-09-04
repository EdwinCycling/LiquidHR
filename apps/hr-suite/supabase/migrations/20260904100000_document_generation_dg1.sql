begin;

create type public.document_generation_status as enum ('PREVIEW', 'FINAL');

insert into public.permissions (code, name, category, description)
values ('document-generation:read', 'Gegenereerde documenten lezen', 'Document Studio', 'DG1-generatiehistorie binnen de actieve HR-groep lezen.'),
       ('document-generation:write', 'Documenten genereren', 'Document Studio', 'Een preview maken en een gegenereerd document finaliseren.')
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id from public.management_roles role cross join public.permissions permission
where role.code = 'TENANT_ADMIN' and permission.code in ('document-generation:read', 'document-generation:write') on conflict do nothing;

create table public.document_generation_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null,
  employee_id uuid not null, template_id uuid not null, template_version_id uuid not null,
  template_version integer not null check (template_version > 0), snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  resolved_document_json jsonb not null check (jsonb_typeof(resolved_document_json) = 'object'),
  resolved_document_hash text not null check (resolved_document_hash ~ '^[0-9a-f]{64}$'),
  renderer_version text not null check (char_length(renderer_version) between 1 and 120),
  generated_by_user_id uuid not null references auth.users(id), generated_at timestamptz not null default timezone('utc', now()),
  status public.document_generation_status not null default 'PREVIEW',
  final_pdf_hash text check (final_pdf_hash is null or final_pdf_hash ~ '^[0-9a-f]{64}$'), final_storage_key text,
  finalized_at timestamptz, finalized_by_user_id uuid references auth.users(id),
  tenant_hr_group_employee_fk foreign key (tenant_id, hr_group_id, employee_id) references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  tenant_hr_group_template_fk foreign key (tenant_id, hr_group_id, template_id) references public.document_studio_templates(tenant_id, hr_group_id, id) on delete restrict,
  tenant_hr_group_version_fk foreign key (tenant_id, hr_group_id, template_version_id) references public.document_studio_template_versions(tenant_id, hr_group_id, id) on delete restrict,
  unique (tenant_id, hr_group_id, id)
);

create table public.document_generation_idempotency (
  tenant_id uuid not null, hr_group_id uuid not null, actor_user_id uuid not null references auth.users(id),
  operation text not null check (operation in ('PREVIEW', 'FINALIZE')), idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'), snapshot_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()), primary key (tenant_id, hr_group_id, actor_user_id, operation, idempotency_key)
);

create table public.document_generation_audit (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, snapshot_id uuid not null,
  action text not null check (action in ('PREVIEW_CREATED', 'FINALIZED')), actor_user_id uuid not null references auth.users(id),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'), created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, snapshot_id) references public.document_generation_snapshots(tenant_id, hr_group_id, id) on delete cascade
);

create index document_generation_history_idx on public.document_generation_snapshots (tenant_id, hr_group_id, generated_at desc);
create index document_generation_employee_idx on public.document_generation_snapshots (tenant_id, hr_group_id, employee_id, generated_at desc);

alter table public.document_generation_snapshots enable row level security;
alter table public.document_generation_idempotency enable row level security;
alter table public.document_generation_audit enable row level security;

create policy document_generation_snapshots_scoped on public.document_generation_snapshots for select to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-generation:read')));
create policy document_generation_idempotency_scoped on public.document_generation_idempotency for all to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-generation:write'))) with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-generation:write')));
create policy document_generation_audit_scoped on public.document_generation_audit for select to authenticated using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-generation:read')));
grant select on public.document_generation_snapshots, public.document_generation_audit to authenticated;
grant select on public.document_generation_idempotency to authenticated;
revoke insert, update, delete on public.document_generation_snapshots from authenticated;
revoke insert, update, delete on public.document_generation_audit from authenticated;

create or replace function internal_security.create_document_generation_preview(requested_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare existing_row public.document_generation_idempotency%rowtype; template_row record; version_row record; employee_row record; snapshot_id uuid := (requested_payload ->> 'id')::uuid; tenant_id uuid := (requested_payload ->> 'tenant_id')::uuid; group_id uuid := (requested_payload ->> 'hr_group_id')::uuid; idem uuid := (requested_payload ->> 'idempotency_key')::uuid; request_hash text := requested_payload ->> 'request_hash';
begin
  if not exists (select 1 from public.user_hr_group_access access join public.management_roles role on role.id = access.management_role_id join public.role_permissions role_permission on role_permission.management_role_id = role.id join public.permissions permission on permission.id = role_permission.permission_id join public.hr_groups group_row on group_row.tenant_id = access.tenant_id and group_row.id = access.hr_group_id and group_row.is_active where access.user_id = (requested_payload ->> 'actor_user_id')::uuid and access.tenant_id = tenant_id and access.hr_group_id = group_id and access.is_active and permission.code = 'document-generation:write' and (role.tenant_id is null or role.tenant_id = tenant_id)) then raise exception 'DOCUMENT_GENERATION_FORBIDDEN' using errcode = '42501'; end if;
  select * into existing_row from public.document_generation_idempotency idem_row where idem_row.tenant_id = tenant_id and idem_row.hr_group_id = group_id and idem_row.actor_user_id = (requested_payload ->> 'actor_user_id')::uuid and idem_row.operation = 'PREVIEW' and idem_row.idempotency_key = idem for update;
  if found then if existing_row.request_hash <> request_hash then raise exception 'DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT' using errcode = '40001'; end if; return jsonb_build_object('id', existing_row.snapshot_id, 'status', 'PREVIEW'); end if;
  select * into version_row from public.document_studio_template_versions version_candidate where version_candidate.id = (requested_payload ->> 'template_version_id')::uuid and version_candidate.tenant_id = tenant_id and version_candidate.hr_group_id = group_id;
  if not found or version_row.status <> 'ACTIVE' then raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000'; end if;
  select * into template_row from public.document_studio_templates template_candidate where template_candidate.id = version_row.template_id and template_candidate.tenant_id = tenant_id and template_candidate.hr_group_id = group_id and template_candidate.lifecycle = 'ACTIVE' and template_candidate.current_active_version_id = version_row.id;
  if not found or template_row.kind <> 'DOCUMENT' then raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000'; end if;
  select * into employee_row from public.employees employee_candidate where employee_candidate.id = (requested_payload ->> 'employee_id')::uuid and employee_candidate.tenant_id = tenant_id and employee_candidate.hr_group_id = group_id and employee_candidate.deleted_at is null;
  if not found then raise exception 'DOCUMENT_GENERATION_EMPLOYEE_NOT_FOUND' using errcode = '22023'; end if;
  insert into public.document_generation_snapshots (id, tenant_id, hr_group_id, employee_id, template_id, template_version_id, template_version, snapshot, resolved_document_json, resolved_document_hash, renderer_version, generated_by_user_id)
  values (snapshot_id, tenant_id, group_id, employee_row.id, version_row.template_id, version_row.id, version_row.version_number, requested_payload -> 'snapshot', requested_payload -> 'resolved_document_json', requested_payload ->> 'resolved_document_hash', requested_payload ->> 'renderer_version', (requested_payload ->> 'actor_user_id')::uuid);
  insert into public.document_generation_idempotency values (tenant_id, group_id, (requested_payload ->> 'actor_user_id')::uuid, 'PREVIEW', idem, request_hash, snapshot_id);
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata) values (tenant_id, group_id, snapshot_id, 'PREVIEW_CREATED', (requested_payload ->> 'actor_user_id')::uuid, jsonb_build_object('resolvedDocumentHash', requested_payload ->> 'resolved_document_hash'));
  return jsonb_build_object('id', snapshot_id, 'status', 'PREVIEW');
end; $$;

create or replace function internal_security.finalize_document_generation(requested_snapshot_id uuid, requested_actor_user_id uuid, requested_idempotency_key uuid, requested_request_hash text, requested_pdf_hash text, requested_storage_key text, requested_renderer_version text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare snapshot_row public.document_generation_snapshots%rowtype; existing_row public.document_generation_idempotency%rowtype;
begin
  select * into snapshot_row from public.document_generation_snapshots where id = requested_snapshot_id for update;
  if not found or not exists (select 1 from public.user_hr_group_access access join public.management_roles role on role.id = access.management_role_id join public.role_permissions role_permission on role_permission.management_role_id = role.id join public.permissions permission on permission.id = role_permission.permission_id where access.user_id = requested_actor_user_id and access.tenant_id = snapshot_row.tenant_id and access.hr_group_id = snapshot_row.hr_group_id and access.is_active and permission.code = 'document-generation:write' and (role.tenant_id is null or role.tenant_id = snapshot_row.tenant_id)) then raise exception 'DOCUMENT_GENERATION_NOT_FOUND' using errcode = '42501'; end if;
  select * into existing_row from public.document_generation_idempotency where tenant_id = snapshot_row.tenant_id and hr_group_id = snapshot_row.hr_group_id and actor_user_id = requested_actor_user_id and operation = 'FINALIZE' and idempotency_key = requested_idempotency_key for update;
  if found then if existing_row.request_hash <> requested_request_hash then raise exception 'DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT' using errcode = '40001'; end if; return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', snapshot_row.final_pdf_hash); end if;
  if snapshot_row.status = 'FINAL' then return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', snapshot_row.final_pdf_hash); end if;
  if snapshot_row.status <> 'PREVIEW' or snapshot_row.renderer_version <> requested_renderer_version then raise exception 'DOCUMENT_GENERATION_STATE_INVALID' using errcode = '55000'; end if;
  update public.document_generation_snapshots set status = 'FINAL', final_pdf_hash = requested_pdf_hash, final_storage_key = requested_storage_key, finalized_at = timezone('utc', now()), finalized_by_user_id = auth.uid() where id = requested_snapshot_id;
  insert into public.document_generation_idempotency values (snapshot_row.tenant_id, snapshot_row.hr_group_id, requested_actor_user_id, 'FINALIZE', requested_idempotency_key, requested_request_hash, requested_snapshot_id);
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata) values (snapshot_row.tenant_id, snapshot_row.hr_group_id, requested_snapshot_id, 'FINALIZED', requested_actor_user_id, jsonb_build_object('finalPdfHash', requested_pdf_hash, 'rendererVersion', requested_renderer_version));
  return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', requested_pdf_hash);
end; $$;

create or replace function public.create_document_generation_preview(requested_payload jsonb) returns jsonb language sql security definer set search_path = pg_catalog, public as $$ select internal_security.create_document_generation_preview(requested_payload); $$;
create or replace function public.finalize_document_generation(requested_snapshot_id uuid, requested_actor_user_id uuid, requested_idempotency_key uuid, requested_request_hash text, requested_pdf_hash text, requested_storage_key text, requested_renderer_version text) returns jsonb language sql security definer set search_path = pg_catalog, public as $$ select internal_security.finalize_document_generation(requested_snapshot_id, requested_actor_user_id, requested_idempotency_key, requested_request_hash, requested_pdf_hash, requested_storage_key, requested_renderer_version); $$;
revoke all on function public.create_document_generation_preview(jsonb) from public, anon, authenticated;
revoke all on function public.finalize_document_generation(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_document_generation_preview(jsonb) to service_role;
grant execute on function public.finalize_document_generation(uuid, uuid, uuid, text, text, text, text) to service_role;
revoke all on function internal_security.create_document_generation_preview(jsonb) from public, anon, authenticated;
revoke all on function internal_security.finalize_document_generation(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- DG1 hardening ----------------------------------------------------------
-- These columns keep the historical values needed by generation history and
-- the dossier bridge independent from later template or employee edits.
alter table public.document_generation_snapshots
  add column template_name text not null check (char_length(btrim(template_name)) between 1 and 160),
  add column employee_name text not null,
  add column employee_number text,
  add column document_category text not null check (document_category ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  add column default_dossier boolean not null default false,
  add column source_administration_id uuid,
  add column final_pdf_size bigint check (final_pdf_size is null or final_pdf_size between 1 and 26214400),
  add constraint document_generation_source_administration_fk
    foreign key (tenant_id, hr_group_id, source_administration_id)
    references public.administrations(tenant_id, hr_group_id, id) on delete restrict;

alter table public.document_generation_idempotency
  add constraint document_generation_idempotency_snapshot_fk
    foreign key (tenant_id, hr_group_id, snapshot_id)
    references public.document_generation_snapshots(tenant_id, hr_group_id, id) on delete cascade;

alter table public.document_generation_audit
  drop constraint if exists document_generation_audit_action_check,
  add constraint document_generation_audit_action_check
    check (action in ('PREVIEW_CREATED', 'FINALIZED', 'DOSSIER_LINKED'));

create index document_generation_idempotency_snapshot_idx
  on public.document_generation_idempotency (tenant_id, hr_group_id, snapshot_id);

create table public.document_generation_dossier_links (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  snapshot_id uuid not null,
  administration_id uuid not null,
  employee_document_id uuid not null,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, hr_group_id, snapshot_id),
  unique (tenant_id, hr_group_id, employee_document_id),
  foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, snapshot_id)
    references public.document_generation_snapshots(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, administration_id, employee_document_id)
    references public.employee_documents(tenant_id, administration_id, id) on delete restrict
);

create index document_generation_dossier_links_employee_idx
  on public.document_generation_dossier_links (tenant_id, hr_group_id, employee_document_id);

-- Keep the existing dossier categories usable for every supported Document
-- Studio category without inventing a second document classification system.
insert into public.document_categories (tenant_id, administration_id, code, name, description, requires_salary_permission)
select administration.tenant_id, administration.id, category.code, category.name, category.description, category.requires_salary_permission
from public.administrations administration
cross join (values
  ('EMPLOYMENT', 'Dienstverband', 'Gegenereerde documenten over het dienstverband.', false),
  ('COMPENSATION', 'Beloning', 'Gegenereerde documenten over beloning.', true),
  ('ABSENCE_LEAVE', 'Afwezigheid en verlof', 'Gegenereerde documenten over afwezigheid en verlof.', false),
  ('PERFORMANCE_DEVELOPMENT', 'Prestaties en ontwikkeling', 'Gegenereerde documenten over prestaties en ontwikkeling.', false),
  ('ONBOARDING', 'Onboarding', 'Gegenereerde onboardingdocumenten.', false),
  ('OFFBOARDING', 'Offboarding', 'Gegenereerde offboardingdocumenten.', false),
  ('POLICY_COMPLIANCE', 'Beleid en compliance', 'Gegenereerde beleids- en compliancedocumenten.', false),
  ('GENERAL', 'Algemeen', 'Algemene gegenereerde medewerkersdocumenten.', false)
) as category(code, name, description, requires_salary_permission)
where administration.is_active
on conflict (tenant_id, administration_id, code) do nothing;

alter table public.document_generation_dossier_links enable row level security;
create policy document_generation_dossier_links_scoped
  on public.document_generation_dossier_links for select to authenticated
  using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-generation:read')));
revoke all on public.document_generation_dossier_links from public, anon, authenticated;
grant select on public.document_generation_dossier_links to authenticated;

-- Only the trusted finalization function may cross the PREVIEW -> FINAL
-- boundary. A FINAL row cannot be edited or reverted, even by a future
-- application path that accidentally obtains table write privileges.
create or replace function internal_security.guard_document_generation_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'FINAL' then
    raise exception 'DOCUMENT_GENERATION_FINAL_IMMUTABLE' using errcode = '55000';
  end if;
  if old.status <> 'PREVIEW' or new.status <> 'FINAL' then
    raise exception 'DOCUMENT_GENERATION_STATE_INVALID' using errcode = '55000';
  end if;
  if old.id <> new.id
    or old.tenant_id <> new.tenant_id
    or old.hr_group_id <> new.hr_group_id
    or old.employee_id <> new.employee_id
    or old.template_id <> new.template_id
    or old.template_version_id <> new.template_version_id
    or old.template_version <> new.template_version
    or old.snapshot <> new.snapshot
    or old.resolved_document_json <> new.resolved_document_json
    or old.resolved_document_hash <> new.resolved_document_hash
    or old.renderer_version <> new.renderer_version
    or old.generated_by_user_id <> new.generated_by_user_id
    or old.generated_at <> new.generated_at
    or old.template_name <> new.template_name
    or old.employee_name <> new.employee_name
    or old.employee_number is distinct from new.employee_number
    or old.document_category <> new.document_category
    or old.default_dossier <> new.default_dossier
    or old.source_administration_id is distinct from new.source_administration_id then
    raise exception 'DOCUMENT_GENERATION_SNAPSHOT_IMMUTABLE' using errcode = '55000';
  end if;
  if new.final_pdf_hash is null
    or new.final_storage_key is null
    or new.final_pdf_size is null
    or new.finalized_at is null
    or new.finalized_by_user_id is null then
    raise exception 'DOCUMENT_GENERATION_FINAL_ARTIFACT_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_document_generation_snapshot
before update on public.document_generation_snapshots
for each row execute function internal_security.guard_document_generation_snapshot();
revoke all on function internal_security.guard_document_generation_snapshot() from public, anon, authenticated;

-- Replace the initial seven-argument finalize definition with the artifact
-- size-aware contract used by the server-only renderer.
drop function if exists public.finalize_document_generation(uuid, uuid, uuid, text, text, text, text);
drop function if exists internal_security.finalize_document_generation(uuid, uuid, uuid, text, text, text, text);

create or replace function internal_security.create_document_generation_preview(requested_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := nullif(requested_payload ->> 'actor_user_id', '')::uuid;
  requested_tenant_id uuid := nullif(requested_payload ->> 'tenant_id', '')::uuid;
  requested_group_id uuid := nullif(requested_payload ->> 'hr_group_id', '')::uuid;
  requested_snapshot_id uuid := nullif(requested_payload ->> 'id', '')::uuid;
  requested_employee_id uuid := nullif(requested_payload ->> 'employee_id', '')::uuid;
  requested_template_id uuid := nullif(requested_payload ->> 'template_id', '')::uuid;
  requested_version_id uuid := nullif(requested_payload ->> 'template_version_id', '')::uuid;
  requested_idempotency_key uuid := nullif(requested_payload ->> 'idempotency_key', '')::uuid;
  requested_hash text := requested_payload ->> 'request_hash';
  existing_idempotency public.document_generation_idempotency%rowtype;
  template_row public.document_studio_templates%rowtype;
  version_row public.document_studio_template_versions%rowtype;
  employee_row public.employees%rowtype;
  source_administration_id uuid;
begin
  if requested_payload is null or jsonb_typeof(requested_payload) <> 'object'
    or actor_id is null or requested_tenant_id is null or requested_group_id is null
    or requested_snapshot_id is null or requested_employee_id is null
    or requested_template_id is null or requested_version_id is null
    or requested_idempotency_key is null or requested_hash is null
    or requested_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(requested_payload -> 'snapshot') <> 'object'
    or jsonb_typeof(requested_payload -> 'resolved_document_json') <> 'object'
    or requested_payload ->> 'resolved_document_hash' !~ '^[0-9a-f]{64}$'
    or nullif(requested_payload ->> 'renderer_version', '') is null then
    raise exception 'DOCUMENT_GENERATION_INPUT_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws(':', requested_tenant_id::text, requested_group_id::text, actor_id::text, 'PREVIEW', requested_idempotency_key::text), 0
  ));

  if not exists (
    select 1
    from public.user_hr_group_access access
    join public.management_roles role on role.id = access.management_role_id
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    join public.hr_groups group_row on group_row.tenant_id = access.tenant_id and group_row.id = access.hr_group_id and group_row.is_active
    where access.user_id = actor_id
      and access.tenant_id = requested_tenant_id
      and access.hr_group_id = requested_group_id
      and access.is_active
      and permission.code = 'document-generation:write'
      and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
  ) then
    raise exception 'DOCUMENT_GENERATION_FORBIDDEN' using errcode = '42501';
  end if;

  select * into existing_idempotency
  from public.document_generation_idempotency
  where tenant_id = requested_tenant_id
    and hr_group_id = requested_group_id
    and actor_user_id = actor_id
    and operation = 'PREVIEW'
    and idempotency_key = requested_idempotency_key
  for update;
  if found then
    if existing_idempotency.request_hash <> requested_hash then
      raise exception 'DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT' using errcode = '40001';
    end if;
    return jsonb_build_object('id', existing_idempotency.snapshot_id, 'status', 'PREVIEW');
  end if;

  select * into version_row
  from public.document_studio_template_versions version_candidate
  where version_candidate.tenant_id = requested_tenant_id
    and version_candidate.hr_group_id = requested_group_id
    and version_candidate.id = requested_version_id;
  if not found or version_row.status <> 'ACTIVE' or version_row.version_number is null
    or requested_payload ->> 'template_version' <> version_row.version_number::text then
    raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000';
  end if;

  select * into template_row
  from public.document_studio_templates template_candidate
  where template_candidate.tenant_id = requested_tenant_id
    and template_candidate.hr_group_id = requested_group_id
    and template_candidate.id = version_row.template_id
    and template_candidate.lifecycle = 'ACTIVE'
    and template_candidate.current_active_version_id = version_row.id;
  if not found or template_row.kind <> 'DOCUMENT' or requested_template_id <> template_row.id then
    raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000';
  end if;

  select * into employee_row
  from public.employees employee_candidate
  where employee_candidate.tenant_id = requested_tenant_id
    and employee_candidate.hr_group_id = requested_group_id
    and employee_candidate.id = requested_employee_id
    and employee_candidate.deleted_at is null
    and not employee_candidate.is_archived;
  if not found then
    raise exception 'DOCUMENT_GENERATION_EMPLOYEE_NOT_FOUND' using errcode = '22023';
  end if;

  if requested_payload ->> 'employee_id' <> employee_row.id::text
    or requested_payload ->> 'template_id' <> version_row.template_id::text then
    raise exception 'DOCUMENT_GENERATION_SCOPE_INVALID' using errcode = '42501';
  end if;

  source_administration_id := nullif(requested_payload #>> '{snapshot,documentProfile,sourceAdministrationId}', '');
  if source_administration_id is not null and not exists (
    select 1 from public.administrations administration
    where administration.tenant_id = requested_tenant_id
      and administration.hr_group_id = requested_group_id
      and administration.id = source_administration_id
      and administration.is_active
  ) then
    raise exception 'DOCUMENT_GENERATION_PROFILE_SOURCE_INVALID' using errcode = '23514';
  end if;

  insert into public.document_generation_snapshots (
    id, tenant_id, hr_group_id, employee_id, template_id, template_version_id, template_version,
    snapshot, resolved_document_json, resolved_document_hash, renderer_version, generated_by_user_id,
    template_name, employee_name, employee_number, document_category, default_dossier, source_administration_id
  ) values (
    requested_snapshot_id, requested_tenant_id, requested_group_id, employee_row.id, version_row.template_id, version_row.id, version_row.version_number,
    requested_payload -> 'snapshot', requested_payload -> 'resolved_document_json', requested_payload ->> 'resolved_document_hash', requested_payload ->> 'renderer_version', actor_id,
    template_row.name, concat_ws(' ', nullif(btrim(employee_row.first_name), ''), nullif(btrim(employee_row.birth_name), '')), employee_row.employee_number,
    version_row.category_code::text, version_row.default_dossier, source_administration_id
  );
  insert into public.document_generation_idempotency (
    tenant_id, hr_group_id, actor_user_id, operation, idempotency_key, request_hash, snapshot_id
  ) values (requested_tenant_id, requested_group_id, actor_id, 'PREVIEW', requested_idempotency_key, requested_hash, requested_snapshot_id);
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata)
  values (requested_tenant_id, requested_group_id, requested_snapshot_id, 'PREVIEW_CREATED', actor_id, jsonb_build_object('resolvedDocumentHash', requested_payload ->> 'resolved_document_hash'));
  return jsonb_build_object('id', requested_snapshot_id, 'status', 'PREVIEW');
end;
$$;

create or replace function internal_security.finalize_document_generation(
  requested_snapshot_id uuid,
  requested_actor_user_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text,
  requested_pdf_hash text,
  requested_storage_key text,
  requested_file_size bigint,
  requested_renderer_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  snapshot_row public.document_generation_snapshots%rowtype;
  existing_idempotency public.document_generation_idempotency%rowtype;
  expected_storage_key text;
begin
  select * into snapshot_row
  from public.document_generation_snapshots
  where id = requested_snapshot_id
  for update;
  if not found or requested_actor_user_id is null or not exists (
    select 1
    from public.user_hr_group_access access
    join public.management_roles role on role.id = access.management_role_id
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    join public.hr_groups group_row on group_row.tenant_id = access.tenant_id and group_row.id = access.hr_group_id and group_row.is_active
    where access.user_id = requested_actor_user_id
      and access.tenant_id = snapshot_row.tenant_id
      and access.hr_group_id = snapshot_row.hr_group_id
      and access.is_active
      and permission.code = 'document-generation:write'
      and (role.tenant_id is null or role.tenant_id = snapshot_row.tenant_id)
  ) then
    raise exception 'DOCUMENT_GENERATION_NOT_FOUND' using errcode = '42501';
  end if;
  if requested_request_hash is null or requested_request_hash !~ '^[0-9a-f]{64}$'
    or requested_pdf_hash is null or requested_pdf_hash !~ '^[0-9a-f]{64}$'
    or requested_file_size is null or requested_file_size not between 1 and 26214400
    or requested_storage_key is null or requested_renderer_version is null then
    raise exception 'DOCUMENT_GENERATION_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into existing_idempotency
  from public.document_generation_idempotency
  where tenant_id = snapshot_row.tenant_id
    and hr_group_id = snapshot_row.hr_group_id
    and actor_user_id = requested_actor_user_id
    and operation = 'FINALIZE'
    and idempotency_key = requested_idempotency_key
  for update;
  if found then
    if existing_idempotency.request_hash <> requested_request_hash or existing_idempotency.snapshot_id <> requested_snapshot_id then
      raise exception 'DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT' using errcode = '40001';
    end if;
    return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', snapshot_row.final_pdf_hash);
  end if;

  expected_storage_key := snapshot_row.tenant_id::text || '/' || snapshot_row.hr_group_id::text || '/' || snapshot_row.employee_id::text || '/generated/' || snapshot_row.id::text || '.pdf';
  if snapshot_row.status = 'FINAL' then
    if snapshot_row.final_pdf_hash is distinct from requested_pdf_hash
      or snapshot_row.final_storage_key is distinct from requested_storage_key
      or snapshot_row.final_pdf_size is distinct from requested_file_size
      or snapshot_row.renderer_version is distinct from requested_renderer_version then
      raise exception 'DOCUMENT_GENERATION_FINAL_IMMUTABLE' using errcode = '55000';
    end if;
    insert into public.document_generation_idempotency (
      tenant_id, hr_group_id, actor_user_id, operation, idempotency_key, request_hash, snapshot_id
    ) values (snapshot_row.tenant_id, snapshot_row.hr_group_id, requested_actor_user_id, 'FINALIZE', requested_idempotency_key, requested_request_hash, requested_snapshot_id);
    return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', snapshot_row.final_pdf_hash);
  end if;
  if snapshot_row.status <> 'PREVIEW'
    or snapshot_row.renderer_version <> requested_renderer_version
    or requested_storage_key <> expected_storage_key then
    raise exception 'DOCUMENT_GENERATION_STATE_INVALID' using errcode = '55000';
  end if;

  update public.document_generation_snapshots
  set status = 'FINAL',
      final_pdf_hash = requested_pdf_hash,
      final_storage_key = requested_storage_key,
      final_pdf_size = requested_file_size,
      finalized_at = timezone('utc', now()),
      finalized_by_user_id = requested_actor_user_id
  where id = requested_snapshot_id;
  insert into public.document_generation_idempotency (
    tenant_id, hr_group_id, actor_user_id, operation, idempotency_key, request_hash, snapshot_id
  ) values (snapshot_row.tenant_id, snapshot_row.hr_group_id, requested_actor_user_id, 'FINALIZE', requested_idempotency_key, requested_request_hash, requested_snapshot_id);
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata)
  values (snapshot_row.tenant_id, snapshot_row.hr_group_id, requested_snapshot_id, 'FINALIZED', requested_actor_user_id, jsonb_build_object('finalPdfHash', requested_pdf_hash, 'rendererVersion', requested_renderer_version));
  return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', requested_pdf_hash);
end;
$$;

create or replace function internal_security.ensure_document_generation_dossier(
  requested_snapshot_id uuid,
  requested_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  snapshot_row public.document_generation_snapshots%rowtype;
  link_row public.document_generation_dossier_links%rowtype;
  administration_row public.administrations%rowtype;
  category_row public.document_categories%rowtype;
  document_row public.employee_documents%rowtype;
  expected_storage_key text;
  title_value text;
begin
  select * into snapshot_row
  from public.document_generation_snapshots
  where id = requested_snapshot_id
  for update;
  if not found or requested_actor_user_id is null or not exists (
    select 1
    from public.user_hr_group_access access
    join public.management_roles role on role.id = access.management_role_id
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    join public.hr_groups group_row on group_row.tenant_id = access.tenant_id and group_row.id = access.hr_group_id and group_row.is_active
    where access.user_id = requested_actor_user_id
      and access.tenant_id = snapshot_row.tenant_id
      and access.hr_group_id = snapshot_row.hr_group_id
      and access.is_active
      and permission.code = 'document-generation:write'
      and (role.tenant_id is null or role.tenant_id = snapshot_row.tenant_id)
  ) then
    raise exception 'DOCUMENT_GENERATION_NOT_FOUND' using errcode = '42501';
  end if;
  if snapshot_row.status <> 'FINAL' or snapshot_row.final_pdf_hash is null or snapshot_row.final_storage_key is null or snapshot_row.final_pdf_size is null then
    raise exception 'DOCUMENT_GENERATION_STATE_INVALID' using errcode = '55000';
  end if;
  if not snapshot_row.default_dossier then
    return jsonb_build_object('status', 'SKIPPED');
  end if;

  select * into link_row
  from public.document_generation_dossier_links
  where tenant_id = snapshot_row.tenant_id
    and hr_group_id = snapshot_row.hr_group_id
    and snapshot_id = snapshot_row.id
  for update;
  if found then
    return jsonb_build_object('status', 'CREATED', 'documentId', link_row.employee_document_id);
  end if;

  if snapshot_row.source_administration_id is null then
    raise exception 'DOCUMENT_GENERATION_DOSSIER_PROFILE_ADMINISTRATION_MISSING' using errcode = '23514';
  end if;
  select * into administration_row
  from public.administrations administration_candidate
  where administration_candidate.tenant_id = snapshot_row.tenant_id
    and administration_candidate.hr_group_id = snapshot_row.hr_group_id
    and administration_candidate.id = snapshot_row.source_administration_id
    and administration_candidate.is_active
  for share;
  if not found then
    raise exception 'DOCUMENT_GENERATION_DOSSIER_ADMINISTRATION_INVALID' using errcode = '23514';
  end if;
  select * into category_row
  from public.document_categories category_candidate
  where category_candidate.tenant_id = snapshot_row.tenant_id
    and category_candidate.administration_id = administration_row.id
    and category_candidate.code = snapshot_row.document_category
    and category_candidate.is_active
  for share;
  if not found then
    raise exception 'DOCUMENT_GENERATION_DOSSIER_CATEGORY_MISSING' using errcode = '23514';
  end if;

  expected_storage_key := snapshot_row.tenant_id::text || '/' || snapshot_row.hr_group_id::text || '/' || snapshot_row.employee_id::text || '/generated/' || snapshot_row.id::text || '.pdf';
  if snapshot_row.final_storage_key <> expected_storage_key then
    raise exception 'DOCUMENT_GENERATION_STORAGE_CONFLICT' using errcode = '55000';
  end if;
  title_value := left(coalesce(nullif(btrim(snapshot_row.template_name), ''), 'Document Studio document'), 160);

  select * into document_row
  from public.employee_documents document_candidate
  where document_candidate.tenant_id = snapshot_row.tenant_id
    and document_candidate.storage_key = expected_storage_key
  for update;
  if found then
    if document_row.deleted_at is not null
      or document_row.administration_id <> administration_row.id
      or document_row.employee_id <> snapshot_row.employee_id
      or document_row.category_id <> category_row.id
      or document_row.content_type <> 'application/pdf'
      or document_row.file_size <> snapshot_row.final_pdf_size
      or document_row.checksum_sha256 <> snapshot_row.final_pdf_hash then
      raise exception 'DOCUMENT_GENERATION_DOSSIER_STORAGE_CONFLICT' using errcode = '55000';
    end if;
  else
    insert into public.employee_documents (
      tenant_id, administration_id, employee_id, category_id, storage_key, original_filename,
      content_type, file_size, checksum_sha256, title, description, tags, added_by_user_id
    ) values (
      snapshot_row.tenant_id, administration_row.id, snapshot_row.employee_id, category_row.id, expected_storage_key,
      'generated-' || snapshot_row.id::text || '.pdf', 'application/pdf', snapshot_row.final_pdf_size,
      snapshot_row.final_pdf_hash, title_value, null, array['generated', 'document-studio'], requested_actor_user_id
    ) returning * into document_row;
  end if;

  insert into public.document_audiences (tenant_id, administration_id, document_id, target_type, target_employee_id)
  values (snapshot_row.tenant_id, administration_row.id, document_row.id, 'EMPLOYEE', snapshot_row.employee_id)
  on conflict do nothing;
  insert into public.document_generation_dossier_links (
    tenant_id, hr_group_id, snapshot_id, administration_id, employee_document_id, created_by_user_id
  ) values (
    snapshot_row.tenant_id, snapshot_row.hr_group_id, snapshot_row.id, administration_row.id, document_row.id, requested_actor_user_id
  );
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata)
  values (snapshot_row.tenant_id, snapshot_row.hr_group_id, snapshot_row.id, 'DOSSIER_LINKED', requested_actor_user_id, jsonb_build_object('employeeDocumentId', document_row.id));
  return jsonb_build_object('status', 'CREATED', 'documentId', document_row.id);
end;
$$;

create or replace function public.finalize_document_generation(
  requested_snapshot_id uuid,
  requested_actor_user_id uuid,
  requested_idempotency_key uuid,
  requested_request_hash text,
  requested_pdf_hash text,
  requested_storage_key text,
  requested_file_size bigint,
  requested_renderer_version text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$ select internal_security.finalize_document_generation(requested_snapshot_id, requested_actor_user_id, requested_idempotency_key, requested_request_hash, requested_pdf_hash, requested_storage_key, requested_file_size, requested_renderer_version); $$;

create or replace function public.ensure_document_generation_dossier(requested_snapshot_id uuid, requested_actor_user_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$ select internal_security.ensure_document_generation_dossier(requested_snapshot_id, requested_actor_user_id); $$;

revoke all on function public.create_document_generation_preview(jsonb) from public, anon, authenticated;
grant execute on function public.create_document_generation_preview(jsonb) to service_role;
revoke all on function public.finalize_document_generation(uuid, uuid, uuid, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.finalize_document_generation(uuid, uuid, uuid, text, text, text, bigint, text) to service_role;
revoke all on function public.ensure_document_generation_dossier(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_document_generation_dossier(uuid, uuid) to service_role;
revoke all on function internal_security.create_document_generation_preview(jsonb) from public, anon, authenticated;
revoke all on function internal_security.finalize_document_generation(uuid, uuid, uuid, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function internal_security.ensure_document_generation_dossier(uuid, uuid) from public, anon, authenticated;

-- No authenticated caller needs direct idempotency access; all writes go
-- through the two server-only mutation functions above.
revoke all on public.document_generation_idempotency from public, anon, authenticated;
revoke insert, update, delete on public.document_generation_snapshots from authenticated;
revoke insert, update, delete on public.document_generation_audit from authenticated;

commit;
