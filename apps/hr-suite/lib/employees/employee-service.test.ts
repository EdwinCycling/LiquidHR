import { describe, expect, it } from 'vitest'
import {
  isPostgresConflict,
  toEmployeeInsert,
  toEmployeeUpdate,
  toPublicEmployee,
} from './employee-mappers'

describe('employee service mappers', () => {
  it('maakt uitsluitend toegestane insertkolommen en normaliseert lege waarden', () => {
    const row = toEmployeeInsert('tenant-een', '100001', {
      firstName: '  Sanne ',
      birthName: 'Jansen',
      nameUsage: 'BIRTH_NAME',
      gender: 'FEMALE',
      preferredLanguage: 'nl-NL',
      privateEmail: null,
    })
    expect(row).toMatchObject({ tenant_id: 'tenant-een', employee_number: '100001', first_name: 'Sanne' })
    expect(row).not.toHaveProperty('bsn_ciphertext')
    expect(row).not.toHaveProperty('bsn_fingerprint')
  })

  it('verwijdert concurrencyvelden uit de updatepayload', () => {
    const row = toEmployeeUpdate({ updatedAt: '2026-07-15T10:00:00.000Z', firstName: 'Piet' })
    expect(row).toEqual({ first_name: 'Piet' })
  })

  it('serialiseert nooit BSN-kolommen naar de publieke employeevorm', () => {
    const employee = toPublicEmployee({
      id: crypto.randomUUID(), tenant_id: crypto.randomUUID(), employee_number: '100001',
      first_name: 'Sanne', birth_name: 'Jansen', updated_at: '2026-07-15T10:00:00Z',
      is_active: true, private_email: null, work_email: null,
    })
    expect(employee).not.toHaveProperty('bsnCiphertext')
    expect(employee).not.toHaveProperty('bsnFingerprint')
  })

  it('herkent unieke en exclusion conflicts', () => {
    expect(isPostgresConflict({ code: '23505' })).toBe(true)
    expect(isPostgresConflict({ code: '23P01' })).toBe(true)
    expect(isPostgresConflict({ code: '42501' })).toBe(false)
  })
})
