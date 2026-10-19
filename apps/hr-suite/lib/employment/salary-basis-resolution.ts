export type EmploymentSalaryBasis = 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE' | 'SALARY_BAND' | 'CAO_SCALE'
export type EmploymentSalaryRoute = 'MANUAL' | 'MINIMUM_WAGE' | 'SCALE_WITH_STEPS' | 'SALARY_BAND'

export type PublishedSalaryBasisRevision = {
  readonly salaryStructureId: string
  readonly effectiveFrom: string
  readonly revisionNumber: number
  readonly status: string
  readonly salaryBasis: string
}

export function resolveEmploymentSalaryBasis(input: {
  readonly route: EmploymentSalaryRoute
  readonly salaryStructureId: string | null
  readonly effectiveOn: string
  readonly revisions: readonly PublishedSalaryBasisRevision[]
  readonly existingBasis?: EmploymentSalaryBasis
}): EmploymentSalaryBasis {
  if (input.route === 'MANUAL') return 'MANUAL'
  if (input.route === 'MINIMUM_WAGE') return 'MINIMUM_WAGE'
  if (input.route === 'SALARY_BAND') return 'SALARY_BAND'

  const applicableRevision = input.salaryStructureId
    ? input.revisions
      .filter((revision) => revision.status === 'PUBLISHED'
        && revision.salaryStructureId === input.salaryStructureId
        && revision.effectiveFrom <= input.effectiveOn)
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom)
        || right.revisionNumber - left.revisionNumber)[0]
    : undefined

  if (applicableRevision?.salaryBasis === 'CAO_SCALE') return 'CAO_SCALE'
  if (applicableRevision) return 'CUSTOM_SCALE'
  return input.existingBasis === 'CAO_SCALE' ? 'CAO_SCALE' : 'CUSTOM_SCALE'
}
