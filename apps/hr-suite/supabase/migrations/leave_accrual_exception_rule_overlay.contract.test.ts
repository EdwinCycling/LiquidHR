import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260913100000_leave_accrual_exception_rule_overlay.sql'

describe('Leave accrual exception rule overlay migration', () => {
  it('returns the base rule together with the employment exception overlay', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('select rule_value.*')
    expect(sql).toContain('into rule_row')
    expect(sql).toContain("'EMPLOYMENT_EXCEPTION', exception_row.no_accrual")
    expect(sql).toContain('rule_row.id')
    expect(sql).toContain('exception_row.accrual_amount')
    expect(sql).toContain('exception_row.expiration_months')
  })

  it('keeps the resolver effective-dated, target-specific and authenticated-only', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('exception_value.employment_id = requested_employment_id')
    expect(sql).toContain('exception_value.leave_type_id = requested_leave_type_id')
    expect(sql).toContain('exception_value.valid_from <= requested_as_of_date')
    expect(sql).toContain('(exception_value.valid_until is null or exception_value.valid_until > requested_as_of_date)')
    expect(sql).toContain('revoke all on function public.resolve_leave_accrual_rule_for_employment')
    expect(sql).toContain('grant execute on function public.resolve_leave_accrual_rule_for_employment')
    expect(sql).toContain('to authenticated')
  })
})
