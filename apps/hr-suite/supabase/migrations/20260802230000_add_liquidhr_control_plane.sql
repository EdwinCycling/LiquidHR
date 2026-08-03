create type public.platform_operator_role as enum ('OWNER', 'OPERATOR', 'AUDITOR');
create type public.tenant_lifecycle_status as enum (
  'PROVISIONING',
  'ACTIVE',
  'PAUSED',
  'TERMINATING',
  'TERMINATED'
);

create table public.platform_operators (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  role public.platform_operator_role not null default 'AUDITOR',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint platform_operators_display_name_not_blank check (btrim(display_name) <> '')
);

create trigger set_platform_operators_updated_at
before update on public.platform_operators
for each row execute function internal_security.set_updated_at();

create table public.tenant_lifecycle (
  tenant_id uuid primary key references public.tenants(id) on delete restrict,
  status public.tenant_lifecycle_status not null default 'PROVISIONING',
  status_reason text,
  activated_at timestamptz,
  paused_at timestamptz,
  termination_requested_at timestamptz,
  terminated_at timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenant_lifecycle_reason_not_blank check (
    status_reason is null or btrim(status_reason) <> ''
  ),
  constraint tenant_lifecycle_terminated_timestamp check (
    status <> 'TERMINATED' or terminated_at is not null
  )
);

create trigger set_tenant_lifecycle_updated_at
before update on public.tenant_lifecycle
for each row execute function internal_security.set_updated_at();

insert into public.tenant_lifecycle (
  tenant_id,
  status,
  status_reason,
  activated_at
)
select
  tenant.id,
  case when tenant.is_active then 'ACTIVE'::public.tenant_lifecycle_status
       else 'PAUSED'::public.tenant_lifecycle_status end,
  'Bestaande tenant overgenomen bij introductie van het control plane.',
  case when tenant.is_active then tenant.created_at else null end
from public.tenants tenant
on conflict (tenant_id) do nothing;

create table public.tenant_onboarding_contacts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  primary_contact_email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tenant_onboarding_contacts_email_not_blank check (
    btrim(primary_contact_email) <> '' and primary_contact_email = lower(primary_contact_email)
  )
);

create trigger set_tenant_onboarding_contacts_updated_at
before update on public.tenant_onboarding_contacts
for each row execute function internal_security.set_updated_at();

create table public.tenant_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  measured_on date not null default current_date,
  administration_count integer not null default 0,
  employee_count integer not null default 0,
  active_employment_count integer not null default 0,
  user_count integer not null default 0,
  storage_bytes bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint tenant_usage_snapshots_non_negative check (
    administration_count >= 0
    and employee_count >= 0
    and active_employment_count >= 0
    and user_count >= 0
    and storage_bytes >= 0
  ),
  unique (tenant_id, measured_on)
);

create index tenant_usage_snapshots_tenant_measured_idx
  on public.tenant_usage_snapshots (tenant_id, measured_on desc);

create table public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  constraint platform_audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint platform_audit_logs_reason_not_blank check (reason is null or btrim(reason) <> '')
);

create index platform_audit_logs_tenant_created_idx
  on public.platform_audit_logs (tenant_id, created_at desc);
create index platform_audit_logs_actor_created_idx
  on public.platform_audit_logs (actor_user_id, created_at desc);

create or replace function internal_security.is_platform_operator(
  allowed_roles public.platform_operator_role[] default array[
    'OWNER'::public.platform_operator_role,
    'OPERATOR'::public.platform_operator_role,
    'AUDITOR'::public.platform_operator_role
  ]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.platform_operators platform_operator
    where platform_operator.user_id = auth.uid()
      and platform_operator.is_active
      and platform_operator.role = any(allowed_roles)
  );
$$;

alter table public.platform_operators enable row level security;
alter table public.tenant_lifecycle enable row level security;
alter table public.tenant_onboarding_contacts enable row level security;
alter table public.tenant_usage_snapshots enable row level security;
alter table public.platform_audit_logs enable row level security;

create policy platform_operators_read_control_plane
on public.platform_operators for select to authenticated
using (internal_security.is_platform_operator());

create policy tenant_lifecycle_read_control_plane
on public.tenant_lifecycle for select to authenticated
using (internal_security.is_platform_operator());

create policy tenant_onboarding_contacts_read_control_plane
on public.tenant_onboarding_contacts for select to authenticated
using (internal_security.is_platform_operator());

create policy tenant_usage_snapshots_read_control_plane
on public.tenant_usage_snapshots for select to authenticated
using (internal_security.is_platform_operator());

create policy platform_audit_logs_read_control_plane
on public.platform_audit_logs for select to authenticated
using (internal_security.is_platform_operator());

create or replace function public.get_platform_control_snapshot(
  requested_tenant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, internal_security, auth, storage, pg_temp
as $$
declare
  operator_row public.platform_operators%rowtype;
  result jsonb;
begin
  select platform_operator.* into operator_row
  from public.platform_operators platform_operator
  where platform_operator.user_id = auth.uid()
    and platform_operator.is_active;

  if operator_row.user_id is null then
    raise exception 'PLATFORM_ACCESS_DENIED' using errcode = '42501';
  end if;

  with tenant_metrics as (
    select
      tenant.id,
      tenant.name,
      tenant.slug,
      coalesce(lifecycle.status, case when tenant.is_active then 'ACTIVE'::public.tenant_lifecycle_status else 'PAUSED'::public.tenant_lifecycle_status end) as lifecycle_status,
      tenant.administration_mode,
      tenant.created_at,
      greatest(tenant.updated_at, coalesce(lifecycle.updated_at, tenant.updated_at)) as updated_at,
      contact.primary_contact_email,
      (select count(*)::integer from public.administrations administration where administration.tenant_id = tenant.id) as administration_count,
      (select count(*)::integer from public.employees employee where employee.tenant_id = tenant.id and employee.deleted_at is null) as employee_count,
      (select count(*)::integer from public.employments employment where employment.tenant_id = tenant.id and employment.deleted_at is null and employment.record_status = 'CONFIRMED' and employment.starts_on <= current_date and (employment.ends_on is null or employment.ends_on >= current_date)) as active_employment_count,
      (select count(distinct access.user_id)::integer from public.user_access access where access.tenant_id = tenant.id and access.is_active) as user_count,
      coalesce((
        select sum(
          case when coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
            then (object.metadata ->> 'size')::bigint else 0 end
        )
        from storage.objects object
        where split_part(object.name, '/', 1) = tenant.id::text
      ), 0)::bigint as storage_bytes
    from public.tenants tenant
    left join public.tenant_lifecycle lifecycle on lifecycle.tenant_id = tenant.id
    left join public.tenant_onboarding_contacts contact on contact.tenant_id = tenant.id
    where requested_tenant_id is null or tenant.id = requested_tenant_id
  ), audit_rows as (
    select audit.id, audit.tenant_id, tenant.name as tenant_name, audit.action,
      audit.reason, coalesce(platform_operator.display_name, 'Onbekende beheerder') as actor_name,
      audit.created_at
    from public.platform_audit_logs audit
    left join public.tenants tenant on tenant.id = audit.tenant_id
    left join public.platform_operators platform_operator on platform_operator.user_id = audit.actor_user_id
    where requested_tenant_id is null or audit.tenant_id = requested_tenant_id
    order by audit.created_at desc
    limit 50
  )
  select jsonb_build_object(
    'operator', jsonb_build_object('displayName', operator_row.display_name, 'role', operator_row.role),
    'totals', jsonb_build_object(
      'tenants', (select count(*) from tenant_metrics),
      'active', (select count(*) from tenant_metrics where lifecycle_status = 'ACTIVE'),
      'paused', (select count(*) from tenant_metrics where lifecycle_status = 'PAUSED'),
      'employees', coalesce((select sum(employee_count) from tenant_metrics), 0),
      'users', coalesce((select sum(user_count) from tenant_metrics), 0),
      'storageBytes', coalesce((select sum(storage_bytes) from tenant_metrics), 0)
    ),
    'tenants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', metric.id,
      'name', metric.name,
      'slug', metric.slug,
      'lifecycleStatus', metric.lifecycle_status,
      'administrationMode', metric.administration_mode,
      'administrationCount', metric.administration_count,
      'employeeCount', metric.employee_count,
      'activeEmploymentCount', metric.active_employment_count,
      'userCount', metric.user_count,
      'storageBytes', metric.storage_bytes,
      'createdAt', metric.created_at,
      'updatedAt', metric.updated_at,
      'primaryContactEmail', metric.primary_contact_email
    ) order by metric.name) from tenant_metrics metric), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object(
      'id', audit.id,
      'tenantId', audit.tenant_id,
      'tenantName', audit.tenant_name,
      'action', audit.action,
      'reason', audit.reason,
      'actorName', audit.actor_name,
      'createdAt', audit.created_at
    ) order by audit.created_at desc) from audit_rows audit), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.onboard_platform_tenant(
  requested_name text,
  requested_slug text,
  requested_administration_mode public.administration_mode,
  requested_primary_contact_email text,
  requested_administrations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  new_tenant_id uuid;
  administration jsonb;
begin
  if not internal_security.is_platform_operator(array['OWNER'::public.platform_operator_role, 'OPERATOR'::public.platform_operator_role]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;
  if btrim(requested_name) = '' or requested_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_TENANT_INPUT' using errcode = '22023';
  end if;
  if jsonb_typeof(requested_administrations) <> 'array' or jsonb_array_length(requested_administrations) < 1 then
    raise exception 'AT_LEAST_ONE_ADMINISTRATION_REQUIRED' using errcode = '22023';
  end if;

  insert into public.tenants (name, slug, is_active, administration_mode, sharing_mode, combined_at)
  values (
    btrim(requested_name),
    lower(btrim(requested_slug)),
    false,
    requested_administration_mode,
    case when requested_administration_mode = 'COMBINED' then 'SHARED_COLLEAGUES'::public.sharing_mode else 'FULLY_ISOLATED'::public.sharing_mode end,
    case when requested_administration_mode = 'COMBINED' then timezone('utc', now()) else null end
  ) returning id into new_tenant_id;

  for administration in select value from jsonb_array_elements(requested_administrations)
  loop
    if coalesce(btrim(administration ->> 'code'), '') !~ '^[A-Za-z0-9_-]+$'
      or coalesce(btrim(administration ->> 'name'), '') = '' then
      raise exception 'INVALID_ADMINISTRATION_INPUT' using errcode = '22023';
    end if;
    insert into public.administrations (tenant_id, code, name)
    values (
      new_tenant_id,
      upper(btrim(administration ->> 'code')),
      btrim(administration ->> 'name')
    );
  end loop;

  insert into public.tenant_lifecycle (tenant_id, status, status_reason, changed_by)
  values (new_tenant_id, 'PROVISIONING', 'Nieuwe klantomgeving aangemaakt.', auth.uid());

  insert into public.tenant_onboarding_contacts (tenant_id, primary_contact_email, created_by)
  values (new_tenant_id, lower(btrim(requested_primary_contact_email)), auth.uid());

  insert into public.platform_audit_logs (tenant_id, actor_user_id, action, reason, after_state)
  values (
    new_tenant_id,
    auth.uid(),
    'TENANT_CREATED',
    'Nieuwe klantomgeving aangemaakt.',
    jsonb_build_object('name', btrim(requested_name), 'administrationMode', requested_administration_mode)
  );

  return new_tenant_id;
end;
$$;

create or replace function public.change_tenant_lifecycle(
  requested_tenant_id uuid,
  requested_status public.tenant_lifecycle_status,
  requested_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, internal_security, auth, pg_temp
as $$
declare
  current_row public.tenant_lifecycle%rowtype;
  allowed boolean := false;
begin
  if not internal_security.is_platform_operator(array['OWNER'::public.platform_operator_role, 'OPERATOR'::public.platform_operator_role]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;
  if length(btrim(requested_reason)) < 5 then
    raise exception 'LIFECYCLE_REASON_REQUIRED' using errcode = '22023';
  end if;

  select lifecycle.* into current_row
  from public.tenant_lifecycle lifecycle
  where lifecycle.tenant_id = requested_tenant_id
  for update;
  if current_row.tenant_id is null then
    raise exception 'TENANT_LIFECYCLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  allowed := case current_row.status
    when 'PROVISIONING' then requested_status in ('ACTIVE', 'TERMINATING')
    when 'ACTIVE' then requested_status in ('PAUSED', 'TERMINATING')
    when 'PAUSED' then requested_status in ('ACTIVE', 'TERMINATING')
    when 'TERMINATING' then requested_status in ('ACTIVE', 'TERMINATED')
    when 'TERMINATED' then false
    else false
  end;
  if not allowed then
    raise exception 'INVALID_LIFECYCLE_TRANSITION: % -> %', current_row.status, requested_status using errcode = '22023';
  end if;

  update public.tenant_lifecycle
  set status = requested_status,
      status_reason = btrim(requested_reason),
      changed_by = auth.uid(),
      activated_at = case when requested_status = 'ACTIVE' then timezone('utc', now()) else activated_at end,
      paused_at = case when requested_status = 'PAUSED' then timezone('utc', now()) else paused_at end,
      termination_requested_at = case when requested_status = 'TERMINATING' then timezone('utc', now()) else termination_requested_at end,
      terminated_at = case when requested_status = 'TERMINATED' then timezone('utc', now()) else terminated_at end
  where tenant_id = requested_tenant_id;

  update public.tenants
  set is_active = requested_status = 'ACTIVE'
  where id = requested_tenant_id;

  insert into public.platform_audit_logs (tenant_id, actor_user_id, action, reason, before_state, after_state)
  values (
    requested_tenant_id,
    auth.uid(),
    'TENANT_LIFECYCLE_CHANGED',
    btrim(requested_reason),
    jsonb_build_object('status', current_row.status),
    jsonb_build_object('status', requested_status)
  );

  return jsonb_build_object('tenantId', requested_tenant_id, 'status', requested_status);
end;
$$;

create or replace function public.capture_tenant_usage_snapshot(
  requested_tenant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, internal_security, auth, storage, pg_temp
as $$
declare
  snapshot_id uuid;
begin
  if not internal_security.is_platform_operator(array['OWNER'::public.platform_operator_role, 'OPERATOR'::public.platform_operator_role]) then
    raise exception 'PLATFORM_WRITE_ACCESS_DENIED' using errcode = '42501';
  end if;

  insert into public.tenant_usage_snapshots (
    tenant_id, measured_on, administration_count, employee_count,
    active_employment_count, user_count, storage_bytes, created_by
  )
  select
    tenant.id,
    current_date,
    (select count(*) from public.administrations administration where administration.tenant_id = tenant.id),
    (select count(*) from public.employees employee where employee.tenant_id = tenant.id and employee.deleted_at is null),
    (select count(*) from public.employments employment where employment.tenant_id = tenant.id and employment.deleted_at is null and employment.record_status = 'CONFIRMED' and employment.starts_on <= current_date and (employment.ends_on is null or employment.ends_on >= current_date)),
    (select count(distinct access.user_id) from public.user_access access where access.tenant_id = tenant.id and access.is_active),
    coalesce((select sum(case when coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$' then (object.metadata ->> 'size')::bigint else 0 end) from storage.objects object where split_part(object.name, '/', 1) = tenant.id::text), 0),
    auth.uid()
  from public.tenants tenant
  where tenant.id = requested_tenant_id
  on conflict (tenant_id, measured_on) do update
  set administration_count = excluded.administration_count,
      employee_count = excluded.employee_count,
      active_employment_count = excluded.active_employment_count,
      user_count = excluded.user_count,
      storage_bytes = excluded.storage_bytes,
      created_by = excluded.created_by,
      created_at = timezone('utc', now())
  returning id into snapshot_id;

  if snapshot_id is null then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return snapshot_id;
end;
$$;

revoke all on table public.platform_operators from public, anon, authenticated;
revoke all on table public.tenant_lifecycle from public, anon, authenticated;
revoke all on table public.tenant_onboarding_contacts from public, anon, authenticated;
revoke all on table public.tenant_usage_snapshots from public, anon, authenticated;
revoke all on table public.platform_audit_logs from public, anon, authenticated;
grant select on table public.platform_operators to authenticated;
grant select on table public.tenant_lifecycle to authenticated;
grant select on table public.tenant_onboarding_contacts to authenticated;
grant select on table public.tenant_usage_snapshots to authenticated;
grant select on table public.platform_audit_logs to authenticated;

revoke all on function internal_security.is_platform_operator(public.platform_operator_role[]) from public, anon, authenticated;
grant execute on function internal_security.is_platform_operator(public.platform_operator_role[]) to authenticated;

revoke all on function public.get_platform_control_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb) from public, anon, authenticated;
revoke all on function public.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text) from public, anon, authenticated;
revoke all on function public.capture_tenant_usage_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.get_platform_control_snapshot(uuid) to authenticated;
grant execute on function public.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb) to authenticated;
grant execute on function public.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text) to authenticated;
grant execute on function public.capture_tenant_usage_snapshot(uuid) to authenticated;
