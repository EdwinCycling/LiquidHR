alter function public.get_platform_control_snapshot(uuid)
  set schema internal_security;
alter function public.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb)
  set schema internal_security;
alter function public.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text)
  set schema internal_security;
alter function public.capture_tenant_usage_snapshot(uuid)
  set schema internal_security;

revoke all on function internal_security.get_platform_control_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function internal_security.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb)
  from public, anon, authenticated;
revoke all on function internal_security.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text)
  from public, anon, authenticated;
revoke all on function internal_security.capture_tenant_usage_snapshot(uuid)
  from public, anon, authenticated;

grant execute on function internal_security.get_platform_control_snapshot(uuid) to authenticated;
grant execute on function internal_security.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb) to authenticated;
grant execute on function internal_security.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text) to authenticated;
grant execute on function internal_security.capture_tenant_usage_snapshot(uuid) to authenticated;

create function public.get_platform_control_snapshot(requested_tenant_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.get_platform_control_snapshot(requested_tenant_id);
$$;

create function public.onboard_platform_tenant(
  requested_name text,
  requested_slug text,
  requested_administration_mode public.administration_mode,
  requested_primary_contact_email text,
  requested_administrations jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.onboard_platform_tenant(
    requested_name,
    requested_slug,
    requested_administration_mode,
    requested_primary_contact_email,
    requested_administrations
  );
$$;

create function public.change_tenant_lifecycle(
  requested_tenant_id uuid,
  requested_status public.tenant_lifecycle_status,
  requested_reason text
)
returns jsonb
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.change_tenant_lifecycle(
    requested_tenant_id,
    requested_status,
    requested_reason
  );
$$;

create function public.capture_tenant_usage_snapshot(requested_tenant_id uuid)
returns uuid
language sql
volatile
security invoker
set search_path = pg_catalog, public, internal_security, pg_temp
as $$
  select internal_security.capture_tenant_usage_snapshot(requested_tenant_id);
$$;

revoke all on function public.get_platform_control_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb) from public, anon, authenticated;
revoke all on function public.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text) from public, anon, authenticated;
revoke all on function public.capture_tenant_usage_snapshot(uuid) from public, anon, authenticated;

grant execute on function public.get_platform_control_snapshot(uuid) to authenticated;
grant execute on function public.onboard_platform_tenant(text, text, public.administration_mode, text, jsonb) to authenticated;
grant execute on function public.change_tenant_lifecycle(uuid, public.tenant_lifecycle_status, text) to authenticated;
grant execute on function public.capture_tenant_usage_snapshot(uuid) to authenticated;
