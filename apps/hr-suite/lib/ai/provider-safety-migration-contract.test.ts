import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260828115844_ai_provider_safety_fup.sql'), 'utf8')

describe('provider safety migration contract', () => {
  it('maakt service-only lease storage met RLS en zonder contentvelden', () => {
    expect(migration).toContain('create table public.ai_provider_safety_environments')
    expect(migration).toContain('create table public.ai_provider_execution_leases')
    expect(migration).toContain('alter table public.ai_provider_execution_leases enable row level security')
    expect(migration).toContain('revoke all on table public.ai_provider_safety_environments, public.ai_provider_execution_leases from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update on table public.ai_provider_execution_leases to service_role')
    expect(migration).not.toMatch(/prompt_text|response_text|raw_hr_context|source_text/i)
  })

  it('borgt atomic UTC volume/concurrency en completion via service RPCs', () => {
    expect(migration).toContain('for update')
    expect(migration).toContain("date_trunc('hour', now_value at time zone 'UTC')")
    expect(migration).toContain("date_trunc('day', now_value at time zone 'UTC')")
    expect(migration).toContain("lease.status = 'ACTIVE'")
    expect(migration).toContain('create or replace function public.reserve_ai_provider_execution')
    expect(migration).toContain('create or replace function public.complete_ai_provider_execution')
    expect(migration).toContain('grant execute on function public.reserve_ai_provider_execution')
    expect(migration).toContain('grant execute on function public.complete_ai_provider_execution')
    expect(migration).toContain("AI_PROVIDER_INVOCATION_LIMIT")
  })
})
