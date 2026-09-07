begin;

-- DG2/DG3 keeps DG1 snapshots immutable and adds only distribution and
-- provider-neutral internal signing records around those final artifacts.
create type public.document_generation_batch_status as enum ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
create type public.document_generation_batch_item_status as enum ('PENDING', 'FINAL', 'FAILED');
create type public.document_signing_status as enum ('PENDING', 'SIGNED', 'DECLINED', 'CANCELLED');

insert into public.permissions (code, name, category, description)
values
  ('document-distribution:read', 'Documentverzendingen lezen', 'Document Studio', 'DG2-verzendingen en ontvangerstatus binnen de actieve HR-groep lezen.'),
  ('document-distribution:write', 'Documenten naar groepen verzenden', 'Document Studio', 'Een gegenereerd document naar een geselecteerde employee group verzenden.'),
  ('document-signing:read', 'Ondertekenstatus lezen', 'Document Studio', 'Interne ondertekenstatus binnen de toegestane medewerker- of HR-groepcontext lezen.'),
  ('document-signing:write', 'Interne ondertekening beheren', 'Document Studio', 'Een interne ondertekening voorbereiden, tekenen of annuleren.'),
  ('self:document:read', 'Eigen dossierdocumenten lezen', 'Persoonlijk', 'Leest eigen vrijgegeven medewerkersdossierdocumenten.'),
  ('self:document-signing:read', 'Eigen ondertekenverzoeken lezen', 'Persoonlijk', 'Leest eigen interne ondertekenverzoeken.'),
  ('self:document-signing:write', 'Eigen documenten intern tekenen', 'Persoonlijk', 'Tekent eigen interne ondertekenverzoeken.' )
on conflict (code) do update set name = excluded.name, category = excluded.category, description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where (
    (role.code in ('TENANT_ADMIN', 'HR_ADMIN') and permission.code in ('document-distribution:read', 'document-distribution:write', 'document-signing:read', 'document-signing:write'))
    or (role.code = 'DIRECT_MANAGER' and permission.code = 'document-signing:read')
    or (role.code in ('EMPLOYEE', 'DIRECT_MANAGER') and permission.code in ('self:document:read', 'self:document-signing:read', 'self:document-signing:write'))
  )
  and role.tenant_id is null
on conflict do nothing;

-- Existing DG1 dossier links already create an EMPLOYEE audience. This
-- additive policy extension lets the linked employee read that audience using
-- the canonical self: permission; HR/Admin and existing manager rules remain
-- unchanged.
create or replace function internal_security.can_access_document(requested_document_id uuid, requested_permission text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.employee_documents document
    join public.document_categories category on category.id = document.category_id
    where document.id = requested_document_id
      and (
        internal_security.can_manage_employee(document.employee_id, requested_permission)
        or (
          document.employee_id = internal_security.current_employee_id()
          and internal_security.current_user_has_permission(document.tenant_id, document.administration_id, 'self:document:read')
        )
      )
      and internal_security.document_audience_matches(document.id)
      and (not category.requires_salary_permission or internal_security.can_manage_employee(document.employee_id, 'salary:read'))
  );
$$;
revoke all on function internal_security.can_access_document(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.can_access_document(uuid, text) to authenticated;

create table public.document_generation_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  template_id uuid not null,
  template_version_id uuid not null,
  requested_count integer not null check (requested_count between 1 and 200),
  final_count integer not null default 0 check (final_count between 0 and 200),
  failed_count integer not null default 0 check (failed_count between 0 and 200),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status public.document_generation_batch_status not null default 'RUNNING',
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  completed_at timestamptz,
  constraint document_generation_batches_group_fk foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  constraint document_generation_batches_template_fk foreign key (tenant_id, hr_group_id, template_id) references public.document_studio_templates(tenant_id, hr_group_id, id) on delete restrict,
  constraint document_generation_batches_version_fk foreign key (tenant_id, hr_group_id, template_version_id) references public.document_studio_template_versions(tenant_id, hr_group_id, id) on delete restrict,
  constraint document_generation_batches_counts_valid check (final_count + failed_count <= requested_count)
);

create table public.document_generation_batch_idempotency (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  batch_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, hr_group_id, actor_user_id, idempotency_key),
  foreign key (tenant_id, hr_group_id, batch_id) references public.document_generation_batches(tenant_id, hr_group_id, id) on delete cascade
);

create table public.document_generation_batch_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  batch_id uuid not null,
  employee_id uuid not null,
  snapshot_id uuid,
  status public.document_generation_batch_item_status not null default 'PENDING',
  error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (tenant_id, hr_group_id, batch_id, employee_id),
  unique (tenant_id, hr_group_id, batch_id, snapshot_id),
  foreign key (tenant_id, hr_group_id, batch_id) references public.document_generation_batches(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, employee_id) references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  foreign key (tenant_id, hr_group_id, snapshot_id) references public.document_generation_snapshots(tenant_id, hr_group_id, id) on delete restrict
);

create table public.document_generation_batch_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  batch_id uuid not null,
  action text not null check (action in ('CREATED', 'COMPLETED', 'PARTIAL', 'FAILED', 'ITEM_FAILED')),
  actor_user_id uuid not null references auth.users(id),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, batch_id) references public.document_generation_batches(tenant_id, hr_group_id, id) on delete cascade
);

create index document_generation_batches_history_idx on public.document_generation_batches (tenant_id, hr_group_id, created_at desc);
create index document_generation_batch_items_employee_idx on public.document_generation_batch_items (tenant_id, hr_group_id, employee_id, created_at desc);
create index document_generation_batch_items_batch_idx on public.document_generation_batch_items (tenant_id, hr_group_id, batch_id, status);

alter table public.document_generation_batches enable row level security;
alter table public.document_generation_batch_idempotency enable row level security;
alter table public.document_generation_batch_items enable row level security;
alter table public.document_generation_batch_audit enable row level security;

create policy document_generation_batches_select
  on public.document_generation_batches for select to authenticated
  using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-distribution:read')));
create policy document_generation_batch_items_select
  on public.document_generation_batch_items for select to authenticated
  using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-distribution:read')));
create policy document_generation_batch_audit_select
  on public.document_generation_batch_audit for select to authenticated
  using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'document-distribution:read')));

revoke all on public.document_generation_batches, public.document_generation_batch_idempotency, public.document_generation_batch_items, public.document_generation_batch_audit from public, anon, authenticated;
grant select on public.document_generation_batches, public.document_generation_batch_items, public.document_generation_batch_audit to authenticated;

create or replace function internal_security.create_document_generation_batch(requested_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := nullif(requested_payload ->> 'actor_user_id', '')::uuid;
  requested_tenant_id uuid := nullif(requested_payload ->> 'tenant_id', '')::uuid;
  requested_group_id uuid := nullif(requested_payload ->> 'hr_group_id', '')::uuid;
  requested_template_id uuid := nullif(requested_payload ->> 'template_id', '')::uuid;
  requested_version_id uuid := nullif(requested_payload ->> 'template_version_id', '')::uuid;
  requested_batch_id uuid := nullif(requested_payload ->> 'id', '')::uuid;
  requested_idempotency_key uuid := nullif(requested_payload ->> 'idempotency_key', '')::uuid;
  requested_hash text := requested_payload ->> 'request_hash';
  employee_id uuid;
  existing_id uuid;
  employee_count integer := jsonb_array_length(coalesce(requested_payload -> 'employee_ids', '[]'::jsonb));
begin
  if requested_payload is null or jsonb_typeof(requested_payload) <> 'object'
    or actor_id is null or requested_tenant_id is null or requested_group_id is null
    or requested_template_id is null or requested_version_id is null or requested_batch_id is null
    or requested_idempotency_key is null or requested_hash is null or requested_hash !~ '^[0-9a-f]{64}$'
    or employee_count < 1 or employee_count > 200 then
    raise exception 'DOCUMENT_DISTRIBUTION_INPUT_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_tenant_id::text || ':' || requested_group_id::text || ':' || actor_id::text || ':' || requested_idempotency_key::text, 0));
  if not internal_security.current_user_has_hr_group_permission(requested_tenant_id, requested_group_id, 'document-distribution:write')
     and not exists (
       select 1 from public.user_hr_group_access access
       join public.management_roles role on role.id = access.management_role_id
       join public.role_permissions role_permission on role_permission.management_role_id = role.id
       join public.permissions permission on permission.id = role_permission.permission_id
       where access.user_id = actor_id and access.tenant_id = requested_tenant_id and access.hr_group_id = requested_group_id
         and access.is_active and permission.code = 'document-distribution:write'
         and (role.tenant_id is null or role.tenant_id = requested_tenant_id)
     ) then
    raise exception 'DOCUMENT_DISTRIBUTION_FORBIDDEN' using errcode = '42501';
  end if;
  select batch_id into existing_id from public.document_generation_batch_idempotency
  where tenant_id = requested_tenant_id and hr_group_id = requested_group_id and actor_user_id = actor_id and idempotency_key = requested_idempotency_key;
  if existing_id is not null then
    if not exists (select 1 from public.document_generation_batch_idempotency where tenant_id = requested_tenant_id and hr_group_id = requested_group_id and actor_user_id = actor_id and idempotency_key = requested_idempotency_key and request_hash = requested_hash) then
      raise exception 'DOCUMENT_DISTRIBUTION_IDEMPOTENCY_CONFLICT' using errcode = '40001';
    end if;
    return jsonb_build_object('id', existing_id, 'status', 'RUNNING');
  end if;
  if not exists (
    select 1 from public.document_studio_template_versions version_row
    join public.document_studio_templates template_row on template_row.tenant_id = version_row.tenant_id and template_row.hr_group_id = version_row.hr_group_id and template_row.id = version_row.template_id
    where version_row.tenant_id = requested_tenant_id and version_row.hr_group_id = requested_group_id and version_row.id = requested_version_id
      and version_row.template_id = requested_template_id and version_row.status = 'ACTIVE'
      and template_row.kind = 'DOCUMENT' and template_row.lifecycle = 'ACTIVE' and template_row.current_active_version_id = version_row.id
  ) then
    raise exception 'DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE' using errcode = '55000';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(requested_payload -> 'employee_ids') selected(id)
    where not exists (select 1 from public.employees employee where employee.id = selected.id::uuid and employee.tenant_id = requested_tenant_id and employee.hr_group_id = requested_group_id and employee.deleted_at is null and not employee.is_archived)
  ) then
    raise exception 'DOCUMENT_DISTRIBUTION_EMPLOYEE_SCOPE_INVALID' using errcode = '42501';
  end if;
  insert into public.document_generation_batches (id, tenant_id, hr_group_id, template_id, template_version_id, requested_count, request_hash, created_by_user_id)
  values (requested_batch_id, requested_tenant_id, requested_group_id, requested_template_id, requested_version_id, employee_count, requested_hash, actor_id);
  insert into public.document_generation_batch_items (tenant_id, hr_group_id, batch_id, employee_id)
  select requested_tenant_id, requested_group_id, requested_batch_id, selected.id::uuid
  from jsonb_array_elements_text(requested_payload -> 'employee_ids') selected(id);
  insert into public.document_generation_batch_idempotency (tenant_id, hr_group_id, actor_user_id, idempotency_key, request_hash, batch_id)
  values (requested_tenant_id, requested_group_id, actor_id, requested_idempotency_key, requested_hash, requested_batch_id);
  insert into public.document_generation_batch_audit (tenant_id, hr_group_id, batch_id, action, actor_user_id, metadata)
  values (requested_tenant_id, requested_group_id, requested_batch_id, 'CREATED', actor_id, jsonb_build_object('requestedCount', employee_count));
  return jsonb_build_object('id', requested_batch_id, 'status', 'RUNNING');
end;
$$;

create or replace function public.create_document_generation_batch(requested_payload jsonb)
returns jsonb language sql security definer set search_path = pg_catalog, public
as $$ select internal_security.create_document_generation_batch(requested_payload); $$;
revoke all on function public.create_document_generation_batch(jsonb) from public, anon, authenticated;
grant execute on function public.create_document_generation_batch(jsonb) to service_role;
revoke all on function internal_security.create_document_generation_batch(jsonb) from public, anon, authenticated;

create table public.document_signing_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  snapshot_id uuid not null,
  employee_id uuid not null,
  signer_employee_id uuid not null,
  provider_code text not null default 'INTERNAL' check (provider_code = 'INTERNAL'),
  external_reference text,
  status public.document_signing_status not null default 'PENDING',
  prepared_by_user_id uuid not null references auth.users(id),
  prepared_at timestamptz not null default timezone('utc', now()),
  signed_at timestamptz,
  signed_by_user_id uuid references auth.users(id),
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, hr_group_id, id),
  unique (tenant_id, hr_group_id, snapshot_id, signer_employee_id),
  constraint document_signing_requests_group_fk foreign key (tenant_id, hr_group_id) references public.hr_groups(tenant_id, id) on delete cascade,
  constraint document_signing_requests_snapshot_fk foreign key (tenant_id, hr_group_id, snapshot_id) references public.document_generation_snapshots(tenant_id, hr_group_id, id) on delete restrict,
  constraint document_signing_requests_employee_fk foreign key (tenant_id, hr_group_id, employee_id) references public.employees(tenant_id, hr_group_id, id) on delete restrict,
  constraint document_signing_requests_signer_fk foreign key (tenant_id, signer_employee_id) references public.employees(tenant_id, id) on delete restrict,
  constraint document_signing_requests_signer_matches_document check (employee_id = signer_employee_id),
  constraint document_signing_requests_signed_fields check ((status = 'SIGNED' and signed_at is not null and signed_by_user_id is not null) or status <> 'SIGNED')
);

create table public.document_signing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  request_id uuid not null,
  event_type text not null check (event_type in ('PREPARED', 'SIGNED', 'DECLINED', 'CANCELLED')),
  actor_user_id uuid not null references auth.users(id),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, request_id) references public.document_signing_requests(tenant_id, hr_group_id, id) on delete cascade
);

create index document_signing_requests_employee_idx on public.document_signing_requests (tenant_id, hr_group_id, employee_id, status, created_at desc);
create index document_signing_requests_signer_idx on public.document_signing_requests (tenant_id, signer_employee_id, status, created_at desc);
create index document_signing_events_request_idx on public.document_signing_events (tenant_id, hr_group_id, request_id, created_at);

create or replace function internal_security.can_access_document_signing(requested_request_id uuid, requested_permission text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.document_signing_requests request_row
    where request_row.id = requested_request_id
      and (
        internal_security.current_user_has_hr_group_permission(request_row.tenant_id, request_row.hr_group_id, requested_permission)
        or (
          request_row.signer_employee_id = internal_security.current_employee_id()
          and internal_security.current_user_has_permission(request_row.tenant_id, null, 'self:document-signing:read')
        )
        or internal_security.can_manage_employee(request_row.employee_id, 'document-signing:read')
      )
  );
$$;
revoke all on function internal_security.can_access_document_signing(uuid, text) from public, anon, authenticated;
grant execute on function internal_security.can_access_document_signing(uuid, text) to authenticated;

alter table public.document_signing_requests enable row level security;
alter table public.document_signing_events enable row level security;
create policy document_signing_requests_select
  on public.document_signing_requests for select to authenticated
  using ((select internal_security.can_access_document_signing(id, 'document-signing:read')));
create policy document_signing_events_select
  on public.document_signing_events for select to authenticated
  using ((select internal_security.can_access_document_signing(request_id, 'document-signing:read')));
revoke all on public.document_signing_requests, public.document_signing_events from public, anon, authenticated;
grant select on public.document_signing_requests, public.document_signing_events to authenticated;

create or replace function internal_security.prepare_document_signing(requested_snapshot_id uuid, requested_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare snapshot_row public.document_generation_snapshots%rowtype; request_row public.document_signing_requests%rowtype;
begin
  select * into snapshot_row from public.document_generation_snapshots where id = requested_snapshot_id for share;
  if not found or not exists (
    select 1
    from public.user_hr_group_access access
    join public.management_roles role on role.id = access.management_role_id
    join public.role_permissions role_permission on role_permission.management_role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    where access.user_id = requested_actor_user_id
      and access.tenant_id = snapshot_row.tenant_id
      and access.hr_group_id = snapshot_row.hr_group_id
      and access.is_active
      and permission.code = 'document-signing:write'
      and (role.tenant_id is null or role.tenant_id = snapshot_row.tenant_id)
  ) then
    raise exception 'DOCUMENT_SIGNING_FORBIDDEN' using errcode = '42501';
  end if;
  if snapshot_row.status <> 'FINAL' then raise exception 'DOCUMENT_SIGNING_FINAL_REQUIRED' using errcode = '55000'; end if;
  select * into request_row from public.document_signing_requests where tenant_id = snapshot_row.tenant_id and hr_group_id = snapshot_row.hr_group_id and snapshot_id = snapshot_row.id and signer_employee_id = snapshot_row.employee_id for update;
  if found then return jsonb_build_object('id', request_row.id, 'status', request_row.status); end if;
  insert into public.document_signing_requests (tenant_id, hr_group_id, snapshot_id, employee_id, signer_employee_id, prepared_by_user_id)
  values (snapshot_row.tenant_id, snapshot_row.hr_group_id, snapshot_row.id, snapshot_row.employee_id, snapshot_row.employee_id, requested_actor_user_id)
  on conflict (tenant_id, hr_group_id, snapshot_id, signer_employee_id) do nothing
  returning * into request_row;
  if not found then
    select * into request_row from public.document_signing_requests where tenant_id = snapshot_row.tenant_id and hr_group_id = snapshot_row.hr_group_id and snapshot_id = snapshot_row.id and signer_employee_id = snapshot_row.employee_id;
    return jsonb_build_object('id', request_row.id, 'status', request_row.status);
  end if;
  insert into public.document_signing_events (tenant_id, hr_group_id, request_id, event_type, actor_user_id, metadata)
  values (request_row.tenant_id, request_row.hr_group_id, request_row.id, 'PREPARED', requested_actor_user_id, jsonb_build_object('providerCode', 'INTERNAL'));
  return jsonb_build_object('id', request_row.id, 'status', request_row.status);
end;
$$;

create or replace function internal_security.complete_document_signing(requested_request_id uuid, requested_actor_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare request_row public.document_signing_requests%rowtype; signer_user_id uuid;
begin
  select candidate.* into request_row from public.document_signing_requests candidate where candidate.id = requested_request_id for update;
  if not found then raise exception 'DOCUMENT_SIGNING_NOT_FOUND' using errcode = 'P0002'; end if;
  select employee.auth_user_id into signer_user_id from public.employees employee where employee.id = request_row.signer_employee_id and employee.tenant_id = request_row.tenant_id and employee.auth_user_id is not null;
  if signer_user_id is null or signer_user_id <> requested_actor_user_id then raise exception 'DOCUMENT_SIGNING_FORBIDDEN' using errcode = '42501'; end if;
  if request_row.status <> 'PENDING' then return jsonb_build_object('id', request_row.id, 'status', request_row.status); end if;
  update public.document_signing_requests set status = 'SIGNED', signed_at = timezone('utc', now()), signed_by_user_id = requested_actor_user_id where id = request_row.id;
  insert into public.document_signing_events (tenant_id, hr_group_id, request_id, event_type, actor_user_id) values (request_row.tenant_id, request_row.hr_group_id, request_row.id, 'SIGNED', requested_actor_user_id);
  return jsonb_build_object('id', request_row.id, 'status', 'SIGNED');
end;
$$;

create or replace function public.prepare_document_signing(requested_snapshot_id uuid, requested_actor_user_id uuid)
returns jsonb language sql security definer set search_path = pg_catalog, public
as $$ select internal_security.prepare_document_signing(requested_snapshot_id, requested_actor_user_id); $$;
create or replace function public.complete_document_signing(requested_request_id uuid, requested_actor_user_id uuid)
returns jsonb language sql security definer set search_path = pg_catalog, public
as $$ select internal_security.complete_document_signing(requested_request_id, requested_actor_user_id); $$;
revoke all on function public.prepare_document_signing(uuid, uuid), public.complete_document_signing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_document_signing(uuid, uuid), public.complete_document_signing(uuid, uuid) to service_role;
revoke all on function internal_security.prepare_document_signing(uuid, uuid), internal_security.complete_document_signing(uuid, uuid) from public, anon, authenticated;

commit;
