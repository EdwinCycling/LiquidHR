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
grant select, insert, update on public.document_generation_idempotency to authenticated;
revoke update, delete on public.document_generation_snapshots from authenticated;
revoke insert, update, delete on public.document_generation_audit from authenticated;

commit;
