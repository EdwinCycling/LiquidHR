import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260812130813_journeys_step3_projection_and_outcomes.sql'), 'utf8')
const nextActionContractMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260812161000_journeys_step3_projection_next_action_contract.sql'), 'utf8')

describe('Journeys stap 3 migratiecontract', () => {
  it('registreert actor permissions en een append-only outcome-tabel met RLS', () => {
    expect(migration).toContain("'self:journey:read'")
    expect(migration).toContain("'journey-participation:write'")
    expect(migration).toContain('create table public.journey_topic_outcomes')
    expect(migration).toContain('alter table public.journey_topic_outcomes enable row level security')
    expect(migration).toContain('revoke all on table public.journey_topic_outcomes from public, anon, authenticated')
  })

  it('maakt projection-data afhankelijk van de concrete actor en beperkt topics tot zichtbare assignments', () => {
    expect(migration).toContain('internal_security.journey_actor_can_read')
    expect(migration).toContain('internal_security.journey_actor_can_read_topic')
    expect(migration).toContain('assignment.is_visible')
    expect(migration).toContain("participant.status in ('ASSIGNED', 'ACTIVE')")
    expect(migration).toContain('current_employee_has_permission')
    expect(migration).toContain('create or replace function public.get_journey_projection')
    expect(migration).toContain('create or replace function public.get_employee_journey_projection')
  })

  it('schrijft outcomes uitsluitend via de geautoriseerde RPC', () => {
    expect(migration).toContain('create or replace function public.record_journey_topic_outcome')
    expect(migration).toContain('JOURNEY_TOPIC_OUTCOME_INVALID')
    expect(migration).toContain('JOURNEY_TOPIC_ACTION_UNAVAILABLE')
    expect(migration).toContain('JOURNEY_TOPIC_OUTCOME_RECORDED')
  })

  it('houdt de next-action projectie gelijk aan het topiccontract', () => {
    expect(nextActionContractMigration).toContain("'key', topic.key")
    expect(nextActionContractMigration).toContain("'ownerRoleKey', topic.owner_role_key")
  })
})
