import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261008072304_control02_test_employment_number_readback_ambiguity_fix.sql', import.meta.url))

describe('CONTROL02 employment-number shadowing migration', () => {
  it('uses a terminated transaction envelope for the function replacement', () => {
    const normalized = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').trim()
    expect(normalized).toMatch(/^begin;\s/)
    expect(normalized).toMatch(/;\s*commit;$/)
  })

  it('uses a distinct variable for the employment number readback predicate', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').toLowerCase()
    const writer = migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\([\s\S]*?\n\$\$;/)?.[0] ?? ''

    expect(writer).not.toBe('')
    expect(writer).toContain('resolved_employment_number text;')
    expect(writer).toContain('into resolved_employment_number')
    expect(writer).toContain("resolved_employment_number, 'employee'::public.employment_type")
    expect(writer).toContain('employment_number, employment_type, contract_type')
    expect(writer.match(/e\.employment_number\s*=\s*resolved_employment_number\b/g)).toHaveLength(1)
    expect(writer).not.toMatch(/e\.employment_number\s*=\s*employment_number\b/)
    expect(writer).toContain('security definer')
    expect(writer).toContain("set search_path = ''")
  })
})