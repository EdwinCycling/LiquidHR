-- Een stale optimistic version is een applicatieconflict, geen serialisatiefout.
-- P0001 voorkomt dat de Data API deze verwachte fout als retrybare 40001 behandelt.
create or replace function internal_security.transition_journey_internal(requested_journey_id uuid, requested_expected_version integer, requested_action text)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare actor_id uuid := auth.uid(); journey_row public.journeys%rowtype; target_status public.journey_status;
begin
  if actor_id is null then raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  select * into journey_row from public.journeys where id = requested_journey_id for update;
  if not found then raise exception 'JOURNEY_NOT_FOUND' using errcode = 'P0002'; end if;
  if not internal_security.current_user_has_hr_group_permission(journey_row.tenant_id, journey_row.hr_group_id, 'journey:write') then raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501'; end if;
  if journey_row.version <> requested_expected_version then raise exception 'JOURNEY_VERSION_CONFLICT' using errcode = 'P0001'; end if;
  target_status := case requested_action
    when 'PAUSE' then 'PAUSED'::public.journey_status when 'RESUME' then 'ACTIVE'::public.journey_status
    when 'CANCEL' then 'CANCELLED'::public.journey_status when 'COMPLETE' then 'COMPLETED'::public.journey_status
    else null end;
  if target_status is null
     or (requested_action = 'PAUSE' and journey_row.status not in ('PLANNED', 'ACTIVE'))
     or (requested_action = 'RESUME' and journey_row.status <> 'PAUSED')
     or (requested_action in ('CANCEL', 'COMPLETE') and journey_row.status not in ('PLANNED', 'ACTIVE', 'PAUSED')) then
    raise exception 'JOURNEY_TRANSITION_INVALID' using errcode = '55000';
  end if;
  update public.journeys set status = target_status, version = version + 1, updated_by_user_id = actor_id, updated_at = timezone('utc', now()),
    paused_at = case when target_status = 'PAUSED' then timezone('utc', now()) else null end,
    completed_at = case when target_status = 'COMPLETED' then timezone('utc', now()) else null end,
    cancelled_at = case when target_status = 'CANCELLED' then timezone('utc', now()) else null end
  where id = requested_journey_id returning * into journey_row;
  if requested_action = 'PAUSE' then
    update public.reminders reminder set status = 'CANCELLED', cancelled_at = timezone('utc', now())
    from public.journey_reminder_links link where link.journey_id = journey_row.id and link.reminder_id = reminder.id and link.status = 'ACTIVE';
    update public.journey_reminder_links set status = 'SUSPENDED', updated_at = timezone('utc', now()) where journey_id = journey_row.id and status = 'ACTIVE';
  elsif requested_action = 'RESUME' then
    update public.reminders reminder set status = 'PUBLISHED', published_at = timezone('utc', now()), cancelled_at = null
    from public.journey_reminder_links link where link.journey_id = journey_row.id and link.reminder_id = reminder.id and link.status = 'SUSPENDED';
    update public.journey_reminder_links set status = 'ACTIVE', updated_at = timezone('utc', now()) where journey_id = journey_row.id and status = 'SUSPENDED';
  elsif requested_action in ('CANCEL', 'COMPLETE') then
    update public.reminders reminder set status = 'CANCELLED', cancelled_at = timezone('utc', now())
    from public.journey_reminder_links link where link.journey_id = journey_row.id and link.reminder_id = reminder.id and reminder.status <> 'CANCELLED';
    update public.journey_reminder_links set status = 'CANCELLED', updated_at = timezone('utc', now()) where journey_id = journey_row.id and status <> 'CANCELLED';
  end if;
  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (journey_row.tenant_id, 'journey', journey_row.id, actor_id, 'UPDATE', jsonb_build_object('event', 'JOURNEY_STATUS_CHANGED', 'action', requested_action, 'status', target_status, 'version', journey_row.version));
  return jsonb_build_object('id', journey_row.id, 'status', journey_row.status, 'version', journey_row.version);
end;
$$;
