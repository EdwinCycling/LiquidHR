import { describe, expect, it } from 'vitest'
import { AnalysisEngineError } from './analysis-errors'
import { validateAnalysisRequest } from './analysis-spec-dispatch'
import { validateAnalysisSpecV2 } from './analysis-spec-v2'

const base = {
  version: 2,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: [],
  filters: [],
  period: { kind: 'snapshot', asOf: '2026-01-01' },
  comparison: null,
  sort: null,
  limit: 25,
  presentation: { intent: 'auto' },
} as const

function errorCode(input: unknown): string {
  try {
    validateAnalysisSpecV2(input)
  } catch (error) {
    if (error instanceof AnalysisEngineError) return error.code
  }
  return 'NO_ERROR'
}

describe('AnalysisSpec V2', () => {
  it('accepts the frozen KPI, one-dimension, two-dimension and comparison contracts', () => {
    expect(validateAnalysisSpecV2(base)).toMatchObject({ version: 2, dimensions: [], period: base.period })
    expect(validateAnalysisSpecV2({ ...base, dimensions: ['department'] })).toMatchObject({ dimensions: ['department'] })
    expect(validateAnalysisSpecV2({ ...base, dimensions: ['department', 'employment_type'] })).toMatchObject({ dimensions: ['department', 'employment_type'] })
    expect(validateAnalysisSpecV2({ ...base, comparison: { kind: 'explicit_period', period: { kind: 'snapshot', asOf: '2025-01-01' } }, presentation: { intent: 'comparison' } })).toMatchObject({ comparison: { period: { asOf: '2025-01-01' } }, presentation: { intent: 'comparison' } })
  })

  it('rejects invalid dates, equal comparison dates and unknown nested fields', () => {
    expect(errorCode({ ...base, period: { kind: 'snapshot', asOf: '2026-02-30' } })).toBe('ANALYSIS_INVALID_DATE')
    expect(errorCode({ ...base, comparison: { kind: 'explicit_period', period: { kind: 'snapshot', asOf: '2026-01-01' } } })).toBe('ANALYSIS_COMPARISON_SAME_DATE')
    expect(errorCode({ ...base, period: { kind: 'snapshot', asOf: '2026-01-01', debug: true } })).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode({ ...base, comparison: { kind: 'previous_equal_period', period: { kind: 'snapshot', asOf: '2025-01-01' } } })).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode({ ...base, presentation: { intent: 'auto', debug: true } })).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode({ ...base, presentation: 'auto' })).toBe('ANALYSIS_SPEC_INVALID')
  })

  it('enforces dimensions, filters and the exact employment type/status allowlists', () => {
    expect(errorCode({ ...base, dimensions: ['department', 'job', 'employment_type'] })).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode({ ...base, filters: Array.from({ length: 9 }, (_, index) => ({ dimension: `department-${index}`, operator: 'eq', value: 'x' })) })).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode({ ...base, filters: [{ dimension: 'employment_status', operator: 'eq', value: 'FORMER_EMPLOYEE' }] })).toBe('ANALYSIS_UNSUPPORTED_FILTER_VALUE')
    expect(errorCode({ ...base, filters: [{ dimension: 'employment_type', operator: 'eq', value: 'contract_type' }] })).toBe('ANALYSIS_INVALID_FILTER_VALUE')
    expect(validateAnalysisSpecV2({ ...base, filters: [{ dimension: 'employment_type', operator: 'in', value: ['EMPLOYEE', 'NO_PAYROLL'] }] })).toMatchObject({ filters: [{ dimension: 'employment_type', value: ['EMPLOYEE', 'NO_PAYROLL'] }] })
    for (const dimension of ['department', 'job', 'employment_type', 'employment_status'] as const) {
      const firstValue = dimension === 'employment_status' ? 'ACTIVE_EMPLOYEE' : dimension === 'employment_type' ? 'EMPLOYEE' : 'value-a'
      const secondValue = dimension === 'employment_status' ? 'ACTIVE_EMPLOYEE' : dimension === 'employment_type' ? 'INTERN' : 'value-b'
      expect(errorCode({ ...base, filters: [
        { dimension, operator: 'eq', value: firstValue },
        { dimension, operator: 'eq', value: secondValue },
      ] })).toBe('ANALYSIS_SPEC_INVALID')
    }
    expect(validateAnalysisSpecV2({ ...base, filters: [
      { dimension: 'department', operator: 'eq', value: 'department-a' },
      { dimension: 'job', operator: 'eq', value: 'job-a' },
    ] })).toMatchObject({ filters: [{ dimension: 'department' }, { dimension: 'job' }] })
  })

  it('dispatches V1 and V2 without mixing their fields', () => {
    const v1 = validateAnalysisRequest({ version: 1, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: [], filters: [], sort: null, limit: 25, presentation: 'auto' })
    expect(v1.version).toBe(1)
    expect(() => validateAnalysisRequest({ ...base, asOf: '2026-01-01' })).toThrow('ANALYSIS_SPEC_INVALID')
    expect(() => validateAnalysisRequest({ ...base, presentation: { intent: 'kpi' }, dimensions: ['department'] })).toThrow('ANALYSIS_INCOMPATIBLE_PRESENTATION')
  })
})
