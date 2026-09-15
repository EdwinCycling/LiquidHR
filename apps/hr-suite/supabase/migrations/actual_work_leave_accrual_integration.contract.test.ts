import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const integrationMigration = readFileSync(new URL('./20260915122119_actual_work_leave_accrual_integration.sql', import.meta.url), 'utf8').toLowerCase()
const actualWorkMigration = readFileSync(new URL('./20260914192320_actual_work_v1.sql', import.meta.url), 'utf8').toLowerCase()

describe('Actual Work worked-hours leave accrual integration migration contract', () => {
  it('uses the canonical Actual Work family allowlist and rejects transparent types', () => {
    expect(integrationMigration).toContain("type.family in ('work', 'additional', 'overtime')")
    expect(integrationMigration).toContain("type_family not in ('work', 'additional', 'overtime')")
    expect(integrationMigration).toContain('leave_work_hour_type_not_eligible')
    expect(integrationMigration).toContain('create or replace function public.create_group_leave_accrual_rule(')
    expect(integrationMigration).toContain('create or replace function public.update_group_leave_accrual_rule(')
  })

  it('seals empty and basis-inconsistent mappings at the database boundary', () => {
    expect(integrationMigration).toContain('leave_work_hour_type_required')
    expect(integrationMigration).toContain('leave_work_hour_types_not_allowed')
    expect(integrationMigration).toContain('deferrable initially deferred')
    expect(integrationMigration).toContain('revoke all on function internal_security.assert_leave_accrual_rule_input')
  })

  it('keeps the canonical Actual Work migration name and precision unambiguous', () => {
    expect(existsSync(new URL('./20260914191328_actual_work_v1.sql', import.meta.url))).toBe(false)
    expect(actualWorkMigration).toContain('create type public.actual_work_type_family')
    expect(actualWorkMigration).toContain('numeric(18,8)')
    expect(actualWorkMigration).not.toContain('80975e8a-b0dd-4552-be20-cd3944da9b2b')
  })
})
