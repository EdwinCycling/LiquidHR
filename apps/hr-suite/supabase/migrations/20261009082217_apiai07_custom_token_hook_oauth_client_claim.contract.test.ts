import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261009082217_apiai07_custom_token_hook_oauth_client_claim.sql', import.meta.url)

describe('APIAI-07 OAuth custom-token hook client claim migration', () => {
  it('reads the OAuth client id from the claims object supplied to the token hook', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain("claims jsonb := coalesce(event -> 'claims', '{}'::jsonb)")
    expect(sql).toContain("requested_client_id text := nullif(claims ->> 'client_id', '')")
    expect(sql).not.toContain("requested_client_id text := nullif(event ->> 'client_id', '')")
  })

  it('retains the active Employee-only TEST allowlist and exact resource audience', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain("registration.issuer = 'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'")
    expect(sql).toContain("registration.audience = 'authenticated'")
    expect(sql).toContain('registration.client_id = requested_client_id')
    expect(sql).toContain('registration.is_active')
    expect(sql).toContain("'employee-self-service' = any(registration.allowed_resource_keys)")
    expect(sql).toContain("jsonb_build_array('https://liquid-hr-hr-suite.vercel.app/mcp', 'authenticated')")
    expect(sql).toContain("return jsonb_build_object('claims', claims)")
  })

  it('keeps the hook server-only and does not modify schema or auth records', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('revoke all on function public.apiai07_custom_access_token_hook(jsonb)\n  from public, anon, authenticated, service_role')
    expect(sql).toContain('grant execute on function public.apiai07_custom_access_token_hook(jsonb)\n  to supabase_auth_admin')
    expect(sql).not.toMatch(/create\s+table|\b(?:insert\s+into|update|delete\s+from)\s+auth\./iu)
  })
})
