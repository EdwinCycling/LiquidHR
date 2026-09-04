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
  if auth.uid() is null or not internal_security.current_user_has_hr_group_permission(tenant_id, group_id, 'document-generation:write') then raise exception 'DOCUMENT_GENERATION_FORBIDDEN' using errcode = '42501'; end if;
  select * into existing_row from public.document_generation_idempotency idem_row where idem_row.tenant_id = tenant_id and idem_row.hr_group_id = group_id and idem_row.actor_user_id = auth.uid() and idem_row.operation = 'PREVIEW' and idem_row.idempotency_key = idem for update;
  if found then if existing_row.request_hash <> request_hash then raise exception 'DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT' using errcode = '40001'; end if; return jsonb_build_object('id', existing_row.snapshot_id, 'status', 'PREVIEW'); end if;
  select * into version_row from public.document_studio_template_versions version_candidate where version_candidate.id = (requested_payload ->> 'template_version_id')::uuid and version_candidate.tenant_id = tenant_id and version_candidate.hr_group_id = group_id;
  if not found or version_row.status <> 'ACTIVE' then raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000'; end if;
  select * into template_row from public.document_studio_templates template_candidate where template_candidate.id = version_row.template_id and template_candidate.tenant_id = tenant_id and template_candidate.hr_group_id = group_id and template_candidate.lifecycle = 'ACTIVE' and template_candidate.current_active_version_id = version_row.id;
  if not found or template_row.kind <> 'DOCUMENT' then raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000'; end if;
  select * into employee_row from public.employees employee_candidate where employee_candidate.id = (requested_payload ->> 'employee_id')::uuid and employee_candidate.tenant_id = tenant_id and employee_candidate.hr_group_id = group_id and employee_candidate.deleted_at is null;
  if not found then raise exception 'DOCUMENT_GENERATION_EMPLOYEE_NOT_FOUND' using errcode = '22023'; end if;
  insert into public.document_generation_snapshots (id, tenant_id, hr_group_id, employee_id, template_id, template_version_id, template_version, snapshot, resolved_document_json, resolved_document_hash, renderer_version, generated_by_user_id)
  values (snapshot_id, tenant_id, group_id, employee_row.id, version_row.template_id, version_row.id, version_row.version_number, requested_payload -> 'snapshot', requested_payload -> 'resolved_document_json', requested_payload ->> 'resolved_document_hash', requested_payload ->> 'renderer_version', auth.uid());
  insert into public.document_generation_idempotency values (tenant_id, group_id, auth.uid(), 'PREVIEW', idem, request_hash, snapshot_id);
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata) values (tenant_id, group_id, snapshot_id, 'PREVIEW_CREATED', auth.uid(), jsonb_build_object('resolvedDocumentHash', requested_payload ->> 'resolved_document_hash'));
  return jsonb_build_object('id', snapshot_id, 'status', 'PREVIEW');
end; $$;

create or replace function internal_security.finalize_document_generation(requested_snapshot_id uuid, requested_idempotency_key uuid, requested_request_hash text, requested_pdf_hash text, requested_storage_key text, requested_renderer_version text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare snapshot_row public.document_generation_snapshots%rowtype; existing_row public.document_generation_idempotency%rowtype;
begin
  select * into snapshot_row from public.document_generation_snapshots where id = requested_snapshot_id for update;
  if not found or not internal_security.current_user_has_hr_group_permission(snapshot_row.tenant_id, snapshot_row.hr_group_id, 'document-generation:write') then raise exception 'DOCUMENT_GENERATION_NOT_FOUND' using errcode = '42501'; end if;
  select * into existing_row from public.document_generation_idempotency where tenant_id = snapshot_row.tenant_id and hr_group_id = snapshot_row.hr_group_id and actor_user_id = auth.uid() and operation = 'FINALIZE' and idempotency_key = requested_idempotency_key for update;
  if found then if existing_row.request_hash <> requested_request_hash then raise exception 'DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT' using errcode = '40001'; end if; return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', snapshot_row.final_pdf_hash); end if;
  if snapshot_row.status = 'FINAL' then return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', snapshot_row.final_pdf_hash); end if;
  if snapshot_row.status <> 'PREVIEW' or snapshot_row.renderer_version <> requested_renderer_version then raise exception 'DOCUMENT_GENERATION_STATE_INVALID' using errcode = '55000'; end if;
  update public.document_generation_snapshots set status = 'FINAL', final_pdf_hash = requested_pdf_hash, final_storage_key = requested_storage_key, finalized_at = timezone('utc', now()), finalized_by_user_id = auth.uid() where id = requested_snapshot_id;
  insert into public.document_generation_idempotency values (snapshot_row.tenant_id, snapshot_row.hr_group_id, auth.uid(), 'FINALIZE', requested_idempotency_key, requested_request_hash, requested_snapshot_id);
  insert into public.document_generation_audit (tenant_id, hr_group_id, snapshot_id, action, actor_user_id, metadata) values (snapshot_row.tenant_id, snapshot_row.hr_group_id, requested_snapshot_id, 'FINALIZED', auth.uid(), jsonb_build_object('finalPdfHash', requested_pdf_hash, 'rendererVersion', requested_renderer_version));
  return jsonb_build_object('id', requested_snapshot_id, 'status', 'FINAL', 'pdfHash', requested_pdf_hash);
end; $$;

create or replace function public.create_document_generation_preview(requested_payload jsonb) returns jsonb language sql security definer set search_path = pg_catalog, public as $$ select internal_security.create_document_generation_preview(requested_payload); $$;
create or replace function public.finalize_document_generation(requested_snapshot_id uuid, requested_idempotency_key uuid, requested_request_hash text, requested_pdf_hash text, requested_storage_key text, requested_renderer_version text) returns jsonb language sql security definer set search_path = pg_catalog, public as $$ select internal_security.finalize_document_generation(requested_snapshot_id, requested_idempotency_key, requested_request_hash, requested_pdf_hash, requested_storage_key, requested_renderer_version); $$;
revoke all on function public.create_document_generation_preview(jsonb) from public, anon;
revoke all on function public.finalize_document_generation(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_document_generation_preview(jsonb) to authenticated;
grant execute on function public.finalize_document_generation(uuid, uuid, text, text, text, text) to authenticated;
revoke all on function internal_security.create_document_generation_preview(jsonb) from public, anon, authenticated;
revoke all on function internal_security.finalize_document_generation(uuid, uuid, text, text, text, text) from public, anon, authenticated;

commit;
