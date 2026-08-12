-- Journeys stap 3: minimale self-/participantprojecties en topic outcomes.
-- De Stitch-schermen zijn richtinggevend; deze migratie ontsluit alleen data die
-- de bestaande LiquidHR-rollen en de concrete Journey-toewijzing mogen zien.

begin;

insert into public.permissions (code, name, category, description)
values
  ('self:journey:read', 'Eigen Journey lezen', 'Journeys', 'Leest uitsluitend de eigen Journey-projectie.'),
  ('self:journey:write', 'Eigen Journey bijwerken', 'Journeys', 'Rondt uitsluitend eigen zichtbare Journey-topics af.'),
  ('journey-participation:read', 'Journey-deelname lezen', 'Journeys', 'Leest toegewezen Journey-topics en de bijbehorende beperkte projectie.'),
  ('journey-participation:write', 'Journey-deelname bijwerken', 'Journeys', 'Rondt toegewezen Journey-topics af en registreert check-ins.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description;

insert into public.role_permissions (management_role_id, permission_id)
select management_role.id, permission.id
from public.management_roles management_role
join public.permissions permission on permission.code in (
  'self:journey:read', 'self:journey:write',
  'journey-participation:read', 'journey-participation:write'
)
where management_role.code = 'EMPLOYEE'
  and management_role.tenant_id is null
on conflict do nothing;

create type public.journey_topic_outcome_type as enum ('COMPLETE', 'SKIP', 'CHECK_IN');

create table public.journey_topic_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hr_group_id uuid not null,
  journey_id uuid not null,
  topic_id uuid not null,
  participant_id uuid,
  actor_employee_id uuid,
  actor_user_id uuid not null references auth.users(id),
  outcome_type public.journey_topic_outcome_type not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (tenant_id, hr_group_id, journey_id) references public.journeys(tenant_id, hr_group_id, id) on delete cascade,
  foreign key (tenant_id, hr_group_id, journey_id, topic_id) references public.journey_topics(tenant_id, hr_group_id, journey_id, id) on delete cascade,
  foreign key (participant_id) references public.journey_participants(id) on delete set null,
  foreign key (actor_employee_id) references public.employees(id) on delete set null
);

create index journey_topic_outcomes_topic_idx
  on public.journey_topic_outcomes (tenant_id, hr_group_id, topic_id, created_at desc);
create index journey_topic_outcomes_actor_idx
  on public.journey_topic_outcomes (actor_employee_id, created_at desc);

create or replace function internal_security.journey_actor_can_read(requested_journey_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.journeys journey
    where journey.id = requested_journey_id
      and internal_security.journeys_module_enabled(journey.tenant_id)
      and (
        internal_security.current_user_has_hr_group_permission(
          journey.tenant_id, journey.hr_group_id, 'journey:read'
        )
        or (
          internal_security.current_employee_id() is not null
          and (
            (
              journey.target_employee_id = internal_security.current_employee_id()
              and internal_security.current_employee_has_permission('self:journey:read')
            )
            or (
              internal_security.current_employee_has_permission('journey-participation:read')
              and exists (
                select 1
                from public.journey_participants participant
                join public.journey_topic_assignments assignment
                  on assignment.tenant_id = participant.tenant_id
                 and assignment.hr_group_id = participant.hr_group_id
                 and assignment.journey_id = participant.journey_id
                 and assignment.participant_id = participant.id
                 and assignment.is_visible
                where participant.tenant_id = journey.tenant_id
                  and participant.hr_group_id = journey.hr_group_id
                  and participant.journey_id = journey.id
                  and participant.employee_id = internal_security.current_employee_id()
                  and participant.status in ('ASSIGNED', 'ACTIVE')
              )
            )
          )
        )
      )
  );
$$;

create or replace function internal_security.journey_actor_can_read_topic(requested_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.journey_topics topic
    join public.journeys journey on journey.id = topic.journey_id
    where topic.id = requested_topic_id
      and internal_security.journeys_module_enabled(journey.tenant_id)
      and (
        internal_security.current_user_has_hr_group_permission(
          journey.tenant_id, journey.hr_group_id, 'journey:read'
        )
        or (
          internal_security.current_employee_id() is not null
          and (
            (
              journey.target_employee_id = internal_security.current_employee_id()
              and internal_security.current_employee_has_permission('self:journey:read')
              and exists (
                select 1
                from public.journey_topic_assignments assignment
                join public.journey_participants participant on participant.id = assignment.participant_id
                where assignment.topic_id = topic.id
                  and assignment.is_visible
                  and participant.employee_id = internal_security.current_employee_id()
                  and participant.status in ('ASSIGNED', 'ACTIVE')
              )
            )
            or (
              internal_security.current_employee_has_permission('journey-participation:read')
              and exists (
                select 1
                from public.journey_topic_assignments assignment
                join public.journey_participants participant on participant.id = assignment.participant_id
                where assignment.topic_id = topic.id
                  and assignment.is_visible
                  and participant.employee_id = internal_security.current_employee_id()
                  and participant.status in ('ASSIGNED', 'ACTIVE')
              )
            )
          )
        )
      )
  );
$$;

create or replace function internal_security.journey_actor_can_write_topic(
  requested_journey_id uuid,
  requested_topic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.journeys journey
    join public.journey_topics topic on topic.journey_id = journey.id
    where journey.id = requested_journey_id
      and topic.id = requested_topic_id
      and internal_security.journeys_module_enabled(journey.tenant_id)
      and (
        internal_security.current_user_has_hr_group_permission(
          journey.tenant_id, journey.hr_group_id, 'journey:write'
        )
        or (
          internal_security.current_employee_id() is not null
          and (
            (
              journey.target_employee_id = internal_security.current_employee_id()
              and internal_security.current_employee_has_permission('self:journey:write')
            )
            or internal_security.current_employee_has_permission('journey-participation:write')
          )
          and exists (
            select 1
            from public.journey_topic_assignments assignment
            join public.journey_participants participant on participant.id = assignment.participant_id
            where assignment.topic_id = topic.id
              and assignment.is_visible
              and participant.employee_id = internal_security.current_employee_id()
              and participant.status in ('ASSIGNED', 'ACTIVE')
          )
        )
      )
  );
$$;

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
        'title', topic.title,
        'body', topic.body,
        'topicType', topic.topic_type,
        'isRequired', topic.is_required,
        'status', topic.status,
        'actionUrl', topic.action_url,
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

create or replace function internal_security.list_journey_projections_internal(
  requested_tenant_id uuid,
  requested_hr_group_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_agg(internal_security.journey_projection_json(journey.id) order by journey.anchor_date desc, journey.created_at desc),
    '[]'::jsonb
  )
  from public.journeys journey
  where journey.tenant_id = requested_tenant_id
    and journey.hr_group_id = requested_hr_group_id
    and journey.status <> 'CANCELLED'
    and internal_security.journey_actor_can_read(journey.id);
$$;

create or replace function internal_security.record_journey_topic_outcome_internal(
  requested_journey_id uuid,
  requested_topic_id uuid,
  requested_outcome_type text,
  requested_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  actor_employee_id uuid := internal_security.current_employee_id();
  journey_row public.journeys%rowtype;
  topic_row public.journey_topics%rowtype;
  participant_id_value uuid;
  outcome_type_value public.journey_topic_outcome_type;
  next_status public.journey_topic_status;
  note_value text := nullif(btrim(requested_note), '');
  existing_outcome_id uuid;
begin
  if actor_id is null then
    raise exception 'JOURNEY_AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if requested_outcome_type not in ('COMPLETE', 'SKIP', 'CHECK_IN') then
    raise exception 'JOURNEY_TOPIC_OUTCOME_INVALID' using errcode = '22023';
  end if;
  if char_length(coalesce(note_value, '')) > 500 then
    raise exception 'JOURNEY_TOPIC_OUTCOME_NOTE_INVALID' using errcode = '22023';
  end if;
  if requested_outcome_type = 'CHECK_IN' and note_value is null then
    raise exception 'JOURNEY_TOPIC_CHECK_IN_NOTE_REQUIRED' using errcode = '22023';
  end if;

  outcome_type_value := requested_outcome_type::public.journey_topic_outcome_type;
  select * into journey_row
  from public.journeys journey
  where journey.id = requested_journey_id
  for update;
  if not found then
    raise exception 'JOURNEY_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into topic_row
  from public.journey_topics topic
  where topic.id = requested_topic_id and topic.journey_id = journey_row.id
  for update;
  if not found then
    raise exception 'JOURNEY_TOPIC_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not internal_security.journey_actor_can_write_topic(journey_row.id, topic_row.id) then
    raise exception 'JOURNEY_FORBIDDEN' using errcode = '42501';
  end if;
  if journey_row.status <> 'ACTIVE' then
    raise exception 'JOURNEY_TOPIC_ACTION_UNAVAILABLE' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.journey_moments moment
    where moment.id = topic_row.moment_id and moment.available_on <= current_date
  ) then
    raise exception 'JOURNEY_TOPIC_ACTION_UNAVAILABLE' using errcode = '55000';
  end if;

  if actor_employee_id is not null then
    select assignment.participant_id into participant_id_value
    from public.journey_topic_assignments assignment
    join public.journey_participants participant on participant.id = assignment.participant_id
    where assignment.topic_id = topic_row.id
      and assignment.is_visible
      and participant.employee_id = actor_employee_id
      and participant.status in ('ASSIGNED', 'ACTIVE')
    order by assignment.is_owner desc, assignment.created_at
    limit 1;
  end if;

  if requested_outcome_type in ('COMPLETE', 'SKIP') then
    if topic_row.status <> 'PENDING' then
      select outcome.id into existing_outcome_id
      from public.journey_topic_outcomes outcome
      where outcome.topic_id = topic_row.id
        and outcome.outcome_type = outcome_type_value
      order by outcome.created_at desc
      limit 1;
      return jsonb_build_object(
        'topicId', topic_row.id,
        'status', topic_row.status,
        'outcomeId', existing_outcome_id,
        'idempotentReplay', true
      );
    end if;
    next_status := case requested_outcome_type
      when 'COMPLETE' then 'COMPLETED'::public.journey_topic_status
      else 'SKIPPED'::public.journey_topic_status
    end;
  end if;

  insert into public.journey_topic_outcomes (
    tenant_id, hr_group_id, journey_id, topic_id, participant_id,
    actor_employee_id, actor_user_id, outcome_type, note
  ) values (
    journey_row.tenant_id, journey_row.hr_group_id, journey_row.id, topic_row.id, participant_id_value,
    actor_employee_id, actor_id, outcome_type_value, note_value
  ) returning id into existing_outcome_id;

  if requested_outcome_type in ('COMPLETE', 'SKIP') then
    update public.journey_topics topic
    set status = next_status,
        completed_at = timezone('utc', now())
    where topic.id = topic_row.id;
    update public.journeys journey
    set version = version + 1,
        updated_by_user_id = actor_id,
        updated_at = timezone('utc', now())
    where journey.id = journey_row.id;
  end if;

  insert into public.audit_logs (tenant_id, entity_name, entity_id, actor_user_id, action, changes)
  values (
    journey_row.tenant_id,
    'journey_topic',
    topic_row.id,
    actor_id,
    'UPDATE',
    jsonb_build_object(
      'event', 'JOURNEY_TOPIC_OUTCOME_RECORDED',
      'journeyId', journey_row.id,
      'outcomeType', requested_outcome_type,
      'status', case when requested_outcome_type = 'CHECK_IN' then topic_row.status else next_status end
    )
  );

  return jsonb_build_object(
    'topicId', topic_row.id,
    'status', case when requested_outcome_type = 'CHECK_IN' then topic_row.status else next_status end,
    'outcomeId', existing_outcome_id,
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.get_journey_projection(requested_journey_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.journey_projection_json($1);
$$;

create or replace function public.list_journey_projections(requested_tenant_id uuid, requested_hr_group_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.list_journey_projections_internal($1, $2);
$$;

create or replace function public.get_employee_journey_projection(
  requested_tenant_id uuid,
  requested_hr_group_id uuid,
  requested_employee_id uuid
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_agg(internal_security.journey_projection_json(journey.id) order by journey.anchor_date desc, journey.created_at desc),
    '[]'::jsonb
  )
  from public.journeys journey
  where journey.tenant_id = $1
    and journey.hr_group_id = $2
    and journey.target_employee_id = $3
    and journey.status <> 'CANCELLED'
    and internal_security.journey_actor_can_read(journey.id);
$$;

create or replace function public.record_journey_topic_outcome(
  requested_journey_id uuid,
  requested_topic_id uuid,
  requested_outcome_type text,
  requested_note text default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select internal_security.record_journey_topic_outcome_internal($1, $2, $3, $4);
$$;

revoke all on function internal_security.journey_actor_can_read(uuid) from public, anon, authenticated;
revoke all on function internal_security.journey_actor_can_read_topic(uuid) from public, anon, authenticated;
revoke all on function internal_security.journey_actor_can_write_topic(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.journey_projection_json(uuid) from public, anon, authenticated;
revoke all on function internal_security.list_journey_projections_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function internal_security.record_journey_topic_outcome_internal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function internal_security.journey_actor_can_read(uuid) to authenticated;
grant execute on function internal_security.journey_actor_can_read_topic(uuid) to authenticated;
grant execute on function internal_security.journey_actor_can_write_topic(uuid, uuid) to authenticated;
grant execute on function internal_security.journey_projection_json(uuid) to authenticated;
grant execute on function internal_security.list_journey_projections_internal(uuid, uuid) to authenticated;
grant execute on function internal_security.record_journey_topic_outcome_internal(uuid, uuid, text, text) to authenticated;

revoke all on function public.get_journey_projection(uuid) from public, anon;
revoke all on function public.list_journey_projections(uuid, uuid) from public, anon;
revoke all on function public.get_employee_journey_projection(uuid, uuid, uuid) from public, anon;
revoke all on function public.record_journey_topic_outcome(uuid, uuid, text, text) from public, anon;
grant execute on function public.get_journey_projection(uuid) to authenticated;
grant execute on function public.list_journey_projections(uuid, uuid) to authenticated;
grant execute on function public.get_employee_journey_projection(uuid, uuid, uuid) to authenticated;
grant execute on function public.record_journey_topic_outcome(uuid, uuid, text, text) to authenticated;

alter table public.journey_topic_outcomes enable row level security;

create policy journey_topic_outcomes_read on public.journey_topic_outcomes
for select to authenticated using (
  internal_security.journeys_module_enabled(tenant_id)
  and (
    internal_security.current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read')
  or actor_employee_id = internal_security.current_employee_id()
  )
);

create policy journeys_participant_read on public.journeys
for select to authenticated using (internal_security.journey_actor_can_read(id));
create policy journey_phases_participant_read on public.journey_phases
for select to authenticated using (internal_security.journey_actor_can_read(journey_id));
create policy journey_participants_participant_read on public.journey_participants
for select to authenticated using (internal_security.journey_actor_can_read(journey_id));
create policy journey_participant_changes_participant_read on public.journey_participant_changes
for select to authenticated using (internal_security.journey_actor_can_read(journey_id));
create policy journey_moments_participant_read on public.journey_moments
for select to authenticated using (internal_security.journey_actor_can_read(journey_id));
create policy journey_topics_participant_read on public.journey_topics
for select to authenticated using (internal_security.journey_actor_can_read_topic(id));
create policy journey_topic_assignments_participant_read on public.journey_topic_assignments
for select to authenticated using (internal_security.journey_actor_can_read_topic(topic_id));
create policy journey_reminder_links_participant_read on public.journey_reminder_links
for select to authenticated using (internal_security.journey_actor_can_read(journey_id));

revoke all on table public.journey_topic_outcomes from public, anon, authenticated;
grant select on table public.journey_topic_outcomes to authenticated;

comment on function public.get_journey_projection(uuid) is
  'Geeft een minimale, actor-gefilterde Journey-projectie voor de bestaande LiquidHR-schermen.';
comment on function public.record_journey_topic_outcome(uuid, uuid, text, text) is
  'Registreert een geautoriseerde Journey-topic outcome en wijzigt de runtime-status transactioneel.';

commit;
