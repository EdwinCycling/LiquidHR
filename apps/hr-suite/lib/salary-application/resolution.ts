export type SalaryRevisionStatus = 'DRAFT' | 'PUBLISHED'

export interface SalaryRevisionForResolution {
  id: string
  salaryStructureId: string
  effectiveFrom: string
  revisionNumber: number
  status: SalaryRevisionStatus | string
}

export interface SalaryScaleValueForResolution {
  revisionId: string
  salaryScaleId: string
  code: string
  name?: string
}

export interface SalaryScaleStepForResolution {
  id?: string
  revisionId: string
  salaryScaleId: string
  stepCode: string
  stepName?: string
  fulltimeAmount: string | number
}

export interface SalaryBandValueForResolution {
  id?: string
  revisionId: string
  salaryBandId: string
  code: string
  name?: string
  minimumAmount: string | number
  midpointAmount: string | number
  maximumAmount: string | number | null
}

export interface ResolvedScaleStep {
  revisionId: string
  effectiveFrom: string
  revisionNumber: number
  salaryScaleId: string
  stepCode: string
  stepName: string | null
  fulltimeAmount: string
}

export interface ResolvedSalaryBand {
  revisionId: string
  effectiveFrom: string
  revisionNumber: number
  salaryBandId: string
  code: string
  name: string | null
  minimumAmount: string
  midpointAmount: string
  maximumAmount: string | null
}

function compareRevision(left: SalaryRevisionForResolution, right: SalaryRevisionForResolution): number {
  return right.effectiveFrom.localeCompare(left.effectiveFrom) || right.revisionNumber - left.revisionNumber || right.id.localeCompare(left.id)
}

export function resolvePublishedRevision(
  revisions: readonly SalaryRevisionForResolution[],
  salaryStructureId: string,
  asOf: string,
): SalaryRevisionForResolution | null {
  return revisions
    .filter((revision) => revision.status === 'PUBLISHED' && revision.salaryStructureId === salaryStructureId && revision.effectiveFrom <= asOf)
    .sort(compareRevision)[0] ?? null
}

export function resolveSalaryScaleStepAtDate(input: {
  salaryStructureId: string
  salaryScaleId: string
  stepCode: string
  asOf: string
  revisions: readonly SalaryRevisionForResolution[]
  scaleValues: readonly SalaryScaleValueForResolution[]
  steps: readonly SalaryScaleStepForResolution[]
}): ResolvedScaleStep | null {
  const revision = resolvePublishedRevision(input.revisions, input.salaryStructureId, input.asOf)
  if (!revision) return null

  const scaleValue = input.scaleValues.find((value) => value.revisionId === revision.id && value.salaryScaleId === input.salaryScaleId)
  if (!scaleValue) return null
  const step = input.steps.find((candidate) => candidate.revisionId === revision.id
    && candidate.salaryScaleId === input.salaryScaleId
    && candidate.stepCode.toLocaleUpperCase() === input.stepCode.toLocaleUpperCase())
  if (!step) return null

  return {
    revisionId: revision.id,
    effectiveFrom: revision.effectiveFrom,
    revisionNumber: revision.revisionNumber,
    salaryScaleId: input.salaryScaleId,
    stepCode: step.stepCode,
    stepName: step.stepName ?? null,
    fulltimeAmount: String(step.fulltimeAmount),
  }
}

export function resolveSalaryBandAtDate(input: {
  salaryStructureId: string
  salaryBandId: string
  asOf: string
  revisions: readonly SalaryRevisionForResolution[]
  bandValues: readonly SalaryBandValueForResolution[]
}): ResolvedSalaryBand | null {
  const revision = resolvePublishedRevision(input.revisions, input.salaryStructureId, input.asOf)
  if (!revision) return null
  const value = input.bandValues.find((candidate) => candidate.revisionId === revision.id && candidate.salaryBandId === input.salaryBandId)
  if (!value) return null

  return {
    revisionId: revision.id,
    effectiveFrom: revision.effectiveFrom,
    revisionNumber: revision.revisionNumber,
    salaryBandId: input.salaryBandId,
    code: value.code,
    name: value.name ?? null,
    minimumAmount: String(value.minimumAmount),
    midpointAmount: String(value.midpointAmount),
    maximumAmount: value.maximumAmount === null ? null : String(value.maximumAmount),
  }
}

export function revisionDatesAfter(
  revisions: readonly SalaryRevisionForResolution[],
  salaryStructureId: string,
  after: string,
): string[] {
  return [...new Set(revisions
    .filter((revision) => revision.status === 'PUBLISHED' && revision.salaryStructureId === salaryStructureId && revision.effectiveFrom > after)
    .map((revision) => revision.effectiveFrom))].sort()
}
