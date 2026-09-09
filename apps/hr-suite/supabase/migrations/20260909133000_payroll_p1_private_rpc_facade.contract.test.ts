import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20260909133000_payroll_p1_private_rpc_facade.sql', 'utf8')
const privateClient = readFileSync('lib/payroll/server/private-client.ts', 'utf8')
const service = readFileSync('lib/payroll/payroll-service.ts', 'utf8')
const browserActions = readFileSync('components/payroll/payroll-settings-actions.tsx', 'utf8')

const rpcNames = [
  'payroll_private_insert_oauth_state',
  'payroll_private_consume_oauth_state',
  'payroll_private_latest_credential',
  'payroll_private_insert_credential',
  'payroll_private_delete_credentials',
] as const

describe('Payroll P1 private RPC façade contract', () => {
  it('keeps payroll_private non-exposed and service_role-only', () => {
    expect(sql).not.toContain('pgrst.db_schemas')
    expect(sql).not.toContain('alter role authenticator')

    for (const rpcName of rpcNames) {
      expect(sql).toContain(`create function public.${rpcName}`)
      expect(sql).toContain(`revoke all on function public.${rpcName}`)
      expect(sql).toContain(`grant execute on function public.${rpcName}`)
      expect(sql).toContain(`comment on function public.${rpcName}`)
    }

    expect(sql.match(/security definer/g)).toHaveLength(rpcNames.length)
    expect(sql.match(/set search_path = pg_catalog/g)).toHaveLength(rpcNames.length)
    expect(sql).toContain('payroll_private.payroll_oauth_states')
    expect(sql).toContain('payroll_private.payroll_connection_credentials')
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('to service_role')
  })

  it('makes OAuth state consumption an atomic one-time operation', () => {
    expect(sql).toContain('and consumed_at is null')
    expect(sql).toContain('and expires_at > requested_consumed_at')
    expect(sql).toContain('set consumed_at = requested_consumed_at')
    expect(sql).toContain('returning jsonb_build_object')
  })

  it('keeps the façade below the existing server/service layer', () => {
    expect(privateClient).toContain("import 'server-only'")
    expect(privateClient).toContain('client.rpc(')
    expect(privateClient).not.toContain("schema('payroll_private')")
    expect(privateClient).not.toContain('from(')
    expect(service).toContain('createPayrollPrivateClient')
    expect(service).not.toContain("client.rpc('payroll_private_")
    expect(browserActions).not.toContain('payroll_private_')
    expect(browserActions).not.toContain('.rpc(')
  })
})
