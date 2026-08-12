import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260812081325_journeys_step1_foundation.sql'), 'utf8')

describe('Journeys stap 1 migratiecontract', () => {
  it('maakt uitsluitend de zeven configuratietabellen van stap 1', () => {
    const tables = [
      'journey_templates', 'journey_template_versions', 'journey_template_phases',
      'journey_template_roles', 'journey_template_moments', 'journey_template_topics',
      'journey_template_topic_audiences',
    ]
    tables.forEach((table) => expect(migration).toContain(`create table public.${table}`))
    expect(migration).not.toMatch(/create table public\.journeys\b/)
    expect(migration).not.toContain('create table public.journey_participants')
  })

  it('activeert RLS en maakt grants expliciet voor iedere tabel', () => {
    const tables = [
      'journey_templates', 'journey_template_versions', 'journey_template_phases',
      'journey_template_roles', 'journey_template_moments', 'journey_template_topics',
      'journey_template_topic_audiences',
    ]
    tables.forEach((table) => {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`revoke all on table public.${table} from anon`)
      expect(migration).toContain(`grant select on table public.${table} to authenticated`)
    })
    expect(migration).toContain('current_user_has_hr_group_permission')
  })

  it('seedt het volledige canonieke permission- en modulecontract', () => {
    for (const permission of [
      'journey-template:read', 'journey-template:write', 'journey-template:publish',
      'journey:read', 'journey:write', 'self:journey:read', 'self:journey:write',
      'journey-participation:read', 'journey-participation:write',
    ]) expect(migration).toContain(`'${permission}'`)
    expect(migration).toContain("module_code in ('HERA','REMINDERS','TALENT','SURVEYS','ENPS','TEAM_COMPASS','JOURNEYS','DOCUMENTS')")
  })

  it('publiceert atomair, audit en beschermt gepubliceerde rijen tegen mutatie', () => {
    expect(migration).toContain('public.publish_journey_template')
    expect(migration).toContain("'JOURNEY_TEMPLATE_PUBLISHED'")
    expect(migration).toContain('audit_logs')
    expect(migration).toContain('protect_published_journey_template_content')
    expect(migration).toContain('JOURNEY_TEMPLATE_PUBLISHED_IMMUTABLE')
  })
})
