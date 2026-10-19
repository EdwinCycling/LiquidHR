export type SalaryStructureRevisionScope = {
  id: string
  salary_structure_id: string
  revision_number: number
  effective_from: string
  status: string
}

export function selectedSalaryStructureRevisionId(
  revisions: readonly SalaryStructureRevisionScope[],
  structureId: string | null,
  requestedRevisionId: string | null,
): string | null {
  if (!structureId) return null

  if (requestedRevisionId) {
    return revisions.find((revision) => revision.id === requestedRevisionId && revision.salary_structure_id === structureId)?.id ?? null
  }

  return revisions
    .filter((revision) => revision.salary_structure_id === structureId)
    .sort((left, right) => {
      if (left.status === 'DRAFT' && right.status !== 'DRAFT') return -1
      if (right.status === 'DRAFT' && left.status !== 'DRAFT') return 1
      return right.effective_from.localeCompare(left.effective_from) || right.revision_number - left.revision_number
    })[0]?.id ?? null
}
