import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20260914192320_actual_work_v1.sql', import.meta.url), 'utf8').toLowerCase()

describe('Actual Work V1 migration contract', () => {
  it('supports day, period and combined entry granularity', () => {
    expect(migration).toContain("create type public.actual_work_entry_granularity as enum ('day', 'period', 'both')")
  })

  it('protects the exposed Actual Work tables with RLS and keeps the function invoker-bound', () => {
    expect(migration).toContain('alter table public.actual_work_type_limits enable row level security')
    expect(migration).toContain('alter table public.actual_work_periods enable row level security')
    expect(migration).toContain('alter table public.actual_work_revisions enable row level security')
    expect(migration).not.toContain('security definer')
  })

  it('does not seed the protected empty boundary group', () => {
    expect(migration).not.toMatch(/['\"]test-boundary['\"]/)
    expect(migration).not.toContain('80975e8a-b0dd-4552-be20-cd3944da9b2b')
  })
})
