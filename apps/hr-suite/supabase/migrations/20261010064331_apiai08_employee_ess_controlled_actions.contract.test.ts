import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261010064331_apiai08_employee_ess_controlled_actions.sql', import.meta.url), 'utf8').toLowerCase()

describe('APIAI-08 controlled action migration', () => {
  it('adds only the two Employee ESS action identifiers to the existing draft constraints', () => {
    expect(migration).toContain("'employee_leave_request_create'")
    expect(migration).toContain("'employee_personal_reminder_create'")
    expect(migration).toContain("'draft_leave_request'")
    expect(migration).toContain("'draft_personal_reminder'")
    expect(migration).not.toMatch(/create\s+table|drop\s+table|insert\s+into\s+public\.ai_action_drafts|delete\s+from\s+public\.ai_action_drafts/)
  })

  it('keeps authenticated users out of direct write policies for both new action types', () => {
    const policies = migration.split('create policy').slice(1).join('create policy')
    expect(policies).toContain("'employee_leave_request_create'")
    expect(policies).toContain("'employee_personal_reminder_create'")
    expect(migration).not.toMatch(/grant\s+[^;]+\s+to\s+(public|anon|authenticated)/)
  })

  it('audits prepare, confirmation, execution, failure, and cancellation transitions', () => {
    expect(migration).toContain('audit_controlled_action_draft')
    expect(migration).toContain("event_name := 'prepared'")
    expect(migration).toContain("event_name := 'confirmed'")
    expect(migration).toContain("when 'executing' then 'execution_started'")
    expect(migration).toContain("when 'succeeded' then 'executed'")
    expect(migration).toContain("when 'failed' then 'failed'")
    expect(migration).toContain("when 'cancelled' then 'cancelled'")
  })
})
