import type {
  AssignmentResolutionEvidence,
  ResolvedAssignment,
  ResolvedAssignmentCandidate,
} from './assignment-resolver'

export interface MaterializedWorkItemCandidate {
  readonly workItemId: string
  readonly employeeId: string
  readonly candidateUserId: string
  readonly managementRoleId: string | null
  readonly managementRoleCode: string | null
  readonly sourceDepartmentId: string | null
  readonly ancestorPath: readonly string[]
  readonly resolutionRevision: number
  readonly resolutionDate: string
  readonly resolutionPolicy: AssignmentResolutionEvidence['resolutionDatePolicy']
  readonly resolutionSource: string
  readonly evidence: {
    readonly resolution: AssignmentResolutionEvidence
    readonly candidate: ResolvedAssignmentCandidate
  }
  readonly isEligible: true
  readonly ineligibleReason: null
}

export function materializeWorkItemCandidates(
  workItemId: string,
  resolution: ResolvedAssignment,
  resolutionRevision: number,
): readonly MaterializedWorkItemCandidate[] {
  return resolution.candidates.map((candidate) => ({
    workItemId,
    employeeId: candidate.employeeId,
    candidateUserId: candidate.userId,
    managementRoleId: candidate.managementRoleId,
    managementRoleCode: candidate.managementRoleCode,
    sourceDepartmentId: candidate.sourceDepartmentId,
    ancestorPath: candidate.ancestorPath,
    resolutionRevision,
    resolutionDate: resolution.evidence.asOfDate,
    resolutionPolicy: resolution.evidence.resolutionDatePolicy,
    resolutionSource: candidate.source,
    evidence: {
      resolution: resolution.evidence,
      candidate,
    },
    isEligible: true,
    ineligibleReason: null,
  }))
}
