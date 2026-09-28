import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260928072242_ai01_a2_durable_recovery.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .toLowerCase()
const foundationMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260828080428_ai_foundation_runtime.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .toLowerCase()
const voiceAccountingMigration = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260915163650_ai_admin_settings_voice_accounting.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .toLowerCase()

function functionBody(source: string, functionName: string): string {
  const start = source.indexOf(`create or replace function ${functionName}`)
  if (start < 0) throw new Error(`Missing function ${functionName}`)
  const end = source.indexOf('\n$$;', start)
  if (end < 0) throw new Error(`Unterminated function ${functionName}`)
  return source.slice(start, end)
}

const settle = functionBody(migration, 'internal_security.settle_ai_invocation')
const release = functionBody(migration, 'internal_security.release_ai_invocation')
const audit = functionBody(migration, 'internal_security.record_ai_invocation_business_audit')
const invocationRecovery = functionBody(migration, 'internal_security.reconcile_ai_invocation_lifecycle')
const voiceRecovery = functionBody(migration, 'internal_security.reconcile_expired_ai_voice_sessions')

describe('AI01-A2 durable recovery migration contract', () => {
  it('A: settles credits, marks the invocation successful, and leaves a transactional audit outbox signal', () => {
    expect(settle).toContain('perform internal_security.settle_ai_credits')
    expect(settle).toContain("set execution_status = 'succeeded'")
    expect(settle).toContain("business_audit_status = 'pending'")
    expect(audit).toContain('for update')
    expect(audit).toContain('on conflict (invocation_id) do nothing')
    expect(audit).toContain("business_audit_status = 'recorded'")
    expect(invocationRecovery).toContain("invocation.execution_status = 'settling'")
    expect(invocationRecovery).toContain("reservation.status = 'settled'")
    expect(invocationRecovery).toContain("execution_status = 'succeeded'")
    expect(invocationRecovery).toContain('settlement_count := settlement_count + 1')
    expect(foundationMigration).toContain('invocation_id uuid not null unique references public.ai_invocations(id)')
  })

  it('B: persists release intent and atomically terminalizes only after RELEASED', () => {
    expect(migration).toContain('add column release_reason text')
    expect(release).toContain("reservation_row.status = 'settled'")
    expect(release).toContain("reservation_row.status = 'reserved'")
    expect(release).toContain('perform internal_security.release_ai_credits')
    expect(release).toContain("set execution_status = 'failed'")
    expect(invocationRecovery).toContain("reservation.status = 'reserved'")
    expect(invocationRecovery).toContain("invocation.execution_status = 'releasing' and reservation.status = 'released'")
    expect(invocationRecovery).toContain('limit requested_batch_size')
  })

  it('C: uses bounded row locks and SKIP LOCKED for concurrent reconcilers', () => {
    expect(invocationRecovery).toContain('for update of invocation skip locked')
    expect(migration).toContain('for update of session skip locked')
    expect(migration).toContain('requested_batch_size > 100')
  })

  it('D: expires stale voice sessions from the stored server deadline and finalizes accounting', () => {
    expect(migration).toContain('finalization_deadline_at timestamptz')
    expect(migration).toContain('create or replace function internal_security.set_ai_voice_finalization_deadline()')
    expect(migration).toContain('new.finalization_deadline_at := new.started_at + (new.max_duration_seconds * interval')
    expect(migration).toContain('alter column finalization_deadline_at set not null')
    expect(voiceRecovery).toContain("session.finalization_deadline_at <= timezone('utc', now())")
    expect(voiceRecovery).toContain("set status = 'ended'")
    expect(voiceRecovery).toContain("termination_reason = 'timeout'")
    expect(voiceRecovery).toContain('internal_security.finalize_ai_voice_session(')
  })

  it('E: retries pending voice accounting and relies on one unique session charge', () => {
    expect(voiceRecovery).toContain("session.voice_credit_status = 'pending'")
    expect(voiceRecovery).toContain("voice_credit_status = 'settled'")
    expect(voiceAccountingMigration).toContain('unique (tenant_id, hr_group_id, context_type, source_session_id)')
  })

  it('F: keeps disabled capabilities out of recovery while tool routes reconcile before current AI gates', () => {
    expect(voiceRecovery).not.toContain('ai_enabled')
    expect(voiceRecovery).not.toContain('voice_enabled')
    expect(voiceRecovery).not.toContain('current_user_has_hr_group_permission')
  })

  it('G: scopes recovery by trusted tenant and group inputs and exposes only service-role RPCs', () => {
    expect(invocationRecovery).toContain('invocation.tenant_id = requested_tenant_id')
    expect(invocationRecovery).toContain('invocation.hr_group_id = requested_hr_group_id')
    expect(voiceRecovery).toContain('session.tenant_id = requested_tenant_id')
    expect(voiceRecovery).toContain('session.hr_group_id = requested_hr_group_id')
    expect(migration).toContain('revoke all on function public.reconcile_expired_ai_voice_sessions')
    expect(migration).toContain('grant execute on function public.reconcile_expired_ai_voice_sessions')
    expect(migration).toContain('to service_role;')
    expect(migration).not.toMatch(/returns table\s*\([^)]*\b(?:session_id|invocation_id)\b[^)]*\)/)
  })

  it('H: leaves the outbox pending when the audit write fails and counts retryable failures', () => {
    expect(audit).toContain("business_audit_status = 'recorded'")
    expect(invocationRecovery).toContain('exception when others then')
    expect(invocationRecovery).toContain('retry_count := retry_count + 1')
  })

  it('I: refuses release after settlement and makes repeated settlement a no-op', () => {
    expect(release).toContain("raise exception 'ai_credit_reservation_settled'")
    expect(settle).toContain("invocation_row.execution_status = 'succeeded'")
    expect(settle).toContain("reservation_row.status = 'settled'")
  })

  it('J: refuses settlement after release and makes repeated release a no-op', () => {
    expect(settle).toContain("reservation_row.status = 'released'")
    expect(settle).toContain("raise exception 'ai_credit_reservation_released'")
    expect(release).toContain("elsif reservation_row.status <> 'released'")
  })
})
