begin;

-- P1 adds only the provider connection control plane. No employee or
-- employment data is read or written by this migration or its runtime.
update public.payroll_providers
set capabilities = '{"AUTH_OAUTH": true, "COMPANY_DISCOVERY": true, "CONNECTION_HEALTH": true}'::jsonb,
    is_active = true
where code = 'NMBRS';

-- Company discovery is metadata-only. The table is exposed for scoped reads,
-- while all writes stay behind the server-side Payroll service boundary.
create type public.payroll_provider_company_status as enum ('ACTIVE', 'INACTIVE');

create table public.payroll_provider_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  connection_id uuid not null,
  external_company_id text not null check (length(btrim(external_company_id)) between 1 and 200),
  external_company_number text check (external_company_number is null or length(btrim(external_company_number)) between 1 and 200),
  external_company_display_name text not null check (length(btrim(external_company_display_name)) between 1 and 240),
  external_debtor_id text check (external_debtor_id is null or length(btrim(external_debtor_id)) between 1 and 200),
  status public.payroll_provider_company_status not null default 'ACTIVE',
  provider_metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(provider_metadata) = 'object'
    and not (provider_metadata ?| array['access_token', 'refresh_token', 'client_secret', 'authorization_code'])
  ),
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payroll_provider_companies_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete restrict,
  constraint payroll_provider_companies_connection_fkey
    foreign key (tenant_id, hr_group_id, connection_id)
    references public.payroll_connections(tenant_id, hr_group_id, id) on delete restrict,
  constraint payroll_provider_companies_scope_id_key unique (tenant_id, hr_group_id, connection_id, id),
  constraint payroll_provider_companies_external_key unique (tenant_id, hr_group_id, connection_id, external_company_id)
);

create index payroll_provider_companies_status_idx
  on public.payroll_provider_companies (tenant_id, hr_group_id, status, last_seen_at desc);

create trigger set_payroll_provider_companies_updated_at
before update on public.payroll_provider_companies
for each row execute function internal_security.set_updated_at();

create trigger prevent_payroll_provider_companies_scope_change
before update of tenant_id, hr_group_id on public.payroll_provider_companies
for each row execute function internal_security.prevent_payroll_scope_change();

create function internal_security.prevent_payroll_provider_company_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.connection_id is distinct from old.connection_id
    or new.external_company_id is distinct from old.external_company_id then
    raise exception 'De provideradministratie-identiteit kan niet worden gewijzigd.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger prevent_payroll_provider_company_identity_change
before update of connection_id, external_company_id on public.payroll_provider_companies
for each row execute function internal_security.prevent_payroll_provider_company_identity_change();

alter table public.payroll_provider_companies enable row level security;

create policy payroll_provider_companies_read
on public.payroll_provider_companies for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'payroll:read')));

revoke all on public.payroll_provider_companies from public, anon, authenticated;
grant select on public.payroll_provider_companies to authenticated;
grant select, insert, update, delete on public.payroll_provider_companies to service_role;

-- OAuth state is a server-only CSRF/session bridge. Only a SHA-256 state hash
-- is stored; the browser value is held in an HttpOnly cookie and is never
-- persisted in plaintext.
create table payroll_private.payroll_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  provider_id uuid not null,
  connection_id uuid,
  initiated_by_user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null check (length(btrim(redirect_uri)) between 1 and 500),
  requested_scopes text[] not null check (cardinality(requested_scopes) between 1 and 20),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_oauth_states_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id) on delete cascade,
  constraint payroll_oauth_states_provider_fkey
    foreign key (provider_id)
    references public.payroll_providers(id) on delete restrict,
  constraint payroll_oauth_states_connection_fkey
    foreign key (tenant_id, hr_group_id, connection_id)
    references public.payroll_connections(tenant_id, hr_group_id, id) on delete cascade,
  constraint payroll_oauth_states_expiry_check check (expires_at > created_at)
);

create index payroll_oauth_states_expiry_idx
  on payroll_private.payroll_oauth_states (expires_at)
  where consumed_at is null;
create index payroll_oauth_states_connection_idx
  on payroll_private.payroll_oauth_states (tenant_id, hr_group_id, connection_id)
  where connection_id is not null;

alter table payroll_private.payroll_oauth_states enable row level security;
revoke all on payroll_private.payroll_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on payroll_private.payroll_oauth_states to service_role;

-- Critical connection and binding state is server-owned in P1. Authenticated
-- users keep scoped read access; the API service performs the permission check
-- before using its service-role write path.
drop policy if exists payroll_connections_insert on public.payroll_connections;
drop policy if exists payroll_connections_update on public.payroll_connections;
drop policy if exists payroll_company_bindings_insert on public.payroll_company_bindings;
drop policy if exists payroll_company_bindings_update on public.payroll_company_bindings;
revoke insert, update on public.payroll_connections, public.payroll_company_bindings from authenticated;
grant select on public.payroll_connections, public.payroll_company_bindings to authenticated;

revoke all on function internal_security.prevent_payroll_provider_company_identity_change() from public, anon, authenticated;

comment on table public.payroll_provider_companies is 'Provider-side company metadata only; P1 never synchronizes employees or employments.';
comment on table payroll_private.payroll_oauth_states is 'Server-only, one-time OAuth state hashes; no browser/API grants.';

commit;
