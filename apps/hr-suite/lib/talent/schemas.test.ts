import { describe, expect, it } from 'vitest'
import { jobProfileVersionUpdateSchema, talentCapabilityCreateSchema, talentCategoryCreateSchema, talentEmployeeCapabilityAdminCreateSchema, talentEmployeeCapabilityAdminUpdateSchema, talentEmployeeCapabilitySelfCreateSchema, talentLevelCreateSchema, talentSeniorityCreateSchema } from './schemas'

describe('Talent schemas', () => {
  it('accepts the seeded seniority shape', () => {
    expect(talentSeniorityCreateSchema.parse({ code: 'senior', name: 'Senior' })).toMatchObject({ code: 'senior', sortOrder: 1 })
  })

  it('requires a supported capability type', () => {
    expect(() => talentCapabilityCreateSchema.parse({ capabilityType: 'OTHER', code: 'X', name: 'X' })).toThrow()
    expect(talentCapabilityCreateSchema.parse({ capabilityType: 'COMPETENCY', code: 'COMM', name: 'Communicatie' }).capabilityType).toBe('COMPETENCY')
  })

  it('keeps language CEFR semantics separate from Talent Levels', () => {
    const parsed = talentCapabilityCreateSchema.parse({ capabilityType: 'LANGUAGE', code: 'NL', name: 'Nederlands', languageCefr: 'B2' })
    expect(parsed.languageCefr).toBe('B2')
    expect(() => talentCapabilityCreateSchema.parse({ capabilityType: 'LANGUAGE', code: 'NL', name: 'Nederlands', languageCefr: 'B2', certificateCode: 'CERT' })).toThrow()
  })

  it('keeps certificate semantics separate from Talent Levels', () => {
    expect(talentCapabilityCreateSchema.parse({ capabilityType: 'CERTIFICATE', code: 'VCA', name: 'VCA', certificateIsPermanent: true }).certificateIsPermanent).toBe(true)
    expect(() => talentCapabilityCreateSchema.parse({ capabilityType: 'CERTIFICATE', code: 'VCA', name: 'VCA', certificateIsPermanent: true, certificateValidityMonths: 12 })).toThrow()
  })

  it('accepts a dynamic level model reference and category typescope', () => {
    expect(talentLevelCreateSchema.parse({ levelModelId: '00000000-0000-4000-8000-000000000001', code: 'L10', name: 'Expert', sortOrder: 10 }).sortOrder).toBe(10)
    expect(talentCategoryCreateSchema.parse({ code: 'TECH', name: 'Techniek', capabilityTypes: ['SKILL', 'KNOWLEDGE'] }).capabilityTypes).toEqual(['SKILL', 'KNOWLEDGE'])
  })

  it('accepts date-effective profile content without inventing fixed levels', () => {
    const parsed = jobProfileVersionUpdateSchema.parse({
      status: 'DRAFT', validFrom: '2026-08-01', tasks: ['Analyseer'], responsibilities: ['Rapporteer'], resultAreas: ['Kwaliteit'],
    })
    expect(parsed.validFrom).toBe('2026-08-01')
    expect(parsed.tasks).toEqual(['Analyseer'])
  })

  it('rejects empty profile updates', () => {
    expect(() => jobProfileVersionUpdateSchema.parse({})).toThrow()
  })

  it('accepts a self-entered certificate record payload', () => {
    const parsed = talentEmployeeCapabilitySelfCreateSchema.parse({
      capabilityId: '2934f544-6c56-133d-02f9-dc39347769ae',
      talentLevelId: null,
      languageLevel: null,
      languageIsNative: false,
      certificateStatus: 'VALID',
      validFrom: '2026-08-02',
      validUntil: null,
      evidenceDocumentId: null,
    })
    expect(parsed.certificateStatus).toBe('VALID')
  })

  it('accepts HR qualification metadata and keeps evidence reference-only', () => {
    const parsed = talentEmployeeCapabilityAdminCreateSchema.parse({
      employeeId: '2934f544-6c56-133d-02f9-dc39347769ae',
      capabilityId: '2934f544-6c56-133d-02f9-dc39347769af',
      certificateStatus: 'VALID',
      certificateIssuingBody: 'Arbo Veiligheid',
      certificateCode: 'VCA-2026-001',
      certificateValidityMonths: 36,
      certificateRenewalRequired: true,
      evidenceStatus: 'PENDING',
      validFrom: '2026-08-02',
      validUntil: '2029-08-01',
    })
    expect(parsed.certificateCode).toBe('VCA-2026-001')
    expect(parsed.evidenceDocumentId).toBeUndefined()
  })

  it('rejects inconsistent permanent and verified evidence states', () => {
    expect(() => talentEmployeeCapabilityAdminCreateSchema.parse({
      employeeId: '2934f544-6c56-133d-02f9-dc39347769ae',
      capabilityId: '2934f544-6c56-133d-02f9-dc39347769af',
      certificateStatus: 'PERMANENT',
      certificateIsPermanent: true,
      validFrom: '2026-08-02',
      validUntil: '2027-08-01',
    })).toThrow()
    expect(() => talentEmployeeCapabilityAdminUpdateSchema.parse({
      version: 1,
      capabilityId: '2934f544-6c56-133d-02f9-dc39347769af',
      certificateStatus: 'VALID',
      evidenceStatus: 'VERIFIED',
      validFrom: '2026-08-02',
    })).toThrow()
  })
})
