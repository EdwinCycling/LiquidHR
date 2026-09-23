import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260922230000_allow_focus_act_as_leave_workflow.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('Focus act-as Leave workflow migration contract', () => {
  it('keeps ESS self scope and permits only the explicit MSS leave permission for act-as', () => {
    expect(migration).toContain("'self:leave:request'")
    expect(migration).toContain("'leave:request'")
    expect(migration).toMatch(
      /if internal_security\.current_user_has_hr_group_permission\([\s\S]*?and not internal_security\.current_user_has_hr_group_permission\([\s\S]*?'leave:request'[\s\S]*?leave_self_scope_required/,
    )
    expect(migration).toContain("raise exception 'leave_request_permission_required'")
  })

  it('keeps the existing atomic process bridge and actor audit fields', () => {
    expect(migration).toContain('insert into public.leave_requests')
    expect(migration).toContain("'ess_process_automation'")
    expect(migration).toContain('actor_user_id')
    expect(migration).toContain('internal_security.start_process')
    expect(migration).toContain('insert into public.process_leave_subjects')
    expect(migration).toContain("'acknowledge'")
  })
})
