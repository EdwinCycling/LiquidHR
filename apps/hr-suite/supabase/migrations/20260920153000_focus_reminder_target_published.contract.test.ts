import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260920153000_focus_reminder_target_published.sql'), 'utf8')

describe('published Focus reminder target migration contract', () => {
  it('keeps reminder scope checks while accepting the canonical published insert lifecycle', () => {
    expect(sql).toContain("parent.status not in ('DRAFT', 'PUBLISHED')")
    expect(sql).toContain('parent.tenant_id <> new.tenant_id')
    expect(sql).toContain('parent.administration_id is distinct from new.administration_id')
    expect(sql).toContain("parent.reminder_type <> 'HR'")
    expect(sql).toContain('REMINDER_TARGET_SCOPE_INVALID')
  })
})
