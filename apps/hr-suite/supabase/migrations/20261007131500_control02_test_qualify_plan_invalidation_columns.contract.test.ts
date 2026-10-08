import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20261007131500_control02_test_qualify_plan_invalidation_columns.sql'

describe('CONTROL02 plan invalidation output-column qualification', () => {
  it('qualifies the selected plan status against the table alias', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain('select plan.id, plan.status, plan.administration_id, plan.source_hash, plan.analysis_hash, plan.core_state_hash')
    expect(sql).toContain('from public.payroll_import_finalization_plans as plan')
    expect(sql).toContain('where plan.tenant_id = requested_tenant_id')
    expect(sql).not.toMatch(/select id,\s*status,\s*administration_id/i)
  })

  it('keeps the invalidation RPC security-definer scoped and service-role-only', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toMatch(/create or replace function public\.invalidate_payroll_import_finalization_plan\([\s\S]*?security definer[\s\S]*?set search_path = ''/i)
    expect(sql).toContain('revoke all on function public.invalidate_payroll_import_finalization_plan(')
    expect(sql).toContain('from public, anon, authenticated;')
    expect(sql).toContain('to service_role;')
  })
})
