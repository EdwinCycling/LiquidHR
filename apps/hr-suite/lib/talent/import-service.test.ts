import { describe, expect, it } from 'vitest'
import { validateTalentImportCapabilityType } from './import-service'

describe('Talent import capability type validation', () => {
  it('accepts a competency with a talent level and no certificate metadata', () => {
    expect(validateTalentImportCapabilityType({ talent_level_code: 'L1', language_level: '', certificate_code: '', evidence_status: '' }, 'COMPETENCY')).toEqual([])
  })

  it('rejects certificate metadata on a competency before commit', () => {
    expect(validateTalentImportCapabilityType({ talent_level_code: 'L1', language_level: '', certificate_code: '', evidence_status: 'NOT_PROVIDED' }, 'COMPETENCY')).toEqual(['TALENT_IMPORT_CERTIFICATE_METADATA_NOT_ALLOWED'])
  })

  it('requires the value shape that the database trigger accepts for languages and certificates', () => {
    expect(validateTalentImportCapabilityType({ talent_level_code: '', language_level: '', certificate_code: '', evidence_status: '' }, 'LANGUAGE')).toEqual(['TALENT_IMPORT_LANGUAGE_LEVEL_REQUIRED'])
    expect(validateTalentImportCapabilityType({ talent_level_code: '', language_level: '', certificate_code: 'BHV-1', evidence_status: 'NOT_PROVIDED' }, 'CERTIFICATE')).toEqual(['TALENT_IMPORT_CERTIFICATE_STATUS_REQUIRED'])
  })
})
