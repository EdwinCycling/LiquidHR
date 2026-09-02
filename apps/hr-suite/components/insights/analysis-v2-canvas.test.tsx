import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DateOnly } from '../../lib/insights/analysis-spec-v2'
import { AnalysisV2Canvas, type AnalysisV2CanvasLabels } from './analysis-v2-canvas'

const asOf = (value: string): DateOnly => value as DateOnly

const labels: AnalysisV2CanvasLabels = {
  comparisonHeadcount: 'Comparison count',
  department: 'Department',
  delta: 'Difference',
  deltaPct: 'Difference percent',
  employmentType: 'Employment type',
  employmentTypeLabels: {
    APPRENTICE: 'Apprentice', CONTRACTOR: 'Contractor', EMPLOYEE: 'Employee', FREELANCER: 'Freelancer',
    INTERN: 'Intern', NO_PAYROLL: 'No payroll', TEMPORARY_AGENCY: 'Temporary agency', VOLUNTEER: 'Volunteer',
  },
  headcount: 'Employee count',
  job: 'Job',
  noResults: 'No results',
  summary: 'Historical aggregate',
  table: 'Snapshot table',
  title: 'Snapshot analysis',
  unavailable: 'Unavailable',
  unknown: 'Unknown',
}

describe('V2 Canvas renderer', () => {
  it('renders two dimensions, comparison columns, signed delta, null percentage and Unknown without source identifiers', () => {
    const markup = renderToStaticMarkup(<AnalysisV2Canvas labels={labels} result={{
      version: 2,
      source: 'workforce',
      entity: 'employees',
      measures: ['headcount'],
      dimensions: ['department', 'employment_type'],
      period: { kind: 'snapshot', asOf: asOf('2026-01-01') },
      comparison: { kind: 'explicit_period', period: { kind: 'snapshot', asOf: asOf('2025-01-01') } },
      metadata: { complete: true, matchedEmployeeCount: 2, comparisonMatchedEmployeeCount: 0, groupCount: 1 },
      columns: [
        { key: 'department', dataType: 'string' }, { key: 'employment_type', dataType: 'string' },
        { key: 'headcount', dataType: 'integer' }, { key: 'comparisonHeadcount', dataType: 'integer' },
        { key: 'delta', dataType: 'integer' }, { key: 'deltaPct', dataType: 'number' },
      ],
      rows: [{ values: { dimensions: { department: null, employment_type: 'EMPLOYEE' }, headcount: 2, comparisonHeadcount: 0, delta: 2, deltaPct: null } }],
      summary: { headcount: 2, comparisonHeadcount: 0, delta: 2, deltaPct: null },
      presentationHints: { preferred: 'comparison', fallback: 'table' },
    }} />)

    expect(markup).toContain('data-liquid-canvas="v2"')
    expect(markup).toContain('Unknown')
    expect(markup).toContain('Employee')
    expect(markup).toContain('>+2</td>')
    expect(markup).not.toContain('employee-')
    expect(markup).not.toContain('tenant-')
  })
})
