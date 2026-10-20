export type PensionArrangementActionDiagnostic = {
  readonly sourceCategory: 'PENSION_ARRANGEMENT_SUCCESSOR'
  readonly errorCode: string
  readonly correlationId: string
}

const SAFE_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,95}$/

const KNOWN_SUCCESSOR_ERROR_CODES = new Set([
  'PENSION_ARRANGEMENT_AUTHENTICATION_REQUIRED',
  'PENSION_ARRANGEMENT_SUCCESSOR_INPUT_INVALID',
  'PENSION_ARRANGEMENT_PREDECESSOR_NOT_FOUND',
  'PENSION_ARRANGEMENT_SUCCESSOR_FORBIDDEN',
  'PENSION_ARRANGEMENT_SCOPE_MISMATCH',
  'PENSION_ARRANGEMENT_PREDECESSOR_ALREADY_SUPERSEDED',
  'PENSION_ARRANGEMENT_SUCCESSOR_FLAT_RATE_INVALID',
  'PENSION_ARRANGEMENT_SUCCESSOR_TIERS_INVALID',
  'PENSION_GRANDFATHERING_CONTRACT_CLASSIFICATION_UNPROVEN',
  'PENSION_GRANDFATHERING_ELIGIBILITY_INVALID',
  'PENSION_CONTRACT_CLASSIFICATION_PROVENANCE_REQUIRED',
  'PENSION_CONTRACT_CLASSIFICATION_SOURCE_REQUIRED',
  'PENSION_ARRANGEMENT_SUCCESSOR_TIER_OVERLAP',
  'PENSION_ARRANGEMENT_SUCCESSOR_TIER_INVALID',
])

const KNOWN_SUCCESSOR_CONSTRAINTS: ReadonlyArray<readonly [string, string]> = [
  ['pension_arrangement_versions_effective_dates_chk', 'PENSION_ARRANGEMENT_SUCCESSOR_EFFECTIVE_PERIOD_INVALID'],
  ['pension_arrangement_versions_flat_rate_chk', 'PENSION_ARRANGEMENT_SUCCESSOR_RATE_INVALID'],
  ['pension_arrangement_versions_split_chk', 'PENSION_ARRANGEMENT_SUCCESSOR_PREMIUM_SPLIT_INVALID'],
  ['pension_arrangement_versions_lineage_chk', 'PENSION_ARRANGEMENT_SUCCESSOR_LINEAGE_INVALID'],
  ['pension_arrangement_versions_number_key', 'PENSION_ARRANGEMENT_VERSION_CONFLICT'],
  ['pension_arrangement_versions_successor_key', 'PENSION_ARRANGEMENT_PREDECESSOR_ALREADY_SUPERSEDED'],
  ['pension_arrangement_versions_arrangement_scope_fk', 'PENSION_ARRANGEMENT_SCOPE_MISMATCH'],
  ['pension_arrangement_versions_parent_scope_fk', 'PENSION_ARRANGEMENT_SCOPE_MISMATCH'],
  ['pension_arrangement_version_tiers_unique_band', 'PENSION_ARRANGEMENT_SUCCESSOR_TIER_CONFLICT'],
]

export function pensionArrangementSuccessorFailure(error: {
  readonly code?: unknown
  readonly message?: unknown
}): { readonly errorCode: string; readonly status: number } {
  const message = typeof error.message === 'string' ? error.message : ''
  const embeddedCode = message.match(/\b(PENSION_[A-Z0-9_]+)\b/)?.[1]
  if (embeddedCode && KNOWN_SUCCESSOR_ERROR_CODES.has(embeddedCode)) {
    return { errorCode: embeddedCode, status: successorStatus(embeddedCode) }
  }

  const constraint = KNOWN_SUCCESSOR_CONSTRAINTS.find(([name]) => message.includes(name))
  if (constraint) return { errorCode: constraint[1], status: successorStatus(constraint[1]) }

  const databaseCode = typeof error.code === 'string' ? error.code : ''
  const errorCode = databaseCode === '23502'
    ? 'PENSION_ARRANGEMENT_SUCCESSOR_REQUIRED_FIELD_MISSING'
    : databaseCode === '23503'
      ? 'PENSION_ARRANGEMENT_SCOPE_REFERENCE_INVALID'
      : databaseCode === '23505'
        ? 'PENSION_ARRANGEMENT_VERSION_CONFLICT'
        : databaseCode === '23514'
          ? 'PENSION_ARRANGEMENT_SUCCESSOR_CONSTRAINT_INVALID'
          : databaseCode === '22P02' || databaseCode === '22023'
            ? 'PENSION_ARRANGEMENT_SUCCESSOR_INPUT_INVALID'
            : databaseCode === 'PGRST202'
              ? 'PENSION_ARRANGEMENT_SUCCESSOR_FUNCTION_UNAVAILABLE'
              : databaseCode === '42501'
                ? 'PENSION_ARRANGEMENT_SUCCESSOR_FORBIDDEN'
                : 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED'
  return { errorCode, status: successorStatus(errorCode) }
}

function successorStatus(errorCode: string): number {
  if (errorCode.endsWith('_FORBIDDEN')) return 403
  if (errorCode.endsWith('_NOT_FOUND')) return 404
  if (errorCode.includes('_CONFLICT') || errorCode.endsWith('_ALREADY_SUPERSEDED') || errorCode.endsWith('_SCOPE_MISMATCH')) return 409
  if (errorCode.endsWith('_FAILED') || errorCode.endsWith('_UNAVAILABLE') || errorCode.endsWith('_INVALID') && errorCode.includes('FUNCTION')) return 500
  return 400
}

export function pensionArrangementActionDiagnostic(
  errorCode: string,
  correlationId: string,
): PensionArrangementActionDiagnostic {
  return {
    sourceCategory: 'PENSION_ARRANGEMENT_SUCCESSOR',
    errorCode: SAFE_ERROR_CODE_PATTERN.test(errorCode)
      ? errorCode
      : 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED',
    correlationId,
  }
}
