export interface PensionArrangementVersionCandidate {
  readonly id: string
  readonly pension_arrangement_id: string
  readonly version_number: number
  readonly effective_from: string
  readonly effective_to: string | null
  readonly is_active: boolean
}

export type PensionArrangementVersionResolutionReason =
  | 'PENSION_ARRANGEMENT_NOT_ACTIVE'
  | 'PENSION_ARRANGEMENT_PERIOD_GAP'
  | 'PENSION_ARRANGEMENT_VERSION_NOT_EFFECTIVE'
  | 'PENSION_ARRANGEMENT_VERSION_CHANGE_WITHIN_PERIOD'

export interface PensionArrangementVersionResolution<T extends PensionArrangementVersionCandidate> {
  readonly hasVersionHistory: boolean
  readonly selected: T | null
  readonly reasonCode: PensionArrangementVersionResolutionReason | null
  readonly changeVersionIds: readonly string[]
}

/** Return the immutable baseline version date used to distinguish arrangement inception from a successor's effective date. */
export function getPensionArrangementEstablishedFrom<T extends PensionArrangementVersionCandidate>(
  versions: readonly T[],
  pensionArrangementId: string,
): string | null {
  const baselines = versions.filter((version) =>
    version.pension_arrangement_id === pensionArrangementId && version.version_number === 1,
  )
  return baselines.length === 1 ? baselines[0]!.effective_from : null
}

/**
 * Resolve the latest explicit successor effective at the start of a payroll
 * period. A later inactive/expired version does not revive its predecessor.
 */
export function resolvePensionArrangementVersion<T extends PensionArrangementVersionCandidate>(
  versions: readonly T[],
  pensionArrangementId: string,
  periodStart: string,
  periodEnd: string,
): PensionArrangementVersionResolution<T> {
  const history = versions.filter((version) => version.pension_arrangement_id === pensionArrangementId)
  const candidates = history
    .filter((version) => version.effective_from <= periodStart)
    .sort((left, right) => right.version_number - left.version_number
      || right.effective_from.localeCompare(left.effective_from)
      || left.id.localeCompare(right.id))
  const selected = candidates[0] ?? null
  const changeVersions = history
    .filter((version) => version.effective_from > periodStart && version.effective_from <= periodEnd)
    .sort((left, right) => left.effective_from.localeCompare(right.effective_from)
      || left.version_number - right.version_number
      || left.id.localeCompare(right.id))
  const changeVersionIds = changeVersions.map((version) => version.id)

  if (changeVersions.length > 0) {
    return { hasVersionHistory: history.length > 0, selected, reasonCode: 'PENSION_ARRANGEMENT_VERSION_CHANGE_WITHIN_PERIOD', changeVersionIds }
  }
  if (history.length > 0 && selected === null) {
    return { hasVersionHistory: true, selected: null, reasonCode: 'PENSION_ARRANGEMENT_VERSION_NOT_EFFECTIVE', changeVersionIds }
  }
  if (selected === null) {
    return { hasVersionHistory: false, selected: null, reasonCode: null, changeVersionIds }
  }
  if (!selected.is_active || (selected.effective_to !== null && selected.effective_to < periodStart)) {
    return { hasVersionHistory: true, selected, reasonCode: 'PENSION_ARRANGEMENT_NOT_ACTIVE', changeVersionIds }
  }
  if (selected.effective_to !== null && selected.effective_to < periodEnd) {
    return { hasVersionHistory: true, selected, reasonCode: 'PENSION_ARRANGEMENT_PERIOD_GAP', changeVersionIds }
  }
  return { hasVersionHistory: true, selected, reasonCode: null, changeVersionIds }
}
