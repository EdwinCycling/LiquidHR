import { describe, expect, it } from 'vitest'
import { AnalysisEngineError, type AnalysisErrorCode } from './analysis-errors'
import { validateAnalysisSpec } from './analysis-spec'

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    source: 'workforce',
    entity: 'employees',
    measures: ['headcount'],
    dimensions: [],
    filters: [],
    sort: null,
    limit: 25,
    presentation: 'auto',
    ...overrides,
  }
}

function errorCode(input: unknown): AnalysisErrorCode {
  try {
    validateAnalysisSpec(input)
  } catch (error) {
    if (error instanceof AnalysisEngineError) return error.code
    throw error
  }
  throw new Error('Expected AnalysisSpec validation to fail')
}

describe('AnalysisSpec V1', () => {
  it('accepts every canonical V1 shape needed by persistence', () => {
    const validCases: readonly [string, Record<string, unknown>][] = [
      ['canonical minimum', validInput()],
      ['KPI presentation', validInput({ presentation: 'kpi', limit: 100 })],
      ['table presentation', validInput({ dimensions: ['department'], presentation: 'table' })],
      ['single dimension', validInput({ dimensions: ['job'] })],
      ['eq filter', validInput({ filters: [{ dimension: 'department', operator: 'eq', value: 'Finance' }] })],
      ['in filter', validInput({ filters: [{ dimension: 'employment_status', operator: 'in', value: ['ACTIVE_EMPLOYEE', 'FORMER_EMPLOYEE'] }] })],
      ['allowed sort', validInput({ sort: { by: 'label', direction: 'asc' } })],
      ['boundary-valid limit', validInput({ limit: 100 })],
    ]

    for (const [label, input] of validCases) {
      expect(() => validateAnalysisSpec(input), label).not.toThrow()
    }
  })

  it('rejects every non-canonical or unsafe persisted shape', () => {
    const excessiveFilters = Array.from({ length: 21 }, () => ({ dimension: 'department', operator: 'eq', value: 'Finance' }))
    const invalidCases: readonly [string, Record<string, unknown>, string][] = [
      ['unknown top-level key', validInput({ unknown: true }), 'ANALYSIS_SPEC_INVALID'],
      ['employeeId', validInput({ employeeId: 'employee-1' }), 'ANALYSIS_SPEC_INVALID'],
      ['employeeName', validInput({ employeeName: 'Ada Lovelace' }), 'ANALYSIS_SPEC_INVALID'],
      ['employees', validInput({ employees: [{ id: 'employee-1' }] }), 'ANALYSIS_SPEC_INVALID'],
      ['result', validInput({ result: { headcount: 3 } }), 'ANALYSIS_SPEC_INVALID'],
      ['resultRows', validInput({ resultRows: [{ headcount: 3 }] }), 'ANALYSIS_SPEC_INVALID'],
      ['AnalysisResult-like payload', validInput({ metadata: { matchedRecordCount: 3 }, columns: ['headcount'], summary: { headcount: 3 } }), 'ANALYSIS_SPEC_INVALID'],
      ['arbitrary metadata', validInput({ metadata: { arbitrary: { nested: true } } }), 'ANALYSIS_SPEC_INVALID'],
      ['arbitrary nested object', validInput({ filters: [{ dimension: 'department', operator: 'eq', value: { employeeId: 'employee-1' } }] }), 'ANALYSIS_INVALID_FILTER_VALUE'],
      ['unsupported source', validInput({ source: 'payroll' }), 'ANALYSIS_UNSUPPORTED_SOURCE'],
      ['unsupported entity', validInput({ entity: 'projects' }), 'ANALYSIS_UNSUPPORTED_ENTITY'],
      ['unsupported measure', validInput({ measures: ['salary'] }), 'ANALYSIS_UNSUPPORTED_MEASURE'],
      ['unsupported dimension', validInput({ dimensions: ['salary_band'] }), 'ANALYSIS_UNSUPPORTED_DIMENSION'],
      ['malformed filter', validInput({ filters: [{ dimension: 'department', operator: 'eq' }] }), 'ANALYSIS_SPEC_INVALID'],
      ['unsupported filter operator', validInput({ filters: [{ dimension: 'department', operator: 'contains', value: 'Finance' }] }), 'ANALYSIS_INVALID_OPERATOR'],
      ['excessive filter count', validInput({ filters: excessiveFilters }), 'ANALYSIS_SPEC_INVALID'],
      ['invalid sort', validInput({ sort: { by: 'updated_at', direction: 'desc' } }), 'ANALYSIS_SPEC_INVALID'],
      ['invalid limit', validInput({ limit: 101 }), 'ANALYSIS_SPEC_INVALID'],
      ['unsupported version', validInput({ version: 2 }), 'ANALYSIS_UNSUPPORTED_SPEC_VERSION'],
    ]

    for (const [label, input, expectedCode] of invalidCases) {
      expect(errorCode(input), label).toBe(expectedCode)
    }
  })

  it('normalizes and accepts a supported dimension and typed filter', () => {
    const spec = validateAnalysisSpec(validInput({
      dimensions: ['department'],
      filters: [{ dimension: 'employment_status', operator: 'in', value: ['ACTIVE_EMPLOYEE', 'FUTURE_EMPLOYEE'] }],
      sort: { by: 'value', direction: 'desc' },
      presentation: 'table',
    }))

    expect(spec.version).toBe(1)
    expect(spec.entity).toBe('employees')
    expect(spec.measures).toEqual(['headcount'])
    expect(spec.dimensions).toEqual(['department'])
    expect(spec.filters).toEqual([{
      dimension: 'employment_status',
      operator: 'in',
      value: ['ACTIVE_EMPLOYEE', 'FUTURE_EMPLOYEE'],
    }])
    expect(Object.isFrozen(spec)).toBe(true)
  })

  it('rejects an unsupported semantic source or entity', () => {
    expect(errorCode(validInput({ source: 'payroll' }))).toBe('ANALYSIS_UNSUPPORTED_SOURCE')
    expect(errorCode(validInput({ entity: 'projects' }))).toBe('ANALYSIS_UNSUPPORTED_ENTITY')
  })

  it('rejects an unsupported measure, dimension and filter', () => {
    expect(errorCode(validInput({ measures: ['salary'] }))).toBe('ANALYSIS_UNSUPPORTED_MEASURE')
    expect(errorCode(validInput({ dimensions: ['salary_band'] }))).toBe('ANALYSIS_UNSUPPORTED_DIMENSION')
    expect(errorCode(validInput({ filters: [{ dimension: 'salary_band', operator: 'eq', value: 'A' }] }))).toBe('ANALYSIS_UNSUPPORTED_FILTER')
  })

  it('rejects incompatible multi-dimension output and KPI presentation', () => {
    expect(errorCode(validInput({ dimensions: ['department', 'job'] }))).toBe('ANALYSIS_INCOMPATIBLE_MEASURE_DIMENSION')
    expect(errorCode(validInput({ dimensions: ['department'], presentation: 'kpi' }))).toBe('ANALYSIS_INCOMPATIBLE_PRESENTATION')
  })

  it('rejects unsupported versions, operators and values', () => {
    expect(errorCode(validInput({ version: 2 }))).toBe('ANALYSIS_UNSUPPORTED_SPEC_VERSION')
    expect(errorCode(validInput({ filters: [{ dimension: 'department', operator: 'contains', value: 'Engineering' }] }))).toBe('ANALYSIS_INVALID_OPERATOR')
    expect(errorCode(validInput({ filters: [{ dimension: 'employment_status', operator: 'eq', value: 'UNKNOWN' }] }))).toBe('ANALYSIS_INVALID_FILTER_VALUE')
    expect(errorCode(validInput({ filters: [{ dimension: 'department', operator: 'eq', value: ['Engineering'] }] }))).toBe('ANALYSIS_INVALID_FILTER_VALUE')
  })

  it('does not accept SQL-like identifiers as executable metadata', () => {
    expect(errorCode(validInput({ entity: 'employees;drop' }))).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode(validInput({ filters: [{ dimension: 'department;drop', operator: 'eq', value: 'Engineering' }] }))).toBe('ANALYSIS_SPEC_INVALID')
  })

  it('rejects unknown top-level fields and malformed values', () => {
    expect(errorCode(validInput({ debugSql: 'select * from employees' }))).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode(validInput({ limit: 0 }))).toBe('ANALYSIS_SPEC_INVALID')
    expect(errorCode(validInput({ filters: [{ dimension: 'department', operator: 'eq', value: 10 }] }))).toBe('ANALYSIS_INVALID_FILTER_VALUE')
  })
})
