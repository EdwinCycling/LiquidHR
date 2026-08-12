create or replace function internal_security.journey_projection_json(requested_journey_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  journey_row public.journeys%rowtype;
  actor_employee_id uuid := internal_security.current_employee_id();
  is_hr boolean;
  relationship text;
begin
  select * into journey_row
  from public.journeys journey
  where journey.id = requested_journey_id;
  if not found or not internal_security.journey_actor_can_read(requested_journey_id) then
    return null;
  end if;

  is_hr := internal_security.current_user_has_hr_group_permission(
    journey_row.tenant_id, journey_row.hr_group_id, 'journey:read'
  );
  relationship := case
    when is_hr then 'HR'
    when journey_row.target_employee_id = actor_employee_id then 'SELF'
    else 'PARTICIPANT'
  end;

  return jsonb_build_object(
    'id', journey_row.id,
    'templateName', journey_row.template_name,
    'status', journey_row.status,
    'anchorDate', journey_row.anchor_date,
    'targetEmployeeName', (
      select nullif(btrim(concat_ws(' ', employee.first_name, employee.birth_name_prefix, employee.birth_name)), '')
      from public.employees employee
      where employee.id = journey_row.target_employee_id
    ),
    'relationship', relationship,
    'progress', jsonb_build_object(
      'completed', (
        select count(*)
        from public.journey_topics topic
        where topic.journey_id = journey_row.id
          and topic.status = 'COMPLETED'
          and (is_hr or internal_security.journey_actor_can_read_topic(topic.id))
      ),
      'total', (
        select count(*)
        from public.journey_topics topic
        where topic.journey_id = journey_row.id
          and (is_hr or internal_security.journey_actor_can_read_topic(topic.id))
      )
    ),
    'nextAction', (
      select jsonb_build_object(
        'id', topic.id,
        'key', topic.key,
        'title', topic.title,
        'body', topic.body,
        'topicType', topic.topic_type,
        'isRequired', topic.is_required,
        'status', topic.status,
        'actionUrl', topic.action_url,
        'ownerRoleKey', topic.owner_role_key,
        'momentId', moment.id,
        'momentName', moment.name,
        'scheduledOn', moment.scheduled_on,
        'availableOn', moment.available_on,
        'availability', case when moment.available_on > current_date then 'UPCOMING' else 'AVAILABLE' end
      )
      from public.journey_topics topic
      join public.journey_moments moment on moment.id = topic.moment_id
      where topic.journey_id = journey_row.id
        and topic.status = 'PENDING'
        and (is_hr or internal_security.journey_actor_can_read_topic(topic.id))
      order by moment.available_on, moment.scheduled_on, moment.sort_order, topic.sort_order
      limit 1
    ),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roleKey', participant.role_key,
          'roleName', participant.role_name,
          'employeeName', nullif(btrim(concat_ws(' ', employee.first_name, employee.birth_name_prefix, employee.birth_name)), ''),
          'status', participant.status
        )
        order by participant.role_key, participant.assigned_at
      )
      from public.journey_participants participant
      join public.employees employee on employee.id = participant.employee_id
      where participant.journey_id = journey_row.id
        and participant.status in ('ASSIGNED', 'ACTIVE')
    ), '[]'::jsonb),
    'phases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', phase.id,
          'key', phase.key,
          'name', phase.name,
          'sortOrder', phase.sort_order,
          'moments', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', moment.id,
                'key', moment.key,
                'name', moment.name,
                'scheduledOn', moment.scheduled_on,
                'availableOn', moment.available_on,
                'sortOrder', moment.sort_order,
                'topics', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', topic.id,
                      'key', topic.key,
                      'title', topic.title,
                      'body', topic.body,
                      'topicType', topic.topic_type,
                      'isRequired', topic.is_required,
                      'status', topic.status,
                      'actionUrl', topic.action_url,
                      'ownerRoleKey', topic.owner_role_key
                    )
                    order by topic.sort_order
                  )
                  from public.journey_topics topic
                  where topic.moment_id = moment.id
                    and (is_hr or internal_security.journey_actor_can_read_topic(topic.id))
                ), '[]'::jsonb)
              )
              order by moment.scheduled_on, moment.sort_order
            )
            from public.journey_moments moment
            where moment.phase_id = phase.id
          ), '[]'::jsonb)
        )
        order by phase.sort_order
      )
      from public.journey_phases phase
      where phase.journey_id = journey_row.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function internal_security.journey_projection_json(uuid) from public, anon, authenticated;
grant execute on function internal_security.journey_projection_json(uuid) to authenticated;
