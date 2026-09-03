import type { DocumentStudioCompositionRow } from './repository'
import type { CompositionItem } from './schemas'

export function compositionRowsForSave(items: readonly Pick<CompositionItem, 'kind' | 'versionId'>[]): CompositionItem[] {
  return items.map((item, sortOrder) => ({ kind: item.kind, versionId: item.versionId, sortOrder }))
}

export function canAddComposition(
  current: readonly Pick<CompositionItem, 'kind' | 'versionId'>[],
  candidate: Pick<CompositionItem, 'kind' | 'versionId'>,
): boolean {
  if (candidate.kind === 'COVER' && current.some((item) => item.kind === 'COVER')) return false
  return !current.some((item) => item.kind === candidate.kind && item.versionId === candidate.versionId)
}

export function compositionItemsFromRows(rows: readonly DocumentStudioCompositionRow[]): Pick<CompositionItem, 'kind' | 'versionId'>[] {
  return rows.slice().sort((left, right) => left.sort_order - right.sort_order).map((row) => ({ kind: row.component_kind, versionId: row.component_template_version_id }))
}
