import { describe, expect, it } from 'vitest'
import { absenceCaseCreateSchema, absenceCapacityChangeSchema, absenceRecoverySchema } from './schemas'

const employeeId = '11111111-1111-4111-8111-111111111111'

describe('absence schemas', () => {
  it('accepteert operationele ziekmeldinformatie zonder medische velden', () => {
    const result = absenceCaseCreateSchema.safeParse({
      employeeId,
      startDate: '2026-07-26',
      absencePercentage: 100,
      expectedRecoveryOn: null,
      hasSicknessBenefitSafetyNet: null,
      isWorkAccident: false,
      isThirdPartyTrafficAccident: false,
      idempotencyKey: 'absence-create-2026-07-26-01',
    })
    expect(result.success).toBe(true)
  })

  it('weigert medische of onbekende velden door strict schema', () => {
    const result = absenceCaseCreateSchema.safeParse({ employeeId, startDate: '2026-07-26', diagnosis: 'griep' })
    expect(result.success).toBe(false)
  })

  it('valideert percentagewijziging en herstel', () => {
    expect(absenceCapacityChangeSchema.safeParse({ caseId: employeeId, effectiveOn: '2026-07-27', absencePercentage: 50, idempotencyKey: 'capacity-change-2026-07-26' }).success).toBe(true)
    expect(absenceRecoverySchema.safeParse({ caseId: employeeId, recoveredOn: '2026-07-30', idempotencyKey: 'recovery-2026-07-26' }).success).toBe(true)
  })
})
