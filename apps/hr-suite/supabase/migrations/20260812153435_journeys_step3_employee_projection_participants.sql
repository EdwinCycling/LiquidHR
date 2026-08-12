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
    and (
      journey.target_employee_id = $3
      or exists (
        select 1
        from public.journey_participants participant
        where participant.journey_id = journey.id
          and participant.employee_id = $3
          and participant.status in ('ASSIGNED', 'ACTIVE')
      )
    )
    and journey.status <> 'CANCELLED'
    and internal_security.journey_actor_can_read(journey.id);
$$;

comment on function public.get_employee_journey_projection(uuid, uuid, uuid) is
  'Geeft de actor-gefilterde Journey-projectie voor een medewerker inclusief concrete actieve/assigned participantrollen.';
