-- Journeys stap 3: dek de foreign keys van append-only topic outcomes af.

begin;

create index journey_topic_outcomes_scope_idx
  on public.journey_topic_outcomes (tenant_id, hr_group_id, journey_id, created_at desc);

create index journey_topic_outcomes_scope_topic_idx
  on public.journey_topic_outcomes (tenant_id, hr_group_id, journey_id, topic_id);

create index journey_topic_outcomes_participant_idx
  on public.journey_topic_outcomes (participant_id, created_at desc);

create index journey_topic_outcomes_actor_user_idx
  on public.journey_topic_outcomes (actor_user_id, created_at desc);

commit;
