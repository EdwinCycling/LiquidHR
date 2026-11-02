import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20261018175429_employee_overview_administration_scope.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('employee overview administration scope migration contract', () => {
  it('returns only employees assigned to or employed in the requested administration', () => {
    expect(migration).toMatch(/employee_administration_assignments assignment[\s\S]*?assignment\.administration_id = requested_administration_id[\s\S]*?assignment\.employee_id = employee\.id/)
    expect(migration).toMatch(/public\.employments scoped_employment[\s\S]*?scoped_employment\.administration_id = requested_administration_id[\s\S]*?scoped_employment\.employee_id = employee\.id/)
  })

  it('scopes employee state, placements, employment summaries, and administration labels', () => {
    expect(migration).toMatch(/employment_state as materialized[\s\S]*?employment\.administration_id = requested_administration_id[\s\S]*?group by employment\.employee_id/)
    expect(migration).toMatch(/organization\.administration_id = requested_administration_id[\s\S]*?organization\.employee_id = employee\.id/)
    expect(migration).toMatch(/select coalesce\(jsonb_agg\(names\.name order by names\.name\)[\s\S]*?employment\.administration_id = requested_administration_id[\s\S]*?employment\.employee_id = page\.id/)
  })

  it('retains authenticated-only execution and the existing administration permission checks', () => {
    expect(migration).toContain('internal_security.has_administration_access')
    expect(migration).toContain("'employee:read'")
    expect(migration).toContain("'employee-directory:read'")
    expect(migration).toContain('from public, anon, service_role')
    expect(migration).toMatch(/to authenticated;/)
  })
})
