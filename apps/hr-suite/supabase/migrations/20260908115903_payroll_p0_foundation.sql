begin;

-- Payroll P0 is a provider-neutral control plane. It stores no provider token
-- values in this migration and does not perform an external provider call.

create type public.payroll_connection_status as enum (
  'NOT_CONNECTED',
  'CONNECTING',
  'CONNECTED',
  'ACTION_REQUIRED',
  'ERROR',
  'DISCONNECTED'
);

create type public.payroll_binding_status as enum ('ACTIVE', 'INACTIVE');
create type public.payroll_sync_mode as enum ('PREVIEW', 'APPLY');
create type public.payroll_sync_run_status as enum ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- The module is deliberately opt-in. Existing tenant module rows are not
-- backfilled here; the settings flow owns activation for each tenant.
alter table public.tenant_modules drop constraint if exists tenant_modules_module_code_check;
alter table public.tenant_modules add constraint tenant_modules_module_code_check
  check (module_code in ('HERA', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'DOCUMENTS', 'PAYROLL'));

insert into public.permissions (code, name, category, description)
values
  ('payroll:read', 'Payroll lezen', 'Payroll', 'Leest de Payroll-foundation, verbindingen, koppelingen en integratiestatus binnen de actieve HR-groep.'),
  ('payroll:manage', 'Payroll beheren', 'Payroll', 'Beheert Payroll-verbindingen, koppelingen en synchronisatievoorbereiding binnen de actieve HR-groep.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

-- Seed both global roles and already materialised tenant role overrides. The
-- application resolver replaces a global role with its tenant override when
-- present, so both rows must carry the same Payroll permissions.
insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('payroll:read', 'payroll:manage')
on conflict do nothing;

create table public.payroll_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code = upper(code) and code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_providers_code_key unique (code)
);

create table public.payroll_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  provider_id uuid not null references public.payroll_providers(id) on delete restrict,
  status public.payroll_connection_status not null default 'NOT_CONNECTED',
  connected_at timestamptz,
  connected_by_user_id uuid references auth.users(id) on delete set null,
  last_checked_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_connections_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint payroll_connections_scope_id_key unique (tenant_id, hr_group_id, id),
  constraint payroll_connections_state_check check (
    (status <> 'CONNECTED' or connected_at is not null)
    and (status <> 'DISCONNECTED' or disconnected_at is not null)
  )
);

-- A non-disconnected row includes CONNECTING and NOT_CONNECTED reservations;
-- this prevents two concurrent onboarding attempts for one HR group.
create unique index payroll_connections_one_reserved_per_group_idx
  on public.payroll_connections (tenant_id, hr_group_id)
  where status <> 'DISCONNECTED';
create index payroll_connections_provider_idx
  on public.payroll_connections (tenant_id, hr_group_id, provider_id, status);

create schema if not exists payroll_private;
revoke all on schema payroll_private from public, anon, authenticated;
grant usage on schema payroll_private to service_role;

create table payroll_private.payroll_connection_credentials (
  tenant_id uuid not null,
  hr_group_id uuid not null,
  connection_id uuid not null,
  credential_version integer not null check (credential_version > 0),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  expires_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, hr_group_id, connection_id, credential_version),
  constraint payroll_credentials_connection_fkey
    foreign key (tenant_id, hr_group_id, connection_id)
    references public.payroll_connections(tenant_id, hr_group_id, id) on delete restrict
);
alter table payroll_private.payroll_connection_credentials enable row level security;
revoke all on payroll_private.payroll_connection_credentials from public, anon, authenticated;
grant select, insert, update, delete on payroll_private.payroll_connection_credentials to service_role;

create table public.payroll_company_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  connection_id uuid not null,
  administration_id uuid not null,
  external_company_id text not null check (length(btrim(external_company_id)) between 1 and 200),
  external_company_display_name text not null check (length(btrim(external_company_display_name)) between 1 and 240),
  status public.payroll_binding_status not null default 'ACTIVE',
  bound_at timestamptz,
  bound_by_user_id uuid references auth.users(id) on delete set null,
  last_seen_at timestamptz,
  unbound_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_company_bindings_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint payroll_company_bindings_connection_fkey
    foreign key (tenant_id, hr_group_id, connection_id)
    references public.payroll_connections(tenant_id, hr_group_id, id) on delete restrict,
  constraint payroll_company_bindings_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id) on delete restrict,
  constraint payroll_company_bindings_scope_id_key unique (tenant_id, hr_group_id, connection_id, id),
  constraint payroll_company_bindings_state_check check (
    (status = 'ACTIVE' and unbound_at is null)
    or (status = 'INACTIVE' and unbound_at is not null)
  )
);

create unique index payroll_company_bindings_one_per_administration_idx
  on public.payroll_company_bindings (tenant_id, hr_group_id, administration_id)
  where status = 'ACTIVE';
create unique index payroll_company_bindings_one_per_provider_company_idx
  on public.payroll_company_bindings (tenant_id, hr_group_id, connection_id, external_company_id)
  where status = 'ACTIVE';
create index payroll_company_bindings_group_status_idx
  on public.payroll_company_bindings (tenant_id, hr_group_id, status, updated_at desc);

create table public.payroll_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  connection_id uuid not null,
  company_binding_id uuid,
  mode public.payroll_sync_mode not null,
  status public.payroll_sync_run_status not null default 'PENDING',
  started_at timestamptz,
  completed_at timestamptz,
  started_by_user_id uuid references auth.users(id) on delete set null,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_sync_runs_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint payroll_sync_runs_connection_fkey
    foreign key (tenant_id, hr_group_id, connection_id)
    references public.payroll_connections(tenant_id, hr_group_id, id) on delete restrict,
  constraint payroll_sync_runs_binding_fkey
    foreign key (tenant_id, hr_group_id, connection_id, company_binding_id)
    references public.payroll_company_bindings(tenant_id, hr_group_id, connection_id, id) on delete restrict,
  constraint payroll_sync_runs_scope_id_key unique (tenant_id, hr_group_id, id)
);

create index payroll_sync_runs_group_history_idx
  on public.payroll_sync_runs (tenant_id, hr_group_id, created_at desc);
create index payroll_sync_runs_binding_idx
  on public.payroll_sync_runs (tenant_id, hr_group_id, company_binding_id, created_at desc)
  where company_binding_id is not null;

create table public.payroll_sync_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  sync_run_id uuid not null,
  entity_type text not null check (entity_type in ('COMPANY', 'EMPLOYEE', 'EMPLOYMENT', 'PAYROLL_COMPONENT')),
  external_entity_id text not null check (length(btrim(external_entity_id)) between 1 and 200),
  local_entity_id uuid,
  match_status text not null default 'UNMATCHED' check (match_status in ('UNMATCHED', 'NEW', 'MATCHED', 'PROBABLE_MATCH', 'CONFLICT', 'EXCLUDED')),
  decision_status text not null default 'PENDING' check (decision_status in ('PENDING', 'ACCEPTED', 'REJECTED', 'IGNORED')),
  normalized_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(normalized_payload) = 'object'),
  difference_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(difference_summary) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_sync_items_run_fkey
    foreign key (tenant_id, hr_group_id, sync_run_id)
    references public.payroll_sync_runs(tenant_id, hr_group_id, id) on delete cascade,
  constraint payroll_sync_items_scope_id_key unique (tenant_id, hr_group_id, sync_run_id, id),
  constraint payroll_sync_items_external_key unique (tenant_id, hr_group_id, sync_run_id, entity_type, external_entity_id)
);
create index payroll_sync_items_status_idx
  on public.payroll_sync_items (tenant_id, hr_group_id, sync_run_id, match_status, decision_status);

create table public.payroll_sync_issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  sync_run_id uuid not null,
  sync_item_id uuid,
  code text not null check (length(btrim(code)) between 1 and 120),
  severity text not null check (severity in ('INFO', 'WARNING', 'ERROR', 'BLOCKING')),
  message text not null check (length(btrim(message)) between 1 and 1000),
  technical_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_sync_issues_run_fkey
    foreign key (tenant_id, hr_group_id, sync_run_id)
    references public.payroll_sync_runs(tenant_id, hr_group_id, id) on delete cascade,
  constraint payroll_sync_issues_item_fkey
    foreign key (tenant_id, hr_group_id, sync_run_id, sync_item_id)
    references public.payroll_sync_items(tenant_id, hr_group_id, sync_run_id, id) on delete cascade
);
create index payroll_sync_issues_run_idx
  on public.payroll_sync_issues (tenant_id, hr_group_id, sync_run_id, severity, created_at);

create table public.payroll_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  provider_id uuid,
  connection_id uuid,
  company_binding_id uuid,
  administration_id uuid,
  event_type text not null check (event_type in (
    'PAYROLL_CONNECTION_CREATED',
    'PAYROLL_CONNECTION_CHECKED',
    'PAYROLL_CONNECTION_RECONNECTED',
    'PAYROLL_CONNECTION_DISCONNECTED',
    'PAYROLL_COMPANIES_DISCOVERED',
    'PAYROLL_COMPANY_BOUND',
    'PAYROLL_COMPANY_UNBOUND',
    'PAYROLL_SYNC_PREVIEW_STARTED',
    'PAYROLL_SYNC_PREVIEW_COMPLETED',
    'PAYROLL_SYNC_APPLY_STARTED',
    'PAYROLL_SYNC_APPLY_COMPLETED'
  )),
  actor_user_id uuid references auth.users(id) on delete set null,
  result_code text not null check (length(btrim(result_code)) between 1 and 120),
  reference_data jsonb not null default '{}'::jsonb check (
    jsonb_typeof(reference_data) = 'object'
    and not (reference_data ?| array['access_token', 'refresh_token', 'client_secret', 'authorization_code'])
  ),
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_audit_events_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint payroll_audit_events_provider_fkey
    foreign key (provider_id) references public.payroll_providers(id) on delete restrict,
  constraint payroll_audit_events_connection_fkey
    foreign key (tenant_id, hr_group_id, connection_id)
    references public.payroll_connections(tenant_id, hr_group_id, id) on delete restrict,
  constraint payroll_audit_events_binding_fkey
    foreign key (tenant_id, hr_group_id, connection_id, company_binding_id)
    references public.payroll_company_bindings(tenant_id, hr_group_id, connection_id, id) on delete restrict,
  constraint payroll_audit_events_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id) on delete restrict
);
create index payroll_audit_events_group_history_idx
  on public.payroll_audit_events (tenant_id, hr_group_id, created_at desc);
create index payroll_audit_events_connection_idx
  on public.payroll_audit_events (tenant_id, hr_group_id, connection_id, created_at desc)
  where connection_id is not null;

create or replace function internal_security.prevent_payroll_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id or new.hr_group_id is distinct from old.hr_group_id then
    raise exception 'Payroll tenant- en HR-groepsscope kan niet worden gewijzigd.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function internal_security.prevent_payroll_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'PAYROLL_AUDIT_APPEND_ONLY' using errcode = '55000';
end;
$$;

create trigger set_payroll_providers_updated_at
before update on public.payroll_providers for each row execute function internal_security.set_updated_at();
create trigger set_payroll_connections_updated_at
before update on public.payroll_connections for each row execute function internal_security.set_updated_at();
create trigger set_payroll_credentials_updated_at
before update on payroll_private.payroll_connection_credentials for each row execute function internal_security.set_updated_at();
create trigger set_payroll_company_bindings_updated_at
before update on public.payroll_company_bindings for each row execute function internal_security.set_updated_at();
create trigger set_payroll_sync_runs_updated_at
before update on public.payroll_sync_runs for each row execute function internal_security.set_updated_at();
create trigger set_payroll_sync_items_updated_at
before update on public.payroll_sync_items for each row execute function internal_security.set_updated_at();

create trigger prevent_payroll_connections_scope_change
before update of tenant_id, hr_group_id on public.payroll_connections
for each row execute function internal_security.prevent_payroll_scope_change();
create trigger prevent_payroll_bindings_scope_change
before update of tenant_id, hr_group_id on public.payroll_company_bindings
for each row execute function internal_security.prevent_payroll_scope_change();
create trigger prevent_payroll_sync_runs_scope_change
before update of tenant_id, hr_group_id on public.payroll_sync_runs
for each row execute function internal_security.prevent_payroll_scope_change();
create trigger prevent_payroll_sync_items_scope_change
before update of tenant_id, hr_group_id on public.payroll_sync_items
for each row execute function internal_security.prevent_payroll_scope_change();
create trigger prevent_payroll_issues_scope_change
before update of tenant_id, hr_group_id on public.payroll_sync_issues
for each row execute function internal_security.prevent_payroll_scope_change();
create trigger prevent_payroll_audit_scope_change
before update of tenant_id, hr_group_id on public.payroll_audit_events
for each row execute function internal_security.prevent_payroll_scope_change();
create trigger prevent_payroll_credentials_scope_change
before update of tenant_id, hr_group_id on payroll_private.payroll_connection_credentials
for each row execute function internal_security.prevent_payroll_scope_change();

create trigger prevent_payroll_audit_update
before update or delete on public.payroll_audit_events
for each row execute function internal_security.prevent_payroll_audit_mutation();

alter table public.payroll_providers enable row level security;
alter table public.payroll_connections enable row level security;
alter table public.payroll_company_bindings enable row level security;
alter table public.payroll_sync_runs enable row level security;
alter table public.payroll_sync_items enable row level security;
alter table public.payroll_sync_issues enable row level security;
alter table public.payroll_audit_events enable row level security;

create policy payroll_providers_read
on public.payroll_providers for select to authenticated
using (exists (
  select 1
  from public.user_hr_group_access access
  where access.user_id = (select auth.uid())
    and access.is_active
    and internal_security.current_user_has_hr_group_permission(access.tenant_id, access.hr_group_id, 'payroll:read')
));

create policy payroll_connections_read
on public.payroll_connections for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));
create policy payroll_connections_insert
on public.payroll_connections for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:manage')));
create policy payroll_connections_update
on public.payroll_connections for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:manage')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:manage')));

create policy payroll_company_bindings_read
on public.payroll_company_bindings for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));
create policy payroll_company_bindings_insert
on public.payroll_company_bindings for insert to authenticated
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:manage')));
create policy payroll_company_bindings_update
on public.payroll_company_bindings for update to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:manage')))
with check ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:manage')));

-- Sync records can contain provider-derived payloads. Keep their writes on the
-- server-side service boundary; authenticated users may only read scoped
-- projections. This also prevents credentials from being written into the
-- public JSON payload columns through the Data API.
create policy payroll_sync_runs_read
on public.payroll_sync_runs for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));

create policy payroll_sync_items_read
on public.payroll_sync_items for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));

create policy payroll_sync_issues_read
on public.payroll_sync_issues for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));

create policy payroll_audit_events_read
on public.payroll_audit_events for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));

revoke all on public.payroll_providers, public.payroll_connections, public.payroll_company_bindings,
  public.payroll_sync_runs, public.payroll_sync_items, public.payroll_sync_issues, public.payroll_audit_events
from public, anon, authenticated;
grant select on public.payroll_providers to authenticated;
grant select, insert, update on public.payroll_connections, public.payroll_company_bindings to authenticated;
grant select on public.payroll_sync_runs, public.payroll_sync_items, public.payroll_sync_issues to authenticated;
grant select on public.payroll_audit_events to authenticated;
grant select, insert, update on public.payroll_providers to service_role;
grant select, insert, update on public.payroll_connections, public.payroll_company_bindings,
  public.payroll_sync_runs, public.payroll_sync_items, public.payroll_sync_issues to service_role;
grant select, insert on public.payroll_audit_events to service_role;

insert into public.payroll_providers (code, name, capabilities)
values ('NMBRS', 'Nmbrs', '{}'::jsonb)
on conflict (code) do update set name = excluded.name, is_active = true;

revoke all on function internal_security.prevent_payroll_scope_change() from public, anon, authenticated;
revoke all on function internal_security.prevent_payroll_audit_mutation() from public, anon, authenticated;

comment on table public.payroll_providers is 'Providercatalogus voor Payroll-integraties; P0 seedt alleen de provideridentiteit.';
comment on table payroll_private.payroll_connection_credentials is 'Server-only versioned envelope ciphertext; geen authenticated grants en geen credentials in auditdata.';
comment on table public.payroll_audit_events is 'Append-only Payroll-governance-events; auditdata bevat nooit credentials.';

commit;
