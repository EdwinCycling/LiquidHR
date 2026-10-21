import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261021160000_pmux03b_process_work_experience.sql', import.meta.url), 'utf8').toLowerCase()

describe('PMUX-03B process work experience projection', () => {
  it('keeps history reads behind the existing work-item read scope and immutable process version', () => {
    expect(migration).toContain('internal_security.process_work_item_can_read(item_row.tenant_id, item_row.hr_group_id, item_row.id)')
    expect(migration).toContain('version.id = instance_row.process_version_id')
    expect(migration).toContain('from public.process_events event')
    expect(migration).toContain('event.process_instance_id = instance_row.id')
    expect(migration).toContain('from public.process_work_item_notes note')
    expect(migration).toContain('note.work_item_id = item_row.id')
    expect(migration).toContain("note.action = 'request_changes'")
  })

  it('returns only presentation fields for steps, actions, outcomes and localized history', () => {
    for (const field of ['steptitle', 'eventtype', 'terminaloutcome', 'changerequests', 'next_routes', 'isconditional']) {
      expect(migration).toContain(field)
    }
    expect(migration).not.toContain('grant select on public.process_events')
    expect(migration).not.toContain('grant select on public.process_work_item_notes')
  })

  it('exposes only an authenticated public wrapper, never the internal security definer', () => {
    expect(migration).toContain('revoke all on function internal_security.get_process_work_item_experience(uuid, text)')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.get_process_work_item_experience(uuid, text)')
    expect(migration).not.toMatch(/grant execute on function internal_security\.get_process_work_item_experience/)
  })
})
