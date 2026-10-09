import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL('./20261009094208_apiai07_rate_limit_greatest_least_fix.sql', import.meta.url)

describe('APIAI-07 limiter expression fix contract', () => {
  it('keeps GREATEST and LEAST as PostgreSQL expressions under the empty search path', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
    expect(sql).toContain('create or replace function internal_security.consume_api_rate_limit_internal(')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('elapsed_seconds := greatest(')
    expect(sql).toContain('replenished_tokens := least(')
    expect(sql).toContain('retry_after_seconds := least(')
    expect(sql).toMatch(/\n\s+greatest\(/)
    expect(sql).not.toMatch(/pg_catalog\.(?:greatest|least)\s*\(/i)
  })

  it('preserves the SECURITY DEFINER limiter and does not widen its grants', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).replace(/\r\n/g, '\n')
    expect(sql).toContain('security definer')
    expect(sql).toContain('auth.uid()')
    expect(sql).toContain('api_client_claim_is_registered')
    expect(sql).toContain('api_rate_limit_buckets')
    expect(sql).toContain("raise exception 'API_RATE_LIMIT_UNAVAILABLE' using errcode = 'P0001'")
    expect(sql).not.toMatch(/\b(?:grant|revoke)\b/i)
  })
})
