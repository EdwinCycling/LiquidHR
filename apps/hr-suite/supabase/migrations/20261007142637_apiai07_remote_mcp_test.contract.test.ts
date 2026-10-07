import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261007131203_apiai07_remote_mcp_test.sql', import.meta.url)

describe('APIAI-07 remote MCP TEST migration contract', () => {
  it('adds only the fixed Employee self-service resource and bounded TEST policy', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
    expect(sql).not.toMatch(/create\s+table/i)
    expect(sql).toContain("'employee-self-service', 5, 0.1, true")
    expect(sql).toContain("'workforce-summary', 'team-skills', 'development-plans', 'employee-self-service'")
    expect(sql).toContain("'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'")
    expect(sql).toContain("'https://liquid-hr-hr-suite.vercel.app/mcp'")
  })

  it('registers a consented DCR client through a service-role-only fixed-scope RPC', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
    expect(sql).toMatch(/create or replace function public\.register_apiai07_mcp_client\(\s*requested_client_id text\s*\)/)
    expect(sql).toContain("current_setting('request.jwt.claim.role', true), '') <> 'service_role'")
    expect(sql).toContain("array['employee-self-service']::text[]")
    expect(sql).toContain('grant execute on function public.register_apiai07_mcp_client(text)\n  to service_role')
    expect(sql).toContain('from public, anon, authenticated, service_role')
  })

  it('binds only active consent-registered MCP clients to the resource audience', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
    expect(sql).toContain('create or replace function public.apiai07_custom_access_token_hook(event jsonb)')
    expect(sql).toContain("registration.audience = 'authenticated'")
    expect(sql).toContain('registration.is_active')
    expect(sql).toContain("'employee-self-service' = any(registration.allowed_resource_keys)")
    expect(sql).toContain("jsonb_build_array('https://liquid-hr-hr-suite.vercel.app/mcp', 'authenticated')")
    expect(sql).toContain('grant execute on function public.apiai07_custom_access_token_hook(jsonb)\n  to supabase_auth_admin')
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.apiai07_custom_access_token_hook\([^)]*\)\s+to\s+(public|anon|authenticated|service_role)/i)
  })

  it('keeps durable READ audit outcomes narrow and service-role-only', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
    expect(sql).toContain("api_outcome is null or api_outcome in ('ALLOWED', 'DENIED', 'RATE_LIMITED', 'FAILED')")
    expect(sql).toContain("(api_outcome = 'FAILED' and api_status_code between 500 and 599)")
    expect(sql).toContain('grant execute on function public.record_api_read_audit')
    expect(sql).toContain('to service_role')
  })
})
