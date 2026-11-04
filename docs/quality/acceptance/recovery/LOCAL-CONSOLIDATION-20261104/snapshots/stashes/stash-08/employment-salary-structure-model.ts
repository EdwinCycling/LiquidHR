import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'

export function buildEmploymentSalaryStructureModel(
  catalog: SalaryStructureCatalog | null,
  enabledStructureIds: readonly string[],
) {
  if (!catalog) return { administrationCatalog: null, applicationOptions: [] }

  const enabled = new Set(enabledStructureIds)
  return {
    applicationOptions: catalog.structures,
    administrationCatalog: {
      ...catalog,
      structures: catalog.structures.filter((structure) => enabled.has(structure.id)),
      revisions: catalog.revisions.filter((revision) => enabled.has(revision.salary_structure_id)),
      scales: catalog.scales.filter((scale) => enabled.has(scale.salary_structure_id)),
      scaleValues: catalog.scaleValues.filter((value) => catalog.revisions.some((revision) => revision.id === value.salary_structure_revision_id && enabled.has(revision.salary_structure_id))),
      steps: catalog.steps.filter((step) => catalog.revisions.some((revision) => revision.id === step.salary_structure_revision_id && enabled.has(revision.salary_structure_id))),
      bands: catalog.bands.filter((band) => enabled.has(band.salary_structure_id)),
      bandValues: catalog.bandValues.filter((value) => catalog.revisions.some((revision) => revision.id === value.salary_structure_revision_id && enabled.has(revision.salary_structure_id))),
      laborConditionRelations: catalog.laborConditionRelations.filter((relation) => enabled.has(relation.salary_structure_id)),
    },
  }
}
