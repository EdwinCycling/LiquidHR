import { describe, expect, it } from 'vitest'
import {
  completeEmploymentCreateSchema,
  createEmploymentSchema,
  identityMatchSchema,
  terminationSchema,
} from './schemas'

describe('createEmploymentSchema', () => {
  const valid = {
    employeeId: 'be1f0904-72b8-4e1d-9a10-625711d11d7a',
    employmentNumber: 'DV-001',
    employmentType: 'EMPLOYEE',
    contractType: 'INDEFINITE',
    startsOn: '2026-08-01',
    seniorityDate: '2026-08-01',
    originalHireDate: '2026-08-01',
  }

  it('accepteert parallelle dienstverbanden zonder overlapcontrole in het contract', () => {
    expect(createEmploymentSchema.parse(valid).employmentNumber).toBe('DV-001')
  })

  it('weigert ongeldige perioden en client-side scopevelden', () => {
    expect(createEmploymentSchema.safeParse({ ...valid, endsOn: '2026-07-01' }).success).toBe(false)
    expect(createEmploymentSchema.safeParse({ ...valid, tenantId: crypto.randomUUID() }).success).toBe(false)
    expect(createEmploymentSchema.safeParse({ ...valid, administrationId: crypto.randomUUID() }).success).toBe(false)
  })
})

describe('identityMatchSchema', () => {
  it('vereist voldoende identiteitssignalen zonder BSN', () => {
    expect(identityMatchSchema.safeParse({ birthName: 'Jansen' }).success).toBe(false)
    expect(
      identityMatchSchema.safeParse({ birthName: 'Jansen', birthDate: '1990-01-01' }).success,
    ).toBe(true)
  })
})

describe('terminationSchema', () => {
  it('vereist een interne en wettelijke reden', () => {
    expect(
      terminationSchema.safeParse({
        lastWorkingDay: '2026-12-31',
        internalReasonId: crypto.randomUUID(),
        statutoryReasonId: crypto.randomUUID(),
        initiator: 'EMPLOYEE',
      }).success,
    ).toBe(true)
  })
})

describe('completeEmploymentCreateSchema', () => {
  const valid = {
    employment: {
      employmentNumber: 'DV-100',
      employmentType: 'EMPLOYEE',
      contractType: 'INDEFINITE',
      startsOn: '2026-08-01',
      seniorityDate: '2026-08-01',
      originalHireDate: '2026-08-01',
      isPrimary: true,
    },
    incomeRelationship: {
      ikvNumber: 1,
      payrollTaxSubnumber: '0001',
      validFrom: '2026-08-01',
    },
    organization: {
      departmentId: '343cb812-9b7f-4a22-97bc-7351ad088c8a',
      jobTitle: 'HR adviseur',
      effectiveFrom: '2026-08-01',
    },
    laborCondition: {
      conditionGroup: 'Cao Gemeenten',
      validFrom: '2026-08-01',
    },
    schedule: {
      scheduleType: 'HOURS_AND_AVG_DAYS',
      startWeek: 1,
      averageDaysPerWeek: 5,
      averageHoursPerWeek: 36,
      partTimeFactor: 1,
      timeForTimeAccrual: 0,
      validFrom: '2026-08-01',
    },
    salary: {
      paymentType: 'PERIODIC_FIXED',
      paymentFrequency: 'MONTHLY',
      salaryBasis: 'MANUAL',
      fulltimeAmount: 4200,
      currencyCode: 'EUR',
      validFrom: '2026-08-01',
    },
    costAllocation: {
      validFrom: '2026-08-01',
      allocations: [
        { costCenterId: '62e73cdd-c95f-477c-934d-3c17b308bda2', percentage: 60 },
        { costCenterId: '7c8733fc-7765-4f75-9e61-18458ac31dd8', percentage: 40 },
      ],
    },
  }

  it('accepteert één volledig en atomair dienstverbandpakket', () => {
    expect(completeEmploymentCreateSchema.parse(valid).employment.startsOn).toBe('2026-08-01')
  })

  it('weigert een kostenverdeling die niet exact honderd procent is', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      costAllocation: {
        ...valid.costAllocation,
        allocations: [{ ...valid.costAllocation.allocations[0], percentage: 90 }],
      },
    }).success).toBe(false)
  })

  it('weigert onderdelen met een ingangsdatum buiten het dienstverband', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      schedule: { ...valid.schedule, validFrom: '2026-07-31' },
    }).success).toBe(false)
  })

  it('vereist dat alle initiële tijdlijnen op de startdatum beginnen', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      schedule: { ...valid.schedule, validFrom: '2026-08-02' },
    }).success).toBe(false)
  })
})
