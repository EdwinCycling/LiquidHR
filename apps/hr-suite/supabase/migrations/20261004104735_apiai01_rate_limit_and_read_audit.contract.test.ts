import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(__dirname, '20261004104735_apiai01_rate_limit_and_read_audit.sql'), 'utf8')

describe('APIAI-01 limiter and read-audit migration contract', () => {
  it('keeps limiter state private and binds consumption to the authenticated bearer', () => {
    expect(migration).toContain('create table internal_security.api_rate_limit_policies')
    expect(migration).toContain('create table internal_security.api_client_registrations')
    expect(migration).toContain('create table internal_security.api_rate_limit_buckets')
    expect(migration).toContain('auth.uid()')
    expect(migration).toContain("auth.jwt() ->> 'client_id'")
    expect(migration).toContain("jsonb_typeof((select auth.jwt() -> 'aud')) = 'array'")
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('on conflict (tenant_id, hr_group_id, actor_user_id, oauth_client_id, resource_key)')
    expect(migration).toContain('requested_resource_key,\n    policy_capacity,\n    now_value')
    expect(migration).not.toContain('requested_resource_key,\n    policy_capacity - 1,\n    now_value')
    expect(migration).toContain('grant execute on function public.consume_api_rate_limit')
    expect(migration).not.toContain('grant select on table internal_security.api_rate_limit_buckets')
    expect(migration).not.toContain('service_role')
  })

  it('uses canonical audit_logs with a narrow nullable-entity READ contract', () => {
    expect(migration).toContain('alter column entity_id drop not null')
    expect(migration).toContain("entity_name = 'api_resource'")
    expect(migration).toContain("action = 'READ'")
    expect(migration).toContain('changes = \'{}\'::jsonb')
    expect(migration).toContain("and changes = '{}'::jsonb")
    expect(migration).toContain('audit_logs_insert_api_read')
    expect(migration).toContain('has_hr_group_access')
    expect(migration).toContain('has_administration_access')
    expect(migration).toContain('record_api_read_audit')
    expect(migration).toContain('correlation_id')
    expect(migration).not.toContain('result_count')
    expect(migration).not.toContain('raw_ip')
    expect(migration).not.toContain('authorization_header')
    expect(migration).not.toContain('entity_id = requested_tenant_id')
  })

  it('keeps default quota rows disabled until approval', () => {
    expect(migration).toContain("('workforce-summary', 10, 1, false)")
    expect(migration).toContain("('team-skills', 10, 1, false)")
    expect(migration).toContain("('development-plans', 10, 1, false)")
  })
})
