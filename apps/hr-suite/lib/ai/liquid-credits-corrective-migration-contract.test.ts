import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260828162449_ai_liquid_credits_wave1b_corrective.sql',
), 'utf8').replace(/\r\n/g, '\n')

const internalFunctions = [
  'ensure_ai_monthly_allowance(uuid, uuid, text)',
  'reserve_ai_credits(uuid, uuid, uuid, uuid, text, text, text, text)',
  'settle_ai_credits(uuid, uuid)',
  'release_ai_credits(uuid, uuid, text)',
  'get_ai_group_credit_balance(uuid, uuid)',
  'get_ai_actor_quota(uuid, uuid, uuid, text)',
  'get_ai_reservation_allocations(uuid, uuid)',
] as const

describe('Liquid Credits Wave 1B corrective migration contract', () => {
  it('bevat uitsluitend de minimale service-role reachability grants', () => {
    expect(migration).toContain('grant usage on schema internal_security to service_role;')
    for (const functionSignature of internalFunctions) {
      expect(migration).toContain(`grant execute on function internal_security.${functionSignature} to service_role;`)
    }
    expect(migration.match(/grant execute on function internal_security\./g)).toHaveLength(internalFunctions.length)
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)\s+on\s+table/i)
    expect(migration).not.toMatch(/grant\s+all\s+on\s+schema/i)
  })

  it('corrigeert alleen het timestamptz return-contract van de balance-functie', () => {
    expect(migration).toContain('create or replace function internal_security.get_ai_group_credit_balance(')
    expect(migration).toContain('as_of timestamptz')
    expect(migration).toContain("    now()\n  from public.ai_credit_allocations")
    expect(migration).not.toContain("    timezone('utc', now())\n  from public.ai_credit_allocations")
  })

  it('bevat geen andere DDL, destructieve statements of AI-1C scope', () => {
    expect(migration).not.toMatch(/\b(create|alter|drop)\s+(?:table|index|trigger|policy|schema)/i)
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+into?\b/i)
    expect(migration).not.toMatch(/\brevoke\b/i)
    expect(migration.toLowerCase()).not.toMatch(/ai_(?:invocations|provider|technical_usage|business_audit)/)
    expect(migration.toLowerCase()).not.toMatch(/openai|stripe|fup/)
  })
})
