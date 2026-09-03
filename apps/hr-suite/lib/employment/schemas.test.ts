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
    employmentNumber: '1',
    employmentType: 'EMPLOYEE',
    contractType: 'INDEFINITE',
    startsOn: '2026-08-01',
    seniorityDate: '2026-08-01',
    originalHireDate: '2026-08-01',
  }

  it('accepteert parallelle dienstverbanden zonder overlapcontrole in het contract', () => {
    expect(createEmploymentSchema.parse(valid).employmentNumber).toBe('1')
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
      employmentNumber: '100',
      startsOn: '2026-08-01',
      seniorityDate: '2026-08-01',
      countryCode: 'NL',
      isPrimary: true,
    },
    incomeRelationship: {
      ikvNumber: 1,
      payrollTaxSubnumber: '0001',
      validFrom: '2026-08-01',
    },
    organization: {
      departmentId: '343cb812-9b7f-4a22-97bc-7351ad088c8a',
      jobId: '683b3fb4-3183-4f4c-9adb-4a356164c51e',
      jobTitle: 'HR adviseur',
      effectiveFrom: '2026-08-01',
    },
    contract: {
      workerType: 'EMPLOYEE',
      laborConditionSetId: 'a0f5d57b-0956-473e-a84a-970ab42e1826',
      durationType: 'INDEFINITE',
      startsOn: '2026-08-01',
      probationApplies: false,
    },
    schedule: {
      scheduleType: 'HOURS_AND_AVG_DAYS',
      startWeek: 1,
      averageDaysPerWeek: 5,
      averageHoursPerWeek: 40,
      partTimeFactor: 1,
      timeForTimeAccrual: 0,
      isOnCall: false,
      workScope: 'FULL_TIME',
      mondayHours: 8,
      tuesdayHours: 8,
      wednesdayHours: 8,
      thursdayHours: 8,
      fridayHours: 8,
      validFrom: '2026-08-01',
    },
    salary: {
      paymentType: 'PERIODIC_FIXED',
      paymentFrequency: 'MONTHLY',
      salaryBasis: 'MANUAL',
      fulltimeAmount: 4200,
      parttimeAmount: 4200,
      currencyCode: 'EUR',
      salaryFrequencyId: '4dc72351-5bcc-45f2-9823-253c597583c0',
      validFrom: '2026-08-01',
    },
    costAllocation: {
      validFrom: '2026-08-01',
      allocations: [
        {
          costCenterId: '62e73cdd-c95f-477c-934d-3c17b308bda2',
          costCarrierId: 'f5f460c0-1815-48da-8857-999297a97e06',
          percentage: 60,
        },
        {
          costCenterId: '7c8733fc-7765-4f75-9e61-18458ac31dd8',
          costCarrierId: 'f5f460c0-1815-48da-8857-999297a97e06',
          percentage: 40,
        },
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

  it('vereist een flexfase uitsluitend voor een uitzendkracht', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      contract: { ...valid.contract, workerType: 'TEMPORARY_AGENCY', flexPhaseId: null },
    }).success).toBe(false)
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      contract: { ...valid.contract, flexPhaseId: crypto.randomUUID() },
    }).success).toBe(false)
  })

  it('vereist dat het rooster exact aansluit op de weekuren', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      schedule: { ...valid.schedule, fridayHours: 7 },
    }).success).toBe(false)
  })

  it('weigert een IKV-nummer buiten 1 tot en met 99', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      incomeRelationship: { ...valid.incomeRelationship, ikvNumber: 100 },
    }).success).toBe(false)
  })

  it('weigert een proeftijd buiten het tijdelijke contract als structurele fout', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      employment: { ...valid.employment, startsOn: '2026-08-01', seniorityDate: '2026-08-01' },
      contract: { ...valid.contract, durationType: 'DEFINITE', endsOn: '2026-09-01', probationApplies: true, probationEndsOn: '2026-09-02' },
    }).success).toBe(false)
  })

  it('weigert een proeftijd-einddatum wanneer proeftijd niet van toepassing is', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      contract: { ...valid.contract, probationApplies: false, probationEndsOn: '2026-09-01' },
    }).success).toBe(false)
  })

  it('laat een niet-toegestane proeftijd als waarschuwing door', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      contract: { ...valid.contract, durationType: 'DEFINITE', endsOn: '2027-01-31', probationApplies: true, probationEndsOn: '2026-09-01' },
    }).success).toBe(true)
  })

  it('laat een te lange proeftijd als waarschuwing door', () => {
    expect(completeEmploymentCreateSchema.safeParse({
      ...valid,
      contract: { ...valid.contract, durationType: 'DEFINITE', endsOn: '2027-08-01', probationApplies: true, probationEndsOn: '2026-10-01' },
    }).success).toBe(true)
  })

  it('accepteert de volledige on-call inzending uit de wizard', () => {
    const result = completeEmploymentCreateSchema.safeParse({
      employment: { employmentNumber: '1', employmentType: 'EMPLOYEE', startsOn: '2026-09-01', seniorityDate: '2026-09-01', countryCode: 'NL', isPrimary: false },
      incomeRelationship: { payrollTaxSubnumber: '0001', ikvNumber: 2, validFrom: '2026-09-01' },
      contract: { workerType: 'EMPLOYEE', flexPhaseId: null, laborConditionSetId: '4a3f96c5-45db-2cd9-5aff-971eee7eab44', durationType: 'INDEFINITE', startsOn: '2026-09-01', endsOn: null, probationApplies: false, probationEndsOn: null },
      schedule: { scheduleType: 'HOURS_PER_DAY', startWeek: 1, averageDaysPerWeek: 0, averageHoursPerWeek: 0, partTimeFactor: 0, timeForTimeAccrual: 0, mondayHours: 0, tuesdayHours: 0, wednesdayHours: 0, thursdayHours: 0, fridayHours: 0, saturdayHours: 0, sundayHours: 0, isOnCall: true, onCallObligation: true, workScope: null, validFrom: '2026-09-01' },
      salary: { paymentType: 'PERIODIC_FIXED', paymentFrequency: 'FOUR_WEEKLY', salaryFrequencyId: '9cea4610-0b69-e90a-20f3-1d77e04248f4', salaryBasis: 'MANUAL', fulltimeAmount: 3500, parttimeAmount: 1, hourlyRate: null, currencyCode: 'EUR', salaryScaleStepId: null, validFrom: '2026-09-01' },
      organization: { departmentId: 'b551dc4c-0482-3911-5e7a-5b40cf8fe113', jobId: '1ddf85af-721d-4887-a5e4-74dd2c037ee4', jobTitle: 'Monteur', managerEmployeeId: '6f2e2302-748f-8684-0ce6-1b29702d5d92', effectiveFrom: '2026-09-01' },
      costAllocation: { validFrom: '2026-09-01', allocations: [{ costCenterId: 'f6401e40-e815-a9c0-2d5f-072dc201bb99', costCarrierId: '74bb945b-aca7-5707-8548-a7d2ea5739c2', percentage: 100 }] },
    })
    expect(result.success).toBe(true)
  })
})
