import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260812122500_journeys_step2_runtime.sql'), 'utf8')
const reminderFix = readFileSync(join(process.cwd(), 'supabase/migrations/20260812143000_fix_journey_reminder_administration.sql'), 'utf8')
const reminderPublishFix = readFileSync(join(process.cwd(), 'supabase/migrations/20260812143500_fix_journey_reminder_publish_sequence.sql'), 'utf8')
const participantProjectionFix = readFileSync(join(process.cwd(), 'supabase/migrations/20260812153435_journeys_step3_employee_projection_participants.sql'), 'utf8')
const versionConflictFix = readFileSync(join(process.cwd(), 'supabase/migrations/20260825134000_fix_journey_version_conflict_retry.sql'), 'utf8')

describe('Journeys stap 2 migratiecontract', () => {
  const tables = [
    'journeys', 'journey_phases', 'journey_participants', 'journey_participant_changes',
    'journey_moments', 'journey_topics', 'journey_topic_assignments', 'journey_reminder_links',
  ]

  it('maakt het genormaliseerde, gepinde runtime-model', () => {
    tables.forEach((table) => expect(migration).toContain(`create table public.${table}`))
    expect(migration).toContain('template_version_id uuid not null')
    expect(migration).toContain('idempotency_key text not null')
    expect(migration).toContain('unique (tenant_id, hr_group_id, idempotency_key)')
  })

  it('zet voor iedere tabel RLS en uitsluitend read-grants aan', () => {
    tables.forEach((table) => {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
      expect(migration).toContain(`grant select on table public.${table} to authenticated`)
    })
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'journey:read')")
  })

  it('biedt één transactionele schrijfweg voor activatie, lifecycle en vervanging', () => {
    expect(migration).toContain('public.activate_journey')
    expect(migration).toContain('public.transition_journey')
    expect(migration).toContain('public.replace_journey_participant')
    expect(migration).toContain('JOURNEY_ACTIVATED')
    expect(migration).toContain('JOURNEY_PARTICIPANT_REPLACED')
    expect(migration).toContain('journey_reminder_links')
  })

  it('maakt stale lifecycle-versies niet retrybaar als serialisatiefout', () => {
    expect(versionConflictFix).toContain('create or replace function internal_security.transition_journey_internal')
    expect(versionConflictFix).toContain("raise exception 'JOURNEY_VERSION_CONFLICT' using errcode = 'P0001'")
    expect(versionConflictFix).not.toContain("JOURNEY_VERSION_CONFLICT' using errcode = '40001'")
    expect(versionConflictFix).toContain("when 'CANCEL' then 'CANCELLED'::public.journey_status")
    expect(versionConflictFix).toContain("raise exception 'JOURNEY_TRANSITION_INVALID'")
  })
  it('laat een Journey zonder expliciete Employment-context niet stuklopen op reminders', () => {
    expect(reminderFix).toContain('employment.employee_id = journey_row.target_employee_id')
    expect(reminderFix).toContain('if administration_id_value is null then return; end if;')
    expect(reminderPublishFix).toContain("'DRAFT',null")
    expect(reminderPublishFix).toContain("set status='PUBLISHED'")
  })

  it('neemt concrete actieve of toegewezen deelnemers mee in de bestaande medewerkerprojectie', () => {
    expect(participantProjectionFix).toContain('public.get_employee_journey_projection')
    expect(participantProjectionFix).toContain('journey.target_employee_id = $3')
    expect(participantProjectionFix).toContain('participant.employee_id = $3')
    expect(participantProjectionFix).toContain("participant.status in ('ASSIGNED', 'ACTIVE')")
    expect(participantProjectionFix).toContain('internal_security.journey_actor_can_read(journey.id)')
  })
})
