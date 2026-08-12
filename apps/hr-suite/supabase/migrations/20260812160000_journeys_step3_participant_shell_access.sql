-- Journeys stap 3: een actieve runtime-participant mag de Journey-shell lezen.
-- Topicinhoud en outcomes blijven begrensd door zichtbare topic-assignments.

begin;

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

revoke all on function internal_security.journey_actor_can_read(uuid) from public, anon, authenticated;
grant execute on function internal_security.journey_actor_can_read(uuid) to authenticated;

commit;
