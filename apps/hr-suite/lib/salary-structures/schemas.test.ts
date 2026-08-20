import { describe, expect, it } from 'vitest'
import { salaryStructureCreateSchema, salaryStructureDraftSaveSchema, salaryStructureDraftSchema } from './schemas'

describe('salary structure schemas', () => {
  it('accepts both fixed salary structure types and an optional code', () => {
    expect(salaryStructureCreateSchema.parse({ name: 'CAO Rijk salarisschalen', code: 'RIJK', structureType: 'SCALE_WITH_STEPS' })).toMatchObject({ code: 'RIJK' })
    expect(salaryStructureCreateSchema.parse({ name: 'Functiehuis', code: null, structureType: 'SALARY_BAND' })).toMatchObject({ code: null })
  })

  it('accepts a two-step scale and free labels', () => {
    const draft = salaryStructureDraftSchema.parse({
      structureType: 'SCALE_WITH_STEPS', effectiveFrom: '2026-07-01', salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR',
      scales: [{
        code: 'SPEC', name: 'Specialisten', sortOrder: 0, progressionType: 'MANUAL', defaultMonthsToNextStep: null,
        steps: [
          { stepCode: 'Aanloop', stepName: 'Aanloop', sequenceNumber: 0, fulltimeAmount: '3000.00', progressionType: 'MANUAL', monthsToNextStep: null, stepKind: 'START' },
          { stepCode: 'Eind', stepName: 'Eind', sequenceNumber: 1, fulltimeAmount: '4000.00', progressionType: 'MANUAL', monthsToNextStep: null, stepKind: 'MAXIMUM' },
        ],
      }],
    })
    if (draft.structureType !== 'SCALE_WITH_STEPS') throw new Error('Expected scale draft')
    expect(draft.scales[0].steps).toHaveLength(2)
  })

  it('rejects duplicate scale, step and ordering identities', () => {
    const scale = {
      code: '8', name: 'Schaal 8', sortOrder: 0, progressionType: 'MANUAL' as const, defaultMonthsToNextStep: null,
      steps: [
        { stepCode: 'A1', stepName: 'A1', sequenceNumber: 0, fulltimeAmount: '3000.00', progressionType: 'MANUAL' as const, monthsToNextStep: null, stepKind: 'START' as const },
        { stepCode: 'a1', stepName: 'A1 dubbel', sequenceNumber: 0, fulltimeAmount: '3100.00', progressionType: 'MANUAL' as const, monthsToNextStep: null, stepKind: 'MAXIMUM' as const },
      ],
    }
    expect(() => salaryStructureDraftSchema.parse({
      structureType: 'SCALE_WITH_STEPS', effectiveFrom: '2026-07-01', salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR', scales: [scale],
    })).toThrow()
  })

  it('accepts an open maximum only on the highest band', () => {
    const base = {
      structureType: 'SALARY_BAND' as const, effectiveFrom: '2026-07-01', salaryBasis: 'MONTHLY_BASE' as const, currencyCode: 'EUR',
      bands: [
        { identityKey: 'B1', code: 'B1', name: 'Band 1', sortOrder: 0, inputMethod: 'MANUAL_ANCHORS' as const, minimum: '2500.00', midpoint: '3000.00', maximum: '3500.00', inputSpreadPercentage: null },
        { identityKey: 'B2', code: 'B2', name: 'Band 2', sortOrder: 1, inputMethod: 'MANUAL_ANCHORS' as const, minimum: '3400.00', midpoint: '4000.00', maximum: null, inputSpreadPercentage: null },
      ],
    }
    const parsed = salaryStructureDraftSchema.parse(base)
    if (parsed.structureType !== 'SALARY_BAND') throw new Error('Expected band draft')
    expect(parsed.bands[1].maximum).toBeNull()
    expect(() => salaryStructureDraftSchema.parse({
      ...base,
      bands: [{ ...base.bands[1], sortOrder: 0 }, { ...base.bands[0], sortOrder: 1 }],
    })).toThrow()
  })

  it('requires the midpoint to be strictly between minimum and maximum', () => {
    expect(() => salaryStructureDraftSchema.parse({
      structureType: 'SALARY_BAND', effectiveFrom: '2026-07-01', salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR',
      bands: [{ identityKey: 'B1', code: 'B1', name: 'Band 1', sortOrder: 0, inputMethod: 'MANUAL_ANCHORS', minimum: '3000.00', midpoint: '3000.00', maximum: '3600.00', inputSpreadPercentage: null }],
    })).toThrow()
    expect(() => salaryStructureDraftSchema.parse({
      structureType: 'SALARY_BAND', effectiveFrom: '2026-07-01', salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR',
      bands: [{ identityKey: 'B1', code: 'B1', name: 'Band 1', sortOrder: 0, inputMethod: 'MANUAL_ANCHORS', minimum: '3000.00', midpoint: '3400.00', maximum: '3400.00', inputSpreadPercentage: null }],
    })).toThrow()
  })

  it('requires money to be transported without floating-point ambiguity', () => {
    const invalid = {
      structureType: 'SALARY_BAND', effectiveFrom: '2026-07-01', salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR',
      bands: [{ identityKey: 'B1', code: 'B1', name: 'Band 1', sortOrder: 0, inputMethod: 'MIN_MAX', minimum: 2600, midpoint: '3000.00', maximum: '3400.00', inputSpreadPercentage: null }],
    }
    expect(() => salaryStructureDraftSchema.parse(invalid)).toThrow()
  })

  it('requires a draft id and lock version together for an existing draft', () => {
    const draft = {
      structureType: 'SCALE_WITH_STEPS' as const,
      effectiveFrom: '2026-07-01',
      salaryBasis: 'MONTHLY_BASE' as const,
      currencyCode: 'EUR',
      scales: [{
        code: 'A', name: 'Schaal A', sortOrder: 0, progressionType: 'MANUAL' as const, defaultMonthsToNextStep: null,
        steps: [{ stepCode: '1', stepName: 'Stap 1', sequenceNumber: 0, fulltimeAmount: '3000.00', progressionType: 'MANUAL' as const, monthsToNextStep: null, stepKind: 'MAXIMUM' as const }],
      }],
    }

    expect(() => salaryStructureDraftSaveSchema.parse({ draftId: crypto.randomUUID(), expectedLockVersion: null, draft })).toThrow()
    expect(salaryStructureDraftSaveSchema.parse({ draftId: null, expectedLockVersion: null, draft })).toMatchObject({ draftId: null })
  })
})
