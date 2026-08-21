import { describe, expect, it } from 'vitest'
import {
  buildAbsenceCapacityPayload,
  buildAbsenceRecoveryPayload,
  buildAbsenceReportPayload,
  toIndicator,
} from './absence-presentational'

const employeeId = '11111111-1111-4111-8111-111111111111'
const employmentId = '22222222-2222-4222-8222-222222222222'

describe('absence presentation payload contracts', () => {
  it('preserves the tri-state mapping', () => {
    expect(toIndicator('UNKNOWN')).toBeNull()
    expect(toIndicator('YES')).toBe(true)
    expect(toIndicator('NO')).toBe(false)
  })

  it('keeps employment selection and operational report fields', () => {
    expect(buildAbsenceReportPayload({
      employeeId,
      employmentId,
      startDate: '2026-08-21',
      percentage: '50',
      expectedRecovery: '',
      hasSafetyNet: 'UNKNOWN',
      workAccident: 'YES',
      thirdPartyAccident: 'NO',
      idempotencyKey: 'report-2026-08-21',
      selfService: false,
    })).toEqual({
      employeeId,
      employmentId,
      startDate: '2026-08-21',
      absencePercentage: 50,
      expectedRecoveryOn: null,
      hasSicknessBenefitSafetyNet: null,
      isWorkAccident: true,
      isThirdPartyTrafficAccident: false,
      idempotencyKey: 'report-2026-08-21',
    })
  })

  it('keeps self-service reports narrow', () => {
    expect(buildAbsenceReportPayload({
      employeeId,
      employmentId: '',
      startDate: '2026-08-21',
      percentage: '100',
      expectedRecovery: '2026-09-01',
      hasSafetyNet: 'YES',
      workAccident: 'YES',
      thirdPartyAccident: 'YES',
      idempotencyKey: 'self-report-2026-08-21',
      selfService: true,
    })).toEqual({ employeeId, employmentId: undefined, startDate: '2026-08-21', idempotencyKey: 'self-report-2026-08-21' })
  })

  it('keeps recovery and partial-capacity payloads unchanged', () => {
    expect(buildAbsenceRecoveryPayload('case-1', '2026-08-22', 'recovery-2026-08-22')).toEqual({ caseId: 'case-1', recoveredOn: '2026-08-22', idempotencyKey: 'recovery-2026-08-22' })
    expect(buildAbsenceCapacityPayload('case-1', '2026-08-23', '37.5', 'capacity-2026-08-23')).toEqual({ caseId: 'case-1', effectiveOn: '2026-08-23', absencePercentage: 37.5, expectedNextReviewOn: null, idempotencyKey: 'capacity-2026-08-23' })
  })
})
