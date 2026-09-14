import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260914100000_leave_insights_manager_permission.sql'

describe('Leave Insights manager permission migration', () => {
  it('is additive, transactional and keeps provision/audit permissions separate', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql.trimStart().startsWith('begin;')).toBe(true)
    expect(sql.trimEnd().endsWith('commit;')).toBe(true)
    expect(sql).toContain("permission.code = 'report-leave:read'")
    expect(sql).not.toContain("permission.code = 'leave:read'")
    expect(sql).not.toContain("permission.code = 'leave:audit-read'")
    expect(sql).not.toContain("permission.code = 'report-leave-provision:read'")
    expect(sql).not.toMatch(/\b(drop|truncate|delete)\s+/i)
  })

  it('adds only scoped source read policies for the Leave read model', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    for (const policy of [
      'leave_insights_employments_read', 'leave_insights_leave_types_read', 'leave_insights_leave_profiles_read',
      'leave_insights_employee_sets_read', 'leave_insights_employee_set_members_read', 'leave_insights_accrual_rules_read',
      'leave_insights_rule_pause_types_read', 'leave_insights_priority_rules_read', 'leave_insights_priority_rule_items_read',
      'leave_insights_year_controls_read', 'leave_insights_profile_assignments_read', 'leave_insights_accrual_exceptions_read',
      'leave_insights_balance_buckets_read', 'leave_insights_accrual_transactions_read', 'leave_insights_requests_read',
      'leave_insights_absence_cases_read', 'leave_insights_request_allocations_read', 'leave_insights_schedules_read',
      'leave_insights_work_patterns_read', 'leave_insights_work_pattern_days_read', 'leave_insights_holidays_read',
    ]) expect(sql).toContain(`create policy ${policy}`)
    expect(sql.match(/current_user_has_hr_group_permission/g)?.length).toBeGreaterThanOrEqual(21)
    expect(sql).toContain("can_manage_employee(employee_id, 'employee:read')")
  })
})
