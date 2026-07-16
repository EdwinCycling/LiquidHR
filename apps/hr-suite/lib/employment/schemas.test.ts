import { describe, expect, it } from 'vitest'
import { createEmploymentSchema, identityMatchSchema, terminationSchema } from './schemas'

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
