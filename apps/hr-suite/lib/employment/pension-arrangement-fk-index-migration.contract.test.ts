import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../../supabase/migrations/20261010125613_index_core_pension_arrangement_foreign_keys.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('Core pension-arrangement FK index migration contract', () => {
  it('adds only the two missing foreign-key indexes idempotently', () => {
    expect(migration).toMatch(
      /create index if not exists employment_pension_arrangement_assignments_arrangement_idx\s+on public\.employment_pension_arrangement_assignments\s*\(pension_arrangement_id\)/,
    )
    expect(migration).toMatch(
      /create index if not exists labor_condition_pension_arrangements_arrangement_idx\s+on public\.labor_condition_pension_arrangements\s*\(pension_arrangement_id\)/,
    )
    expect(migration.match(/\bcreate\s+(?:unique\s+)?index\b/g)).toHaveLength(2)
  })

  it('does not alter data, grants, policies, or RLS', () => {
    expect(migration).not.toMatch(/\b(drop|alter\s+table|insert\s+into|update|delete\s+from)\b/)
    expect(migration).not.toMatch(/\b(grant|revoke|create\s+policy|drop\s+policy|row\s+level\s+security)\b/)
  })
})
