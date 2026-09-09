import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20260908202548_payroll_p1_nmbrs_connection.sql', 'utf8')
const service = readFileSync('lib/payroll/payroll-service.ts', 'utf8')
const client = readFileSync('lib/payroll/providers/nmbrs/client.ts', 'utf8')

describe('Payroll P1 Nmbrs connection contract', () => {
  it('keeps company discovery metadata scoped and credentials/state private', () => {
    expect(sql).toContain('create table public.payroll_provider_companies')
    expect(sql).toContain('alter table public.payroll_provider_companies enable row level security')
    expect(sql).toContain('create policy payroll_provider_companies_read')
    expect(sql).toContain('create table payroll_private.payroll_oauth_states')
    expect(sql).toContain('revoke all on payroll_private.payroll_oauth_states from public, anon, authenticated')
    expect(sql).toContain('grant select, insert, update, delete on payroll_private.payroll_oauth_states to service_role')
    expect(sql).toContain('create index payroll_oauth_states_expiry_idx')
    expect(sql).toContain('create index payroll_oauth_states_connection_idx')
    expect(sql).toContain('drop policy if exists payroll_connections_insert')
    expect(sql).toContain('drop policy if exists payroll_company_bindings_insert')
    expect(sql).not.toContain('insert into public.employees')
    expect(sql).not.toContain('insert into public.employments')
    expect(sql).not.toContain('update public.employees')
    expect(sql).not.toContain('update public.employments')
  })

  it('covers every P1 OAuth state foreign key with a private index migration', () => {
    const indexes = readFileSync('supabase/migrations/20260909100000_payroll_p1_advisor_indexes.sql', 'utf8')
    expect(indexes).toContain('on payroll_private.payroll_oauth_states (provider_id)')
    expect(indexes).toContain('on payroll_private.payroll_oauth_states (initiated_by_user_id)')
  })

  it('exposes only the P1 Nmbrs health and company endpoints', () => {
    expect(client).toContain("'/api/user/info?pageNumber=1&pageSize=100'")
    expect(client).toContain("`/api/companies?pageNumber=")
    expect(client).not.toContain('/api/employees')
    expect(client).not.toContain('/api/employments')
    expect(service).not.toContain("from('employees')")
    expect(service).not.toContain("from('employments')")
    expect(service).toContain('createPayrollPrivateClient')
    expect(service).toContain('encryptPayrollCredential')
    expect(readFileSync('app/api/payroll/providers/nmbrs/callback/route.ts', 'utf8')).toContain('stateMatchesCookie')
  })
})
