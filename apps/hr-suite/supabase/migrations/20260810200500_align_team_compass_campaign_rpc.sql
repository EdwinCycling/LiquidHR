-- Maak de create/update-semantiek van de campagne-RPC zichtbaar in de
-- gegenereerde TypeScript-types: campaign_id en expected_version zijn bij
-- aanmaken optioneel. De bestaande implementatie verhuist naar het interne
-- schema; de publieke wrapper blijft de enige expliciet verleende ingang.

revoke all on function public.save_team_compass_campaign(uuid, uuid, uuid, integer, jsonb)
  from public, anon, authenticated;

alter function public.save_team_compass_campaign(uuid, uuid, uuid, integer, jsonb)
  set schema internal_security;

alter function internal_security.save_team_compass_campaign(uuid, uuid, uuid, integer, jsonb)
  rename to execute_save_team_compass_campaign;

revoke all on function internal_security.execute_save_team_compass_campaign(uuid, uuid, uuid, integer, jsonb)
  from public, anon, authenticated;

create function public.save_team_compass_campaign(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_payload jsonb,
  requested_campaign_id uuid default null,
  requested_expected_version integer default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select internal_security.execute_save_team_compass_campaign(
    requested_tenant_id,
    requested_hr_group_id,
    requested_campaign_id,
    requested_expected_version,
    requested_payload
  );
$$;

revoke all on function public.save_team_compass_campaign(uuid, uuid, jsonb, uuid, integer)
  from public, anon;
grant execute on function public.save_team_compass_campaign(uuid, uuid, jsonb, uuid, integer)
  to authenticated;

comment on function public.save_team_compass_campaign(uuid, uuid, jsonb, uuid, integer) is
  'Typed Teamkompas campaign create/update boundary; tenant and permission checks are enforced by the internal implementation.';
