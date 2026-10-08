import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261008090053_control02_test_income_source_reference_guard_fix.sql', import.meta.url))

describe('CONTROL02 source-version guard migration', () => {
  it('matches the canonical income source identity including both period boundaries', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').toLowerCase()
    const writer = migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\([\s\S]*?\n\$\$;/)?.[0] ?? ''
    const normalizedWriter = writer.replace(/\s+/g, ' ')

    expect(writer).not.toBe('')
    expect(normalizedWriter.includes("where source_ref = source_person_ref || ':income:' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text || ':' || coalesce(numbered.starts_on::text, '') || ':' || coalesce(numbered.ends_on::text, '')")).toBe(true)
    expect(normalizedWriter.includes("where source_ref = source_person_ref || ':income:' || i.payroll_tax_number || ':' || i.ikv_number::text || ':' || coalesce(i.starts_on::text, '') || ':' || coalesce(i.ends_on::text, '')")).toBe(true)
    expect(normalizedWriter.includes("where current_action.source_income_ref = source_person_ref || ':income:' || numbered.payroll_tax_number || ':' || numbered.ikv_number::text || ':' || coalesce(numbered.starts_on::text, '') || ':' || coalesce(numbered.ends_on::text, '')")).toBe(true)
    expect(normalizedWriter.includes("':income-' ")).toBe(false)
    expect(normalizedWriter.includes('income_index')).toBe(false)
  })

  it('replaces only the scoped CONTROL02 writer and performs no migration-time DML', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').trim()
    const functionNames = [...migration.matchAll(/create or replace function public\.([a-z0-9_]+)/gi)].map((match) => match[1].toLowerCase())
    const appliedSql = migration.replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$')

    expect(migration).toMatch(/^begin;\s/)
    expect(migration).toMatch(/;\s*commit;$/)
    expect(functionNames).toEqual(['execute_control02_test_payroll_finalization_action'])
    expect(/^\s*(?:create|alter|drop)\s+(?:table|schema|policy|trigger|index|type|sequence)\b/im.test(appliedSql)).toBe(false)
    expect(/^\s*(?:insert|update|delete|truncate)\b/im.test(appliedSql)).toBe(false)
  })
})
