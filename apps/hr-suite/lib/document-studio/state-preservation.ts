import type { DocumentStudioProfileRow, DocumentStudioTypeRow } from './repository'

export interface DocumentTypeEditablePatch {
  readonly code?: string
  readonly name?: { readonly nl: string; readonly en: string }
  readonly description?: { readonly nl: string; readonly en: string }
  readonly retentionKind?: 'PERMANENT' | 'YEARS'
  readonly retentionYears?: number | null
  readonly isActive?: boolean
}

export interface DocumentProfileEditablePatch {
  readonly name?: string
  readonly sourceAdministrationId?: string
  readonly logoAssetId?: string | null
  readonly isDefault?: boolean
  readonly isActive?: boolean
}

export function mergeDocumentTypeEditableState(existing: DocumentStudioTypeRow, patch: DocumentTypeEditablePatch) {
  return {
    code: patch.code ?? existing.code,
    name: patch.name ?? existing.name,
    description: patch.description ?? { nl: existing.description.nl ?? '', en: existing.description.en ?? '' },
    retentionKind: patch.retentionKind ?? existing.retention_kind,
    retentionYears: patch.retentionYears === undefined ? existing.retention_years : patch.retentionYears,
    isActive: patch.isActive === undefined ? existing.is_active : patch.isActive,
  }
}

export function mergeDocumentProfileEditableState(existing: DocumentStudioProfileRow, patch: DocumentProfileEditablePatch) {
  return {
    name: patch.name ?? existing.name,
    sourceAdministrationId: patch.sourceAdministrationId ?? existing.source_administration_id,
    logoAssetId: patch.logoAssetId === undefined ? existing.logo_asset_id : patch.logoAssetId,
    isDefault: patch.isDefault === undefined ? existing.is_default : patch.isDefault,
    isActive: patch.isActive === undefined ? existing.is_active : patch.isActive,
  }
}
