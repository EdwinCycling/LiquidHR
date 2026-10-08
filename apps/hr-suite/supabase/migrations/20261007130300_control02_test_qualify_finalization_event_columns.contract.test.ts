import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20261007130300_control02_test_qualify_finalization_event_columns.sql'

describe('CONTROL02 finalization event output-column qualification', () => {
  it('qualifies action and status columns that collide with RETURNS TABLE outputs', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain('payroll_import_finalization_actions.action_id = requested_action_id')
    expect(sql).toContain('payroll_import_finalization_action_events.action_id = requested_action_id')
    expect(sql.match(/payroll_import_finalization_actions\.status = 'COMPLETED'/g)).toHaveLength(2)
    expect(sql).not.toContain('and action_id = requested_action_id')
    expect(sql).not.toContain("where status = 'COMPLETED'")
  })

  it('keeps the transition RPC security-definer scoped and service-role-only', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toMatch(/create or replace function public\.record_payroll_import_finalization_event\([\s\S]*?security definer[\s\S]*?set search_path = ''/i)
    expect(sql).toContain('revoke all on function public.record_payroll_import_finalization_event(')
    expect(sql).toContain(') from public, anon, authenticated;')
    expect(sql).toContain(') to service_role;')
  })
})