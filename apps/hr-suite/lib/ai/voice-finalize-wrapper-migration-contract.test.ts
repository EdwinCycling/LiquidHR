import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260915193000_fix_voice_finalization_execute.sql'),
  'utf8',
).toLowerCase()

describe('voice finalization service wrapper migration contract', () => {
  it('runs only the service-role wrapper as a definer and keeps direct access revoked', () => {
    expect(migration).toContain('alter function public.finalize_ai_voice_session')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = pg_catalog, public, internal_security, pg_temp')
    expect(migration).toContain('revoke all on function public.finalize_ai_voice_session')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.finalize_ai_voice_session')
    expect(migration).toContain('to service_role')
  })
})
