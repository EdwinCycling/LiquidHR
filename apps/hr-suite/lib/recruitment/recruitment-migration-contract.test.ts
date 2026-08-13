import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('guided recruitment core migration', () => {
  it('keeps the six-section, scoped RPC and public closed-state contract', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260813115443_guided_recruitment_core_experience.sql'), 'utf8')
    expect(migration).toContain('recruitment_vacancy_sections_title_check')
    expect(migration).toContain("if (select count(*) from jsonb_array_elements(requested_sections)) <> 6")
    expect(migration).toContain('create or replace function public.create_recruitment_vacancy')
    expect(migration).toContain('create or replace function public.update_recruitment_vacancy')
    expect(migration).toContain('create or replace function public.hire_recruitment_application')
    expect(migration).toContain('create or replace function public.recruitment_public_vacancy_state')
    expect(migration).toContain('revoke all on schema internal_recruitment')
    expect(migration).not.toContain('user_active_context')
  })
})
