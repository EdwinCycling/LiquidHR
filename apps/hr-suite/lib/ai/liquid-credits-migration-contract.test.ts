import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260828090000_ai_liquid_credits_foundation.sql',
), 'utf8')

const tables = [
  'ai_credit_group_policies',
  'ai_credit_role_quotas',
  'ai_credit_charge_catalog',
  'ai_credit_allocations',
  'ai_credit_reservations',
  'ai_credit_reservation_allocations',
  'ai_credit_actor_usage',
] as const

describe('Liquid Credits migration contract', () => {
  it('legt alle ledger-entiteiten en RLS vast in dezelfde migration', () => {
    for (const table of tables) {
      expect(migration).toContain(`create table public.${table}`)
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('legt integer accounting, immutable historical periods en lifecycle constraints vast', () => {
    expect(migration).toContain('available_credits integer generated always as')
    expect(migration).toContain('used_credits integer generated always as')
    expect(migration).toContain('ai_credit_allocations_period_key')
    expect(migration).toContain('ai_credit_reservations_idempotency_key')
    expect(migration).toContain('ai_credit_reservations_lifecycle_check')
    expect(migration).toContain('ai_credit_reservation_allocations_lifecycle_check')
    expect(migration).toContain('ai_credit_allocations_immutable')
    expect(migration).toContain("source_reference like 'MONTHLY:%'")
    expect(migration).toContain("source_reference like 'BILLING:%'")
    expect(migration).toContain("source_reference like 'CONTROLLED_TEST:%'")
    expect(migration).toContain("interval '12 months'")
  })

  it('maakt reserve, settlement, release en reads uitsluitend als service-role RPC beschikbaar', () => {
    for (const functionName of [
      'ensure_ai_monthly_allowance',
      'reserve_ai_credits',
      'settle_ai_credits',
      'release_ai_credits',
      'get_ai_group_credit_balance',
      'get_ai_actor_quota',
      'get_ai_reservation_allocations',
    ]) {
      expect(migration).toContain(`revoke all on function public.${functionName}`)
      expect(migration).toContain(`grant execute on function public.${functionName}`)
    }
    expect(migration).toContain('grant all on table')
    expect(migration).toContain('to service_role;')
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+table[^;]*\bto\s+authenticated\s*;/i)
  })

  it('begrenst reads op tenant/HR-groep en beschermt de synthetic TEST-grant', () => {
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:credits-manage')")
    expect(migration).toContain("coalesce(current_setting('app.environment', true), '') not in ('test', 'development')")
    expect(migration).toContain("coalesce(current_setting('app.ai_credits_test_mode', true), '') <> 'true'")
    expect(migration).toContain("raise exception 'AI_CREDIT_TEST_MODE_DISABLED'")
    expect(migration).toContain('grant execute on function public.grant_ai_controlled_test_credits')
    expect(migration).not.toContain('stripe')
    expect(migration).not.toContain('OPENAI_API_KEY')
  })
})
