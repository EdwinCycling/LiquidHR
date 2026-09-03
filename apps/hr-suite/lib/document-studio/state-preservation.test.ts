import { describe, expect, it } from 'vitest'
import { mergeDocumentProfileEditableState, mergeDocumentTypeEditableState } from './state-preservation'
import type { DocumentStudioProfileRow, DocumentStudioTypeRow } from './repository'

const typeRow: DocumentStudioTypeRow = { id: 'type', tenant_id: 'tenant', hr_group_id: 'group', code: 'employment', name: { nl: 'Dienstverband', en: 'Employment' }, description: { nl: 'Bestaand', en: 'Existing' }, retention_kind: 'YEARS', retention_years: 7, is_active: false }
const profileRow: DocumentStudioProfileRow = { id: 'profile', tenant_id: 'tenant', hr_group_id: 'group', name: 'Huisstijl', source_administration_id: 'administration', logo_asset_id: '123e4567-e89b-12d3-a456-426614174000', is_default: true, is_active: false }

describe('Document Studio editable state preservation', () => {
  it('keeps description, active state and retention when an update omits them', () => {
    expect(mergeDocumentTypeEditableState(typeRow, { name: { nl: 'Nieuw', en: 'New' } })).toMatchObject({ description: typeRow.description, isActive: false, retentionKind: 'YEARS', retentionYears: 7 })
  })

  it('keeps logo and active state until explicitly changed', () => {
    expect(mergeDocumentProfileEditableState(profileRow, { name: 'Nieuw' })).toMatchObject({ logoAssetId: profileRow.logo_asset_id, isActive: false })
    expect(mergeDocumentProfileEditableState(profileRow, { logoAssetId: null, isActive: true })).toMatchObject({ logoAssetId: null, isActive: true })
  })
})
