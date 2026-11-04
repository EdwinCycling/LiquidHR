import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'
import { describe, expect, it } from 'vitest'
import { buildEmploymentSalaryStructureModel } from './employment-salary-structure-model'

function catalogWithStructures(...ids: string[]): SalaryStructureCatalog {
  const structures: SalaryStructureCatalog['structures'] = ids.map((id) => ({
    id,
    tenant_id: 'tenant',
    hr_group_id: 'group',
    structure_type: 'SCALE_WITH_STEPS',
    code: id.toUpperCase(),
    name: id,
    description: null,
    is_active: true,
    created_at: '2026-10-01T00:00:00.000Z',
    created_by_user_id: null,
    updated_at: '2026-10-01T00:00:00.000Z',
    updated_by_user_id: null,
  }))

  return {
    structures,
    revisions: [],
    scales: [],
    scaleValues: [],
    steps: [],
    bands: [],
    bandValues: [],
    laborConditionRelations: [],
    migrationConflicts: [],
    canReadAmounts: true,
    canWriteStructures: true,
    canWriteRelations: true,
  }
}

describe('buildEmploymentSalaryStructureModel', () => {
  it('keeps new HR-group structures selectable while limiting the administration catalog to enabled IDs', () => {
    const model = buildEmploymentSalaryStructureModel(catalogWithStructures('existing', 'kinderopvang-test'), ['existing'])

    expect(model.applicationOptions.map((structure) => structure.id)).toEqual(['existing', 'kinderopvang-test'])
    expect(model.administrationCatalog?.structures.map((structure) => structure.id)).toEqual(['existing'])
  })

  it('returns no choices when the caller cannot read the salary structure catalog', () => {
    const model = buildEmploymentSalaryStructureModel(null, [])

    expect(model.applicationOptions).toEqual([])
    expect(model.administrationCatalog).toBeNull()
  })
})
