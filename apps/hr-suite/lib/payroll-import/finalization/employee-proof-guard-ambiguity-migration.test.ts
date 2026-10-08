import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261008095000_control02_test_employee_proof_guard_variable_fix.sql', import.meta.url))
const sourceMigrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261008090053_control02_test_income_source_reference_guard_fix.sql', import.meta.url))
const draftEmploymentGuardMigrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261008101012_control02_test_draft_employment_readback_guard_fix.sql', import.meta.url))

function writerFrom(path: string): string {
  const migration = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n').toLowerCase()
  return migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\([\s\S]*?\n\$\$;/)?.[0] ?? ''
}

function latestWriterFromMigrations(): string {
  const directory = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url))
  const names = readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()
  let latest = ''

  for (const name of names) {
    const migration = readFileSync(join(directory, name), 'utf8').replace(/\r\n?/g, '\n').toLowerCase()
    const writer = migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\([\s\S]*?\n\$\$;/)?.[0]
    if (writer) latest = writer
  }

  return latest
}
describe('CONTROL02 employee proof guard ambiguity migration', () => {
  it('renames only the local employee id variable used by the proof guard', () => {
    const writer = writerFrom(migrationPath)
    const sourceWriter = writerFrom(sourceMigrationPath)

    expect(writer).not.toBe('')
    expect(writer).toContain('resolved_target_employee_id uuid;')
    expect(writer).toContain("created.checkpoint ->> 'createdemployeeid' = resolved_target_employee_id::text")
    expect(writer).toContain('current_action.target_employee_id')
    expect(writer).not.toMatch(/(?<!\.)\btarget_employee_id\b/)
    expect(writer).toBe(sourceWriter.replace(/(?<!\.)\btarget_employee_id\b/g, 'resolved_target_employee_id'))
  })

  it('replaces only the CONTROL02 writer and performs no migration-time DML or unrelated DDL', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').trim()
    const functionNames = [...migration.matchAll(/create or replace function public\.([a-z0-9_]+)/gi)].map((match) => match[1].toLowerCase())
    const appliedSql = migration.replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$')

    expect(migration).toMatch(/^begin;\s/)
    expect(migration).toMatch(/;\s*commit;$/)
    expect(functionNames).toEqual(['execute_control02_test_payroll_finalization_action'])
    expect(appliedSql).not.toMatch(/^\s*(?:create|alter|drop)\s+(?:table|schema|policy|trigger|index|type|sequence)\b/im)
    expect(appliedSql).not.toMatch(/^\s*(?:insert|update|delete|truncate)\b/im)
  })
  it('does not require a new draft employment to exist before its id is assigned', () => {
    const writer = latestWriterFromMigrations()
    const readbackGuard = writer.match(/if v_current_action\.action_type = 'create_draft_employment' and \(\s*v_target_employment_id is null([\s\S]*?)raise exception using errcode = '23514', message = 'payroll_finalization_employment_readback_failed'/)

    expect(writer).not.toBe('')
    expect(readbackGuard).not.toBeNull()
    if (!readbackGuard) return
    expect(readbackGuard[0]).toMatch(/v_target_employment_id is null/)
    expect(writer.indexOf(readbackGuard[0])).toBeGreaterThan(writer.indexOf('insert into public.employments as inserted_employment'))
  })
  it('replaces only the CONTROL02 draft-employment guard and runs no migration-time DML', () => {
    const migration = readFileSync(draftEmploymentGuardMigrationPath, 'utf8').replace(/\r\n?/g, '\n').trim()
    const functionNames = [...migration.matchAll(/create or replace function public\.([a-z0-9_]+)/gi)].map((match) => match[1].toLowerCase())
    const appliedSql = migration.replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$')
    const previousWriter = writerFrom(migrationPath)
    const updatedWriter = writerFrom(draftEmploymentGuardMigrationPath)

    expect(functionNames).toEqual(['execute_control02_test_payroll_finalization_action'])
    expect(updatedWriter).toBe(previousWriter.replace(
      "if current_action.action_type = 'create_draft_employment' and not exists (",
      "if current_action.action_type = 'create_draft_employment' and target_employment_id is not null and not exists (",
    ))
    expect(migration).toMatch(/^begin;\s/)
    expect(migration).toMatch(/;\s*commit;$/)
    expect(appliedSql).not.toMatch(/^\s*(?:create|alter|drop)\s+(?:table|schema|policy|trigger|index|type|sequence)\b/im)
    expect(appliedSql).not.toMatch(/^\s*(?:insert|update|delete|truncate)\b/im)
  })
})
