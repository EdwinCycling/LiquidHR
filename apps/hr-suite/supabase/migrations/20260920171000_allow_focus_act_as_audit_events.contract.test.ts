import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260920171000_allow_focus_act_as_audit_events.sql'), 'utf8')

describe('Focus act-as audit event policy contract', () => {
  it('allows only validated START/STOP audit events for the existing capability', () => {
    expect(sql).toContain("'START', 'STOP'")
    expect(sql).toContain("entity_name = 'focus_act_as_session'")
    expect(sql).toContain('actor_user_id = (select auth.uid())')
    expect(sql).toContain("changes ->> 'mode' = 'FOCUS_ESS'")
    expect(sql).toContain("jsonb_typeof(changes -> 'expiresAt') = 'number'")
    expect(sql).toContain("'focus:act-as-employee'")
    expect(sql).toContain('current_user_has_hr_group_permission')
    expect(sql).not.toContain('service_role')
    expect(sql).not.toContain('auth.admin.')
  })

  it('keeps the existing audit action contract and extends it only for the session lifecycle', () => {
    expect(sql).toContain("check (action in ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'REVEAL', 'EXPORT', 'START', 'STOP'))")
    expect(sql).toContain('drop constraint if exists audit_logs_action_check')
  })
})
