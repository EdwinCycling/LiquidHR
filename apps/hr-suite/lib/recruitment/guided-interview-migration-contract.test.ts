import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('guided interview participation conflict migration contract', () => {
  it('uses the existing five-column participation uniqueness contract', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260825152132_fix_recruitment_guided_interview_participation_conflict.sql'), 'utf8').toLowerCase()

    expect(migration).toContain('create or replace function public.create_recruitment_interview')
    expect(migration).toContain('on conflict (tenant_id, hr_group_id, application_id, interview_id, employee_id) do update')
    expect(migration).not.toContain('on conflict (tenant_id, hr_group_id, interview_id, employee_id) do update')
    expect(migration).not.toMatch(/alter table|create (unique )?index|enable row level security|grant |revoke /)
  })
})
