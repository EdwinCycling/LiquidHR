import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260828070140_ai_foundation_runtime.sql'), 'utf8').toLowerCase()

describe('AI Foundation migration contract', () => {
  it('maakt invocation, technical usage en business audit met tenant/HR-groepgrenzen', () => {
    expect(migration).toContain('create table public.ai_invocations')
    expect(migration).toContain('create table public.ai_technical_usage')
    expect(migration).toContain('create table public.ai_business_audit')
    expect(migration).toContain('ai_invocations_tenant_hr_group_fkey')
    expect(migration).toContain('ai_technical_usage_invocation_scope_fkey')
    expect(migration).toContain('ai_business_audit_invocation_scope_fkey')
    expect(migration).toContain('unique (tenant_id, hr_group_id, actor_user_id, idempotency_key)')
    expect(migration).toContain('feedback_outcome text')
  })

  it('zet RLS vast; directe Data API-toegang blijft dicht en writes zijn service-only', () => {
    for (const table of ['ai_invocations', 'ai_technical_usage', 'ai_business_audit']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`grant select, insert on table public.ai_technical_usage, public.ai_business_audit to service_role`)
    }
    expect(migration).toContain('revoke all on table public.ai_invocations, public.ai_technical_usage, public.ai_business_audit from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update on table public.ai_invocations to service_role')
    expect(migration).toContain('create policy ai_invocations_select_scoped')
    expect(migration).toContain('create policy ai_technical_usage_select_scoped')
    expect(migration).toContain('create policy ai_business_audit_select_scoped')
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read')")
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:audit-read')")
    expect(migration).not.toMatch(/grant (select|insert|update|delete).* to authenticated/)
  })

  it('registreert canonical permissions en bewaart geen raw prompt, response of context', () => {
    for (const permission of ['ai:use', 'ai:manage', 'ai:usage-read', 'ai:audit-read', 'ai:credits-manage']) {
      expect(migration).toContain(`'${permission}'`)
    }
    expect(migration).toContain('ai_technical_usage_append_only')
    expect(migration).toContain('ai_business_audit_append_only')
    expect(migration).not.toMatch(/raw_(prompt|response|context)/)
    expect(migration).not.toContain('authorized_context')
  })
})
