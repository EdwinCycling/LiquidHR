import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261008170847_apiai07_service_role_registration_claim_compatibility.sql', import.meta.url)

describe('APIAI-07 service-role registration claim compatibility migration', () => {
  it('accepts the legacy role setting or the PostgREST JSON claims role', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain("nullif(current_setting('request.jwt.claim.role', true), '')")
    expect(sql).toContain("nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'")
    expect(sql).toContain("<> 'service_role'")
    expect(sql).not.toMatch(/auth\.role\s*\(/iu)
  })

  it('keeps UUID validation, the fixed TEST scope, and idempotent active registration', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain("requested_client_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'")
    expect(sql).toContain("'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'")
    expect(sql).toContain("'authenticated'")
    expect(sql).toContain("array['employee-self-service']::text[]")
    expect(sql).toContain('on conflict (issuer, audience, client_id) do update')
    expect(sql).toContain('is_active = true')
  })

  it('revokes inherited execute access and grants only service_role', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain('revoke all on function public.register_apiai07_mcp_client(text)\n  from public, anon, authenticated, service_role')
    expect(sql).toContain('grant execute on function public.register_apiai07_mcp_client(text)\n  to service_role')
    expect(sql).not.toMatch(/grant execute on function public\.register_apiai07_mcp_client\(text\)[\s\S]{0,80}\bto\s+(?:public|anon|authenticated)\b/iu)
    expect(sql).not.toMatch(/\b(?:update|insert\s+into|delete\s+from)\s+auth\.oauth_/iu)
  })
})
