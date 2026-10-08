import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const directory = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url))
const previousName = '20261008101012_control02_test_draft_employment_readback_guard_fix.sql'
function writerFrom(migration: string): string {
  return migration.replace(/\r\n?/g, '\n').match(/create or replace function public\.execute_control02_test_payroll_finalization_action\([\s\S]*?\n\$\$;/)?.[0] ?? ''
}
function latestWriter(): { migration: string; writer: string } {
  let latest = { migration: '', writer: '' }
  for (const name of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    const migration = readFileSync(join(directory, name), 'utf8').replace(/\r\n?/g, '\n')
    const writer = writerFrom(migration)
    if (writer) latest = { migration, writer }
  }
  return latest
}

describe('CONTROL02 target-ID ambiguity regression', () => {
  it('keeps ledger columns distinct from local target IDs in completed-action proof and remaining IKV paths', () => {
    const { writer } = latestWriter()
    expect(writer).not.toBe('')
    expect(writer).not.toMatch(/(?<!\.)\btarget_employment_id\b/)
    expect(writer).not.toMatch(/(?<!\.)\btarget_income_relationship_id\b/)
    expect(writer).toContain("created.checkpoint ->> 'createdEmploymentId' = v_target_employment_id::text")
    expect(writer).toContain('v_current_action.target_employment_id')
    expect(writer).toContain('v_current_action.target_income_relationship_id')
  })
  it('preserves the approved writer behavior and grants with only local variable renaming', () => {
    const migration = readFileSync(join(directory, '20261008150542_control02_test_writer_target_id_variable_fix.sql'), 'utf8').replace(/\r\n?/g, '\n')
    const writer = writerFrom(migration)
    const previous = readFileSync(join(directory, previousName), 'utf8').replace(/\r\n?/g, '\n')
    const expected = previous.replace(/(?<!\.)\btarget_employment_id\b/g, 'resolved_target_employment_id')
      .replace(/(?<!\.)\btarget_income_relationship_id\b/g, 'resolved_target_income_relationship_id')
    expect(writer).toBe(writerFrom(expected))
    expect(migration.trim()).toBe(expected.trim())
    const topLevel = migration.replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$')
    expect(topLevel).not.toMatch(/^\s*(?:insert|update|delete|truncate)\b/im)
    expect(topLevel).not.toMatch(/^\s*(?:create|alter|drop)\s+(?:table|schema|policy|trigger|index|type|sequence)\b/im)
  })
})
