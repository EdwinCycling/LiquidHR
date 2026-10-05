import type { PayrollImportSourceType } from '../model'
import { CONTROL02_APPROVED_CONTRACT_VERSIONS } from './contract'

/**
 * XML finalization is intentionally impossible in this build. Core and Payroll
 * have not approved the shared Employment/IKV contract and the required scope
 * migration has not been reviewed for application. Reopen this constant only
 * in a separately approved activation change.
 */
export const CONTROL02_FINALIZATION_ACTIVATION = Object.freeze({
  enabled: false,
  approvedContractVersions: CONTROL02_APPROVED_CONTRACT_VERSIONS,
  requiredScopeMigration: '20261004150133_control02_payroll_import_scope_invariants',
})

export type FinalizationEvidence = {
  sourceType: PayrollImportSourceType
  sourceProvenanceVerified: boolean
  officialSchemaValidated: boolean
  sourceImmutable: boolean
  scopeInvariantMigrationApplied: boolean
  contractVersion: string | null
  decisionsComplete: boolean
  decisionsConfirmedByCurrentActor: boolean
  decisionsMatchCurrentSource: boolean
  decisionsMatchCurrentCoreState: boolean
  currentAuthorizationVerified: boolean
  currentAdministrationAndHrGroupVerified: boolean
  currentCorePreconditionsVerified: boolean
}

export type FinalizationGateBlocker =
  | 'FINALIZATION_FEATURE_DISABLED'
  | 'XML_SOURCE_REQUIRED'
  | 'SOURCE_PROVENANCE_UNVERIFIED'
  | 'OFFICIAL_SCHEMA_UNVERIFIED'
  | 'SOURCE_NOT_IMMUTABLE'
  | 'SCOPE_MIGRATION_UNAVAILABLE'
  | 'CONTRACT_VERSION_UNAPPROVED'
  | 'DECISIONS_INCOMPLETE'
  | 'DECISIONS_ACTOR_MISMATCH'
  | 'DECISIONS_SOURCE_STALE'
  | 'DECISIONS_CORE_STATE_STALE'
  | 'AUTHORIZATION_STALE'
  | 'ADMINISTRATION_SCOPE_STALE'
  | 'CORE_PRECONDITIONS_STALE'

export type FinalizationGateResult =
  | { allowed: true; contractVersion: string }
  | { allowed: false; blockers: readonly FinalizationGateBlocker[] }

export function evaluateControl02FinalizationGate(evidence: FinalizationEvidence): FinalizationGateResult {
  const blockers: FinalizationGateBlocker[] = []
  if (!CONTROL02_FINALIZATION_ACTIVATION.enabled) blockers.push('FINALIZATION_FEATURE_DISABLED')
  if (evidence.sourceType !== 'LOONAANGIFTE_XML') blockers.push('XML_SOURCE_REQUIRED')
  if (!evidence.sourceProvenanceVerified) blockers.push('SOURCE_PROVENANCE_UNVERIFIED')
  if (!evidence.officialSchemaValidated) blockers.push('OFFICIAL_SCHEMA_UNVERIFIED')
  if (!evidence.sourceImmutable) blockers.push('SOURCE_NOT_IMMUTABLE')
  if (!evidence.scopeInvariantMigrationApplied) blockers.push('SCOPE_MIGRATION_UNAVAILABLE')
  if (!evidence.contractVersion || !CONTROL02_FINALIZATION_ACTIVATION.approvedContractVersions.includes(evidence.contractVersion)) {
    blockers.push('CONTRACT_VERSION_UNAPPROVED')
  }
  if (!evidence.decisionsComplete) blockers.push('DECISIONS_INCOMPLETE')
  if (!evidence.decisionsConfirmedByCurrentActor) blockers.push('DECISIONS_ACTOR_MISMATCH')
  if (!evidence.decisionsMatchCurrentSource) blockers.push('DECISIONS_SOURCE_STALE')
  if (!evidence.decisionsMatchCurrentCoreState) blockers.push('DECISIONS_CORE_STATE_STALE')
  if (!evidence.currentAuthorizationVerified) blockers.push('AUTHORIZATION_STALE')
  if (!evidence.currentAdministrationAndHrGroupVerified) blockers.push('ADMINISTRATION_SCOPE_STALE')
  if (!evidence.currentCorePreconditionsVerified) blockers.push('CORE_PRECONDITIONS_STALE')

  if (blockers.length > 0 || !evidence.contractVersion) return { allowed: false, blockers }
  return { allowed: true, contractVersion: evidence.contractVersion }
}
