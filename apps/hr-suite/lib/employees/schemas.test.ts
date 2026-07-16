import { describe, expect, it } from 'vitest'
import {
  addressSchema,
  bankAccountSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  relationSchema,
} from './schemas'

const validEmployee = {
  firstName: 'Sanne',
  birthName: 'Jansen',
  nameUsage: 'BIRTH_NAME',
  gender: 'FEMALE',
  preferredLanguage: 'nl-NL',
  privateEmail: 'sanne@example.nl',
}

describe('employeeCreateSchema', () => {
  it('accepteert automatische nummering en een geldig BSN', () => {
    const parsed = employeeCreateSchema.parse({ ...validEmployee, bsn: '111222333' })
    expect(parsed.employeeNumber).toBeUndefined()
    expect(parsed.bsn).toBe('111222333')
  })

  it('weigert client-side tenantvelden en een ongeldig e-mailadres', () => {
    expect(employeeCreateSchema.safeParse({ ...validEmployee, tenantId: crypto.randomUUID() }).success).toBe(false)
    expect(employeeCreateSchema.safeParse({ ...validEmployee, privateEmail: 'geen-mail' }).success).toBe(false)
  })
})

describe('employeeUpdateSchema', () => {
  it('vereist een concurrency token en ten minste één wijziging', () => {
    expect(employeeUpdateSchema.safeParse({ firstName: 'Piet' }).success).toBe(false)
    expect(employeeUpdateSchema.safeParse({ updatedAt: '2026-07-15T10:00:00.000Z' }).success).toBe(false)
    expect(employeeUpdateSchema.safeParse({ updatedAt: '2026-07-15T10:00:00.000Z', firstName: 'Piet' }).success).toBe(true)
  })
})

describe('employee subresources', () => {
  it('valideert adres, IBAN en relatievelden', () => {
    expect(addressSchema.safeParse({
      street: 'Dorpsstraat', houseNumber: '1', postalCode: '1234 AB', city: 'Utrecht',
      countryCode: 'NL', validFrom: '2026-01-01',
    }).success).toBe(true)
    expect(bankAccountSchema.safeParse({ iban: 'NL91ABNA0417164300', accountHolder: 'Sanne Jansen', isPrimary: true }).success).toBe(true)
    expect(relationSchema.safeParse({ relationType: 'PARENT', lastName: 'Jansen', isEmergencyContact: true }).success).toBe(true)
  })

  it('weigert een ongeldige periode, landcode en IBAN', () => {
    expect(addressSchema.safeParse({
      street: 'A', houseNumber: '1', postalCode: '1', city: 'A', countryCode: 'NLD',
      validFrom: '2026-02-01', validUntil: '2026-01-01',
    }).success).toBe(false)
    expect(bankAccountSchema.safeParse({ iban: 'NL00FOUT', accountHolder: 'A', isPrimary: false }).success).toBe(false)
  })
})
