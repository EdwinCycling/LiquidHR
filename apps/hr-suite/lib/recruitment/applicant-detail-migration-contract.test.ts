import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('recruitment applicant detail migration contract', () => {
  it('maakt de bestaande application-create RPC eenduidig voor duplicate-signaling', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260824172115_recruitment_application_normalized_email_fix.sql'), 'utf8').toLowerCase()
    expect(migration).toContain('create or replace function public.create_recruitment_application')
    expect(migration).toContain('calculated_normalized_email')
    expect(migration).toContain('candidate.normalized_email = calculated_normalized_email')
    expect(migration).not.toContain('candidate.normalized_email = normalized_email')
  })
})
