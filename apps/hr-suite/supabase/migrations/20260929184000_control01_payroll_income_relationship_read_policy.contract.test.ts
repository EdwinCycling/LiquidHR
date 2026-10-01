import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(__dirname, '20260929184000_control01_payroll_income_relationship_read_policy.sql'), 'utf8')

describe('payroll income relationship read policy migration contract', () => {
  it('allows only authenticated salary writers to read rows within their existing administration scope', () => {
    expect(migration).toContain('income_relationships_select_for_salary_writers')
    expect(migration).toContain('on public.income_relationships')
    expect(migration).toContain('for select to authenticated')
    expect(migration).toContain("current_user_has_permission(tenant_id, administration_id, 'salary:write')")
    expect(migration).not.toContain('for all')
    expect(migration).not.toContain('to anon')
    expect(migration).not.toContain('to public')
    expect(migration).not.toContain('security definer')
  })
})
