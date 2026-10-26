import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./20261026100906_pay_w04_hr_hours_to_payroll.sql', import.meta.url), 'utf8')

describe('Actual Work to Payroll release migration contract', () => {
  it('keeps release records immutable and behind the HR Admin payroll release RPC', () => {
    expect(migration).toContain('create table public.actual_work_payroll_releases')
    expect(migration).toContain('alter table public.actual_work_payroll_mappings enable row level security')
    expect(migration).toContain('alter table public.actual_work_payroll_releases enable row level security')
    expect(migration).toContain('grant select on public.actual_work_payroll_mappings to authenticated')
    expect(migration).toContain('grant select on public.actual_work_payroll_releases to authenticated')
    expect(migration).toContain('actual_work_payroll_releases_immutable')
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_RELEASE_IMMUTABLE')
    expect(migration).toContain("current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN'])")
    expect(migration).toContain('release_actual_work_entries_for_payroll')
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_RELEASE_REVISION_STALE')
    expect(migration).toContain('entry.status = \'APPROVED\' and entry.approved_at is not null')
  })

  it('pins the exact Payroll component, records corrections for TWK, and rejects automatic TVT pay', () => {
    expect(migration).toContain("system:payfull02:payfull02_variable_regular_wage")
    expect(migration).toContain("'HOURLY_RATE_X_HOURS'")
    expect(migration).toContain("'TWK_REQUIRED'")
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_TVT_DOUBLE_PAYMENT')
    expect(migration).toContain("if new.processing_target = 'PREMIUM' then")
    expect(migration).toContain("message = 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP'")
    expect(migration).toContain("and mapping.processing_target = 'PAYMENT'")
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_MAPPING_EFFECTIVE_OVERLAP')
  })

  it('makes CSV saves idempotent through the canonical Actual Work save function', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('save_actual_work_import_entry')
    expect(migration).toContain("set source_type = 'ACTUAL_WORK_CSV', source_key = requested_source_key")
    expect(migration).toContain('public.save_actual_work_entry(')
    expect(migration).toContain("message = 'ACTUAL_WORK_IMPORT_NOT_AUTHORIZED'")
    expect(migration).toContain("current_user_has_audience_role(requested_tenant_id, array['HR_ADMIN', 'TENANT_ADMIN'])")
  })

  it('serializes overlapping mapping versions and keeps release retries fingerprint-idempotent', () => {
    expect(migration).toContain("new.tenant_id::text || ':' || new.hr_group_id::text || ':' || new.administration_id::text")
    expect(migration).toContain("prior_release_id := saved_release.supersedes_release_id")
    expect(migration).toContain("release_class_value := saved_release.release_class")
    expect(migration).toContain('ACTUAL_WORK_PAYROLL_RELEASE_FINGERPRINT_CONFLICT')
  })

  it('requires an immutable correction revision for direct Actual Work data edits', () => {
    expect(migration).toContain('create constraint trigger actual_work_entry_correction_audit_required')
    expect(migration).toContain('deferrable initially deferred')
    expect(migration).toContain('create or replace function internal_security.require_actual_work_correction_audit()')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain("revision.operation = 'CORRECTION'")
    expect(migration).toContain('revision.reason')
    expect(migration).toContain('revision.actor_user_id = auth.uid()')
    expect(migration).toContain("message = 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED'")
  })
})
