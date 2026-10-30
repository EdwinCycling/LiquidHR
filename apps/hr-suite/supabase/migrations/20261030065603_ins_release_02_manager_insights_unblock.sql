begin;


-- This private helper reads a single field from absence_settings after
-- independently enforcing the active HR-group report permission. It returns
-- configured=false only when the group truly has no settings row.
create or replace function internal_security.read_frequent_absence_threshold(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns table (
  configured boolean,
  frequent_absence_threshold smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  matching_settings_count integer;
  configured_threshold smallint;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  if requested_tenant_id is null or requested_hr_group_id is null then
    raise exception 'INSIGHTS_THRESHOLD_SCOPE_INVALID' using errcode = '22023';
  end if;

  if not internal_security.current_user_has_hr_group_permission(
    requested_tenant_id,
    requested_hr_group_id,
    'report-absence:read'
  ) then
    raise exception 'INSIGHTS_THRESHOLD_FORBIDDEN' using errcode = '42501';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.max(settings.frequent_absence_threshold)
  into matching_settings_count, configured_threshold
  from public.absence_settings as settings
  where settings.tenant_id = requested_tenant_id
    and settings.hr_group_id = requested_hr_group_id;

  if matching_settings_count > 1 then
    raise exception 'INSIGHTS_THRESHOLD_SETTINGS_INCONSISTENT' using errcode = '55000';
  end if;

  if matching_settings_count = 1
    and (configured_threshold is null or configured_threshold not between 1 and 20) then
    raise exception 'INSIGHTS_THRESHOLD_SETTINGS_INVALID' using errcode = '55000';
  end if;

  configured := matching_settings_count = 1;
  frequent_absence_threshold := configured_threshold;
  return next;
end;
$$;

revoke all on function internal_security.read_frequent_absence_threshold(uuid, uuid)
  from public, anon, authenticated, service_role;
grant usage on schema internal_security to authenticated;
grant execute on function internal_security.read_frequent_absence_threshold(uuid, uuid)
  to authenticated;

-- The exposed entry point is SECURITY INVOKER and returns only the threshold
-- projection. The helper above owns the narrowly checked RLS bypass.
create or replace function public.get_frequent_absence_threshold(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns table (
  configured boolean,
  frequent_absence_threshold smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select projection.configured, projection.frequent_absence_threshold
  from internal_security.read_frequent_absence_threshold(
    requested_tenant_id,
    requested_hr_group_id
  ) as projection;
$$;

revoke all on function public.get_frequent_absence_threshold(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_frequent_absence_threshold(uuid, uuid)
  to authenticated;

comment on function public.get_frequent_absence_threshold(uuid, uuid) is
  'Returns only the configured frequent-absence threshold for an authorized tenant and HR group.';

commit;
