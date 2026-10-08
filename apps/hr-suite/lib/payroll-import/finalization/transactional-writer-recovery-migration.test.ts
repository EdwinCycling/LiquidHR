import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationPath = fileURLToPath(new URL('../../../supabase/migrations/20261008083419_control02_completion_event_lease_and_employee_allocator_reconciliation.sql', import.meta.url))

describe('CONTROL02 completion and employee-number recovery migration', () => {
  it('records a completed action without a lease expiry while retaining its lease owner and token', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').toLowerCase()
    const writer = migration.match(/create or replace function public\.execute_control02_test_payroll_finalization_action\([\s\S]*?\n\$\$;/)?.[0] ?? ''
    const eventKeyIndex = writer.indexOf("'core-completed:'")
    const callStart = eventKeyIndex < 0 ? -1 : writer.lastIndexOf('from public.record_payroll_import_finalization_event(', eventKeyIndex)
    const callEnd = eventKeyIndex < 0 ? -1 : writer.indexOf('\n  );', eventKeyIndex)
    const completionCall = callStart < 0 || callEnd < 0 ? '' : writer.slice(callStart, callEnd).replace(/\s+/g, ' ')

    expect(completionCall).toContain("'completed'")
    expect(completionCall).toContain('action_checkpoint, null, null, current_action.lease_owner, current_action.lease_token_hash')
  })

  it('reconciles the tenant allocator above every existing numeric employee number atomically', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').toLowerCase()
    const allocator = migration.match(/create or replace function public\.reserve_employee_number\([\s\S]*?\n\$\$;/)?.[0] ?? ''
    const normalizedAllocator = allocator.replace(/\s+/g, ' ')

    expect(allocator).not.toBe('')
    expect(normalizedAllocator).toContain('e.tenant_id = p_tenant_id')
    expect(normalizedAllocator).toContain("case when e.employee_number ~ '^[0-9]+$' then coalesce(nullif(ltrim(e.employee_number, '0'), ''), '0')::numeric end")
    expect(allocator).toContain('minimum_next_value')
    expect(normalizedAllocator).toContain('greatest( public.employee_number_sequences.next_value + 1, excluded.next_value )')
    expect(allocator).toContain('returning next_value - 1 into reserved_value')
    expect(allocator).toContain('employee:write')
    expect(allocator).toContain('employee_number_forbidden')
  })

  it('replaces only the two scoped functions and preserves a transactional migration envelope', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n?/g, '\n').trim()
    const functionNames = [...migration.matchAll(/create or replace function public\.([a-z0-9_]+)/gi)].map((match) => match[1].toLowerCase())
    const appliedSql = migration.replace(/\$\$[\s\S]*?\$\$/g, '$$BODY$$')

    expect(migration).toMatch(/^begin;\s/)
    expect(migration).toMatch(/;\s*commit;$/)
    expect(functionNames).toEqual([
      'execute_control02_test_payroll_finalization_action',
      'reserve_employee_number',
    ])
    expect(appliedSql).not.toMatch(/^\s*(?:create|alter|drop)\s+(?:table|schema|policy|trigger|index)\b/im)
    expect(appliedSql).not.toMatch(/^\s*(?:delete|truncate)\s+/im)
  })
})