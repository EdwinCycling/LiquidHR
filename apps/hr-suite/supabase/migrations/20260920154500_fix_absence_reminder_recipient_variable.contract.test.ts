import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260920154500_fix_absence_reminder_recipient_variable.sql'), 'utf8')

describe('absence reminder recipient variable migration contract', () => {
  it('qualifies the PL/pgSQL reminder variable in the recipient projection', () => {
    expect(sql).toContain('created_reminder_id uuid')
    expect(sql).toContain('returning id into created_reminder_id')
    expect(sql).toContain('select requested_tenant_id, created_reminder_id, employee.auth_user_id')
    expect(sql).not.toContain('select requested_tenant_id, reminder_id, employee.auth_user_id')
  })
})
