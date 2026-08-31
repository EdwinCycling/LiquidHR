import { describe, expect, it } from 'vitest'
import { AnalysisEngineError } from './analysis-errors'
import {
  parseSavedAnalysisId,
  parseSavedAnalysisListRow,
  parseSavedAnalysisRow,
  validateSavedAnalysisCreateInput,
  validateSavedAnalysisUpdateInput,
} from './saved-analysis-definition'

const validSpec = {
  version: 1,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: ['department'],
  filters: [],
  sort: { by: 'label', direction: 'asc' },
  limit: 25,
  presentation: 'table',
} as const

const validRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Actieve medewerkers per afdeling',
  analysis_spec: validSpec,
  definition_version: 1,
  created_at: '2026-08-30T12:00:00.000Z',
  updated_at: '2026-08-30T12:00:00.000Z',
}

describe('saved analysis definition contract', () => {
  it('normalizes a name and validates the same versioned AnalysisSpec as execution', () => {
    const result = validateSavedAnalysisCreateInput({ name: '  Mijn analyse  ', analysisSpec: validSpec })

    expect(result.name).toBe('Mijn analyse')
    expect(result.analysisSpec).toMatchObject({ version: 1, dimensions: ['department'] })
  })

  it('rejects an unknown persistence input field and an empty name', () => {
    expect(() => validateSavedAnalysisCreateInput({ name: ' ', analysisSpec: validSpec })).toThrow('SAVED_ANALYSIS_INPUT_INVALID')
    expect(() => validateSavedAnalysisCreateInput({ name: 'Analyse', analysisSpec: validSpec, ownerUserId: 'attacker' })).toThrow('SAVED_ANALYSIS_INPUT_INVALID')
  })

  it('rejects employee/result-shaped and arbitrary nested content at the API boundary', () => {
    const malformedSpecs = [
      { ...validSpec, employeeId: 'emp-1' },
      { ...validSpec, employeeName: 'Ada Lovelace' },
      { ...validSpec, employees: [{ id: 'emp-1' }] },
      { ...validSpec, result: { headcount: 3 } },
      { ...validSpec, resultRows: [{ headcount: 3 }] },
      {
        ...validSpec,
        filters: [{ dimension: 'department', operator: 'eq', value: { employeeId: 'emp-1' } }],
      },
    ]

    for (const analysisSpec of malformedSpecs) {
      expect(() => validateSavedAnalysisCreateInput({ name: 'Analyse', analysisSpec })).toThrow(AnalysisEngineError)
    }
  })

  it('rejects unsupported or tampered definitions before a saved analysis can be opened', () => {
    expect(() => parseSavedAnalysisRow({ ...validRow, analysis_spec: { ...validSpec, version: 2 } })).toThrow('SAVED_ANALYSIS_DEFINITION_INVALID')
    expect(() => parseSavedAnalysisRow({ ...validRow, definition_version: 2 })).toThrow('SAVED_ANALYSIS_DEFINITION_INVALID')
    expect(() => parseSavedAnalysisRow({ ...validRow, analysis_spec: { ...validSpec, tenant_id: 'tenant-leak' } })).toThrow('SAVED_ANALYSIS_DEFINITION_INVALID')
  })

  it('keeps list rows free of definitions and employee/result fields', () => {
    const result = parseSavedAnalysisListRow({
      id: validRow.id,
      name: validRow.name,
      created_at: validRow.created_at,
      updated_at: validRow.updated_at,
    })

    expect(result).toEqual({ id: validRow.id, name: validRow.name, createdAt: validRow.created_at, updatedAt: validRow.updated_at })
    expect(JSON.stringify(result)).not.toContain('analysis_spec')
    expect(JSON.stringify(result)).not.toContain('employee')
  })

  it('supports rename-only and definition updates through one strict input seam', () => {
    expect(validateSavedAnalysisUpdateInput({ name: '  Nieuwe naam ' })).toEqual({ name: 'Nieuwe naam' })
    expect(validateSavedAnalysisUpdateInput({ analysisSpec: validSpec })).toMatchObject({ analysisSpec: expect.objectContaining({ version: 1 }) })
    expect(() => validateSavedAnalysisUpdateInput({})).toThrow('SAVED_ANALYSIS_INPUT_INVALID')
  })

  it('returns a typed invalid-id error instead of passing an identifier to persistence', () => {
    expect(() => parseSavedAnalysisId('not-an-id')).toThrow('SAVED_ANALYSIS_INVALID_ID')
    expect(parseSavedAnalysisId(validRow.id)).toBe(validRow.id)
  })

  it('preserves the existing engine error for malformed client specs', () => {
    expect(() => validateSavedAnalysisCreateInput({ name: 'Analyse', analysisSpec: { ...validSpec, entity: 'employees;drop' } })).toThrow(AnalysisEngineError)
  })
})
