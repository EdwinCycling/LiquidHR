import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260920165000_fix_leave_opening_balance_ambiguous_year.sql'

describe('Leave opening-balance ambiguity fix', () => {
  it('qualifies the cohort year lookup with a distinct PL/pgSQL variable', async () => {
    const sql = await readFile(migrationPath, 'utf8')

    expect(sql).toContain('calculated_accrual_year smallint')
    expect(sql).toContain('candidate.accrual_year = calculated_accrual_year')
    expect(sql).not.toContain('candidate.accrual_year = accrual_year')
    expect(sql).toContain('create or replace function public.create_group_leave_opening_balance_cohort(')
  })
})
