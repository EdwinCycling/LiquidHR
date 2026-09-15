import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260915140000_ai_admin_settings_voice_accounting.sql'), 'utf8').toLowerCase()

describe('AI administration and voice accounting migration contract', () => {
  it('stores only HR-group governance settings and protects them with scoped admin RLS', () => {
    expect(migration).toContain('create table public.ai_group_settings')
    expect(migration).toContain('unique (tenant_id, hr_group_id)')
    expect(migration).toContain('alter table public.ai_group_settings enable row level security')
    expect(migration).toContain('create policy ai_group_settings_select_scoped')
    expect(migration).toContain('create policy ai_group_settings_insert_scoped')
    expect(migration).toContain('create policy ai_group_settings_update_scoped')
    expect(migration).toContain("'ai:manage'")
    expect(migration).not.toMatch(/prompt\s+text/)
    expect(migration).not.toMatch(/transcript\s+text/)
    expect(migration).not.toMatch(/audio\s+(text|bytea|json)/)
  })

  it('keeps voice accounting idempotent and tied to the central Liquid Credits ledger', () => {
    expect(migration).toContain('create table public.ai_voice_credit_charges')
    expect(migration).toContain('create table public.ai_voice_credit_charge_allocations')
    expect(migration).toContain('unique (tenant_id, hr_group_id, context_type, source_session_id)')
    expect(migration).toContain("feature_code = 'realtime_voice'")
    expect(migration).toContain("quality_profile = 'voice_minute'")
    expect(migration).toContain('ensure_ai_monthly_allowance')
    expect(migration).toContain('expire_ai_credit_allocations')
    expect(migration).toContain('ai_credit_actor_usage')
    expect(migration).toContain('ai_credit_allocations')
    expect(migration).toContain('if found then')
    expect(migration).toContain('grant execute on function public.finalize_ai_voice_session')
    expect(migration).toContain('to service_role')
    expect(migration).toContain('revoke all on function public.finalize_ai_voice_session')
  })

  it('exposes only scoped read paths for usage and retains metadata-only voice rows', () => {
    expect(migration).toContain('create policy ai_voice_credit_charges_select_scoped')
    expect(migration).toContain('create policy ai_voice_credit_charge_allocations_select_scoped')
    expect(migration).toContain("current_user_has_hr_group_permission(tenant_id, hr_group_id, 'ai:usage-read')")
    expect(migration).toContain('termination_reason')
    expect(migration).toContain('duration_seconds')
    expect(migration).toContain('billable_voice_units')
    expect(migration).not.toContain('full_transcript')
    expect(migration).not.toContain('raw_audio')
    expect(migration).not.toContain('raw_prompt')
  })
})
