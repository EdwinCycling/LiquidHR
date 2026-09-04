import { describe, expect, it } from 'vitest'
import {
  buildAbsenceCapacityPayload,
  buildAbsenceRecoveryPayload,
  buildAbsenceReportPayload,
  getReportableAbsenceEmploymentOptions,
  formatAbsenceEmployeePickerLabel,
  getDefaultAbsenceCapacityEffectiveOn,
  toIndicator,
} from './absence-presentational'

const employeeId = '11111111-1111-4111-8111-111111111111'
const employmentId = '22222222-2222-4222-8222-222222222222'

describe('absence presentation payload contracts', () => {
  it('disambiguates employees only when they have multiple employments', () => {
    const employee = {
      firstName: 'Frans',
      birthNamePrefix: null,
      birthName: 'Bakker',
      employmentCount: 1,
      departmentName: 'Finance',
      jobTitle: 'Controller',
    }

    expect(formatAbsenceEmployeePickerLabel(employee)).toBe('Frans Bakker')
    expect(formatAbsenceEmployeePickerLabel({ ...employee, employmentCount: 2 })).toBe('Frans Bakker [Finance / Controller]')
  })

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
    expect(buildAbsenceCapacityPayload('case-1', '2026-08-23', '18', 'capacity-hours-2026-08-23', { inputMode: 'HOURS', absenceHoursPerWeek: '18' })).toEqual({ caseId: 'case-1', effectiveOn: '2026-08-23', inputMode: 'HOURS', absenceHoursPerWeek: 18, expectedNextReviewOn: null, idempotencyKey: 'capacity-hours-2026-08-23' })
  })

  it('laat een tweede dienstverband rapporteerbaar als het eerste al open is', () => {
    const options = [
      { id: 'employment-a', employmentNumber: 'A', startsOn: '2020-01-01', endsOn: null, administrationName: 'BV A', departmentName: 'HR', functionName: 'Manager' },
      { id: 'employment-b', employmentNumber: 'B', startsOn: '2020-01-01', endsOn: null, administrationName: 'BV B', departmentName: 'Finance', functionName: 'Analist' },
    ]
    expect(getReportableAbsenceEmploymentOptions(options, [{ employmentId: 'employment-a', status: 'ACTIVE' }]).map((option) => option.id)).toEqual(['employment-b'])
  })

  it('laat een herreport binnen het herstelvenster rapporteerbaar', () => {
    const options = [{ id: 'employment-a' }, { id: 'employment-b' }]
    expect(getReportableAbsenceEmploymentOptions(options, [{ employmentId: 'employment-a', status: 'RECOVERY_WINDOW' }]).map((option) => option.id)).toEqual(['employment-a', 'employment-b'])
  })

  it('defaults capacity changes to an actual date', () => {
    expect(getDefaultAbsenceCapacityEffectiveOn({ spells: [{ capacityEffectiveOn: '2026-08-22' }] }, new Date('2026-08-22T12:00:00.000Z'))).toBe('2026-08-22')
    expect(getDefaultAbsenceCapacityEffectiveOn({ spells: [{ capacityEffectiveOn: '2026-08-21' }] }, new Date('2026-08-22T12:00:00.000Z'))).toBe('2026-08-22')
    expect(getDefaultAbsenceCapacityEffectiveOn(null, new Date('2026-08-22T12:00:00.000Z'))).toBe('2026-08-22')
  })
})
