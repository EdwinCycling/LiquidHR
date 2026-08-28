begin;

-- Wave 1A stores execution state and governance metadata only. Prompts,
-- responses and raw authorized HR-context are intentionally not persisted.
create table public.ai_invocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  administration_id uuid,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_employee_id uuid,
  feature_code text not null check (char_length(btrim(feature_code)) between 1 and 120),
  business_object_type text not null check (char_length(btrim(business_object_type)) between 1 and 120),
  business_object_id text not null check (char_length(btrim(business_object_id)) between 1 and 200),
  business_permission_code text check (business_permission_code is null or char_length(btrim(business_permission_code)) between 1 and 160),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 200),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  correlation_id uuid not null,
  config_version text not null check (char_length(btrim(config_version)) between 1 and 160),
  prompt_template_version text not null check (char_length(btrim(prompt_template_version)) between 1 and 160),
  quality_profile text check (quality_profile is null or quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH')),
  writing_style text check (writing_style is null or writing_style in ('FORMAL', 'PLAIN', 'WARM', 'DIRECT')),
  execution_status text not null default 'RECEIVED' check (execution_status in ('RECEIVED', 'AUTHORIZED', 'RESERVING', 'CONTEXT_LOADING', 'EXECUTING', 'VALIDATING', 'SETTLING', 'RELEASING', 'SUCCEEDED', 'FAILED', 'REJECTED')),
  result_status text not null default 'PENDING' check (result_status in ('PENDING', 'VALIDATED', 'NOT_AVAILABLE', 'INVALID', 'FAILED')),
  feedback_outcome text,
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  charged_credits integer not null default 0 check (charged_credits >= 0),
  provider_code text,
  model_family text,
  reasoning_profile text,
  provider_request_id text,
  provider_input_units integer check (provider_input_units is null or provider_input_units >= 0),
  provider_output_units integer check (provider_output_units is null or provider_output_units >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  failure_code text check (failure_code is null or failure_code in ('UNAUTHORIZED', 'FEATURE_UNAVAILABLE', 'FEATURE_NOT_ENTITLED', 'AI_DISABLED', 'QUOTA_REACHED', 'CREDITS_EXHAUSTED', 'CREDITS_UNAVAILABLE', 'DUPLICATE_IN_FLIGHT', 'DUPLICATE_COMPLETED', 'IDEMPOTENCY_KEY_REUSED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'INVALID_RESULT', 'INTERNAL_CONFIGURATION_ERROR')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  finished_at timestamptz,
  constraint ai_invocations_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_invocations_tenant_hr_group_id_key
    unique (tenant_id, hr_group_id, id),
  constraint ai_invocations_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint ai_invocations_actor_employee_same_tenant_fkey
    foreign key (tenant_id, actor_employee_id)
    references public.employees(tenant_id, id)
    on delete set null (actor_employee_id),
  constraint ai_invocations_idempotency_key_key
    unique (tenant_id, hr_group_id, actor_user_id, idempotency_key)
);

create index ai_invocations_scope_status_idx
  on public.ai_invocations (tenant_id, hr_group_id, execution_status, created_at desc);
create index ai_invocations_actor_idx
  on public.ai_invocations (tenant_id, hr_group_id, actor_user_id, created_at desc);

create table public.ai_technical_usage (
  id uuid primary key default gen_random_uuid(),
  invocation_id uuid not null unique references public.ai_invocations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  feature_code text not null check (char_length(btrim(feature_code)) between 1 and 120),
  quality_profile text not null check (quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH')),
  outcome text not null check (outcome in ('SUCCEEDED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'INVALID_RESULT')),
  provider_code text,
  model_family text,
  reasoning_profile text,
  provider_request_id text,
  provider_input_units integer check (provider_input_units is null or provider_input_units >= 0),
  provider_output_units integer check (provider_output_units is null or provider_output_units >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  correlation_id uuid not null,
  config_version text not null,
  prompt_template_version text not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  constraint ai_technical_usage_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_technical_usage_invocation_scope_fkey
    foreign key (tenant_id, hr_group_id, invocation_id)
    references public.ai_invocations(tenant_id, hr_group_id, id)
    on delete cascade
);

create index ai_technical_usage_scope_recorded_idx
  on public.ai_technical_usage (tenant_id, hr_group_id, recorded_at desc);

create table public.ai_business_audit (
  id uuid primary key default gen_random_uuid(),
  invocation_id uuid not null unique references public.ai_invocations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  hr_group_id uuid not null,
  administration_id uuid,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_employee_id uuid,
  feature_code text not null check (char_length(btrim(feature_code)) between 1 and 120),
  business_object_type text not null,
  business_object_id text not null,
  action text not null check (action = 'AI_INVOCATION'),
  quality_profile text check (quality_profile is null or quality_profile in ('EFFICIENT', 'BALANCED', 'IN_DEPTH')),
  writing_style text check (writing_style is null or writing_style in ('FORMAL', 'PLAIN', 'WARM', 'DIRECT')),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  charged_credits integer not null default 0 check (charged_credits >= 0),
  status text not null check (status in ('SUCCEEDED', 'FAILED', 'REJECTED')),
  failure_code text check (failure_code is null or failure_code in ('UNAUTHORIZED', 'FEATURE_UNAVAILABLE', 'FEATURE_NOT_ENTITLED', 'AI_DISABLED', 'QUOTA_REACHED', 'CREDITS_EXHAUSTED', 'CREDITS_UNAVAILABLE', 'DUPLICATE_IN_FLIGHT', 'DUPLICATE_COMPLETED', 'IDEMPOTENCY_KEY_REUSED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED', 'INVALID_RESULT', 'INTERNAL_CONFIGURATION_ERROR')),
  correlation_id uuid not null,
  config_version text not null,
  prompt_template_version text not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  constraint ai_business_audit_tenant_hr_group_fkey
    foreign key (tenant_id, hr_group_id)
    references public.hr_groups(tenant_id, id)
    on delete restrict,
  constraint ai_business_audit_invocation_scope_fkey
    foreign key (tenant_id, hr_group_id, invocation_id)
    references public.ai_invocations(tenant_id, hr_group_id, id)
    on delete cascade,
  constraint ai_business_audit_administration_fkey
    foreign key (tenant_id, hr_group_id, administration_id)
    references public.administrations(tenant_id, hr_group_id, id)
    on delete restrict,
  constraint ai_business_audit_actor_employee_same_tenant_fkey
    foreign key (tenant_id, actor_employee_id)
    references public.employees(tenant_id, id)
    on delete set null (actor_employee_id)
);

create index ai_business_audit_scope_recorded_idx
  on public.ai_business_audit (tenant_id, hr_group_id, recorded_at desc);

create or replace function internal_security.prevent_ai_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'AI_AUDIT_APPEND_ONLY' using errcode = 'P0001';
  return old;
end;
$$;

revoke all on function internal_security.prevent_ai_audit_mutation() from public, anon, authenticated;

create trigger ai_technical_usage_append_only
before update or delete on public.ai_technical_usage
for each row execute function internal_security.prevent_ai_audit_mutation();

create trigger ai_business_audit_append_only
before update or delete on public.ai_business_audit
for each row execute function internal_security.prevent_ai_audit_mutation();

create trigger ai_invocations_updated_at
before update on public.ai_invocations
for each row execute function internal_security.set_updated_at();

insert into public.permissions (code, name, category, description)
values
  ('ai:use', 'AI gebruiken', 'AI', 'Gebruikt een expliciet toegestane AI-capability binnen de eigen scope.'),
  ('ai:manage', 'AI beheren', 'AI', 'Beheert AI-enablement en governance binnen de eigen scope.'),
  ('ai:usage-read', 'AI-gebruik lezen', 'AI', 'Leest technische AI-gebruiksrapportage binnen de eigen scope.'),
  ('ai:audit-read', 'AI-audit lezen', 'AI', 'Leest business-audit van AI-invocations binnen de eigen scope.'),
  ('ai:credits-manage', 'Liquid Credits beheren', 'AI', 'Beheert Liquid Credits-governance binnen de eigen scope.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN')
  and permission.code in ('ai:manage', 'ai:usage-read', 'ai:audit-read', 'ai:credits-manage')
on conflict do nothing;

insert into public.role_permissions (management_role_id, permission_id)
select role.id, permission.id
from public.management_roles role
cross join public.permissions permission
where role.code in ('TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR')
  and permission.code = 'ai:use'
on conflict do nothing;

alter table public.ai_invocations enable row level security;
alter table public.ai_technical_usage enable row level security;
alter table public.ai_business_audit enable row level security;

create policy ai_invocations_select_scoped
on public.ai_invocations for select to authenticated
using (
  (select internal_security.has_hr_group_access(tenant_id, hr_group_id))
  and (
    actor_user_id = (select auth.uid())
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read'))
    or (select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:audit-read'))
  )
);

create policy ai_technical_usage_select_scoped
on public.ai_technical_usage for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read')));

create policy ai_business_audit_select_scoped
on public.ai_business_audit for select to authenticated
using ((select internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:audit-read')));

revoke all on table public.ai_invocations, public.ai_technical_usage, public.ai_business_audit from public, anon, authenticated;
grant select, insert, update on table public.ai_invocations to service_role;
grant select, insert on table public.ai_technical_usage, public.ai_business_audit to service_role;

comment on table public.ai_invocations is 'AI execution state and non-content governance metadata; prompts, responses and raw HR-context are excluded.';
comment on table public.ai_technical_usage is 'Internal technical AI usage metadata, separate from business audit.';
comment on table public.ai_business_audit is 'Append-only business audit for AI invocations without prompt or response content.';

commit;
