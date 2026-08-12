-- Een Journey mag zonder expliciete Employment-context worden geactiveerd.
-- Gebruik voor reminders dan het actuele primaire dienstverband van de target;
-- zonder geldige administratie wordt alleen de reminder overgeslagen.
create or replace function internal_security.create_journey_reminders_internal(requested_journey_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
declare
  journey_row public.journeys%rowtype;
  item record;
  reminder_id uuid;
  recipient_user_id uuid;
  remind_at_value timestamptz;
  administration_id_value uuid;
begin
  select * into journey_row from public.journeys where id = requested_journey_id;
  if not found then raise exception 'JOURNEY_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is null or not internal_security.current_user_has_hr_group_permission(journey_row.tenant_id, journey_row.hr_group_id, 'journey:write') then
    raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501';
  end if;
  select employment.administration_id into administration_id_value from public.employments employment where employment.id = journey_row.employment_id;
  if administration_id_value is null then
    select employment.administration_id into administration_id_value
    from public.employments employment
    where employment.tenant_id = journey_row.tenant_id and employment.hr_group_id = journey_row.hr_group_id
      and employment.employee_id = journey_row.target_employee_id and employment.deleted_at is null
      and employment.starts_on <= journey_row.anchor_date
      and (employment.ends_on is null or employment.ends_on >= journey_row.anchor_date)
    order by employment.is_primary desc, employment.starts_on desc, employment.id limit 1;
  end if;
  if administration_id_value is null then return; end if;
  for item in
    select distinct moment.id as moment_id, moment.available_on, participant.id as participant_id, participant.employee_id
    from public.journey_moments moment
    join public.journey_topics topic on topic.moment_id = moment.id
    join public.journey_topic_assignments assignment on assignment.topic_id = topic.id and assignment.is_owner
    join public.journey_participants participant on participant.id = assignment.participant_id
    where moment.journey_id = requested_journey_id and participant.status in ('ASSIGNED', 'ACTIVE')
  loop
    select employee.auth_user_id into recipient_user_id from public.employees employee where employee.id = item.employee_id;
    if recipient_user_id is null then continue; end if;
    remind_at_value := greatest((item.available_on::timestamp + time '09:00') at time zone 'Europe/Amsterdam', timezone('utc', now()) + interval '5 minutes');
    insert into public.reminders (tenant_id, administration_id, created_by_user_id, reminder_type, target_type, title, description, remind_at, status, published_at)
    values (journey_row.tenant_id, administration_id_value, journey_row.created_by_user_id, 'HR', 'EMPLOYEES', 'Journey: ' || coalesce(journey_row.template_name ->> 'nl', 'Journey'), 'Open /journeys/' || journey_row.id::text || '#moment-' || item.moment_id::text, remind_at_value, 'PUBLISHED', timezone('utc', now()))
    returning id into reminder_id;
    insert into public.reminder_targets (tenant_id, administration_id, reminder_id, employee_id) values (journey_row.tenant_id, administration_id_value, reminder_id, item.employee_id);
    insert into public.reminder_recipients (tenant_id, reminder_id, user_id, employee_id, effective_remind_at) values (journey_row.tenant_id, reminder_id, recipient_user_id, item.employee_id, remind_at_value);
    insert into public.journey_reminder_links (tenant_id, hr_group_id, journey_id, moment_id, participant_id, reminder_id)
    values (journey_row.tenant_id, journey_row.hr_group_id, journey_row.id, item.moment_id, item.participant_id, reminder_id)
    on conflict (tenant_id, hr_group_id, journey_id, moment_id, participant_id) do nothing;
  end loop;
end;
$$;

revoke all on function internal_security.create_journey_reminders_internal(uuid) from public, anon, authenticated;
grant execute on function internal_security.create_journey_reminders_internal(uuid) to authenticated;
