import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261009112847_apiai07_service_role_postgrest_role_guard.sql', import.meta.url)

describe('APIAI-07 PostgREST service-role guard migration', () => {
  it('checks the effective PostgREST role for both server-only RPCs', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql.match(/current_setting\('role', true\)/gu)).toHaveLength(2)
    expect(sql).toContain("<> 'service_role'")
    expect(sql).not.toMatch(/request\.jwt\.claim(?:\.role|s)/iu)
    expect(sql).toMatch(/create or replace function public\.register_apiai07_mcp_client\([\s\S]*?security definer\s+set search_path = ''/iu)
    expect(sql).toMatch(/create or replace function public\.record_api_read_audit\([\s\S]*?security definer\s+set search_path = ''/iu)
  })

  it('preserves fixed registration scope, validation, and idempotency', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).toContain("'https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1'")
    expect(sql).toContain("array['employee-self-service']::text[]")
    expect(sql).toContain("requested_client_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'")
    expect(sql).toContain('on conflict (issuer, audience, client_id) do update')
    expect(sql).toContain('is_active = true')
  })

  it('does not change function grants, schemas, tables, or rows', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')

    expect(sql).not.toMatch(/^\s*(?:grant|revoke|alter table|create table|drop table)\b/imu)
    expect(sql.match(/create or replace function/giu)).toHaveLength(2)
    expect(sql).not.toMatch(/auth\.oauth_/iu)
    expect(sql).toContain('begin;')
    expect(sql.trimEnd()).toMatch(/commit;$/iu)
  })
})
