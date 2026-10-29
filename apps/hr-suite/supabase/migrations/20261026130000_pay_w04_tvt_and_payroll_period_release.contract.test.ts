import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261026130000_pay_w04_tvt_and_payroll_period_release.sql', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')

describe('W04 TVT and Payroll period release migration', () => {
  it('requires an explicit expiry policy and posts approved overtime into the existing leave ledger', () => {
    expect(migration).toContain('add column if not exists tvt_expiration_months smallint')
    expect(migration).toContain('ACTUAL_WORK_TVT_EXPIRATION_NOT_CONFIGURED')
    expect(migration).toContain("leave_type.entitlement_mode = 'OVERTIME_HOURS'")
    expect(migration).toContain("cohort := 'ACTUAL_WORK_TVT:' || entry_row.id::text")
    expect(migration).toContain("'ACTUAL_WORK_TVT', entry_row.id, source_key")
    expect(migration).toContain('on conflict (bucket_id, source_key) do nothing')
    expect(migration).toContain('ACTUAL_WORK_TVT_CORRECTION_BALANCE_IN_USE')
  })

  it('makes HR approval and TVT posting one authorized transaction', () => {
    expect(migration).toMatch(/create or replace function public\.approve_actual_work_entry_for_payroll\([\s\S]*?security invoker\s+set search_path = ''/)
    expect(migration).toContain("array['HR_ADMIN', 'TENANT_ADMIN']")
    expect(migration).toContain('public.save_actual_work_entry(')
    expect(migration).toContain('public.post_actual_work_tvt_for_revision(')
    expect(migration).toContain('ACTUAL_WORK_TVT_RECLASSIFICATION_REVIEW_REQUIRED')
    expect(migration).toContain('actual_work_tvt_reclassification_guard')
  })

  it('stores an explicit immutable calendar period and rejects unsupported legacy release calls', () => {
    expect(migration).toContain('payroll_period_id uuid')
    expect(migration).toContain("requested_payroll_periodicity = 'FOUR_WEEKLY'")
    expect(migration).toContain('requested_payroll_period_end - requested_payroll_period_start <> 27')
    expect(migration).toContain("'payrollPeriodId', requested_payroll_period_id")
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_RELEASE_PERIOD_ASSIGNMENT_CONFLICT')
    expect(migration).toContain('revoke all on function public.release_actual_work_entries_for_payroll(uuid, uuid, uuid, date, jsonb) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.release_actual_work_entries_for_payroll_period')
  })
})
