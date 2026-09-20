import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(resolve(__dirname, '20260920172000_grant_focus_act_as_audit_insert.sql'), 'utf8')

describe('Focus act-as audit insert grant contract', () => {
  it('grants only the table privilege needed for the RLS-protected audit insert', () => {
    expect(sql).toContain('grant insert on public.audit_logs to authenticated')
    expect(sql).not.toContain('service_role')
    expect(sql).not.toContain('grant insert on public.audit_logs to public')
  })
})
