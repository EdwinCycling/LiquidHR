import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { validateAnalysisSpec } from '@/lib/insights/analysis-spec'
import type { AnalysisResult } from '@/lib/insights/analysis-result'
import { AnalysisExploration, type AnalysisExplorationLabels } from './analysis-exploration'

const labels: AnalysisExplorationLabels = {
  back: 'Back',
  canvas: {
    dimension: 'Grouping',
    fallback: 'Table fallback',
    headcount: 'Employee count',
    noResults: 'No results',
    selectRow: 'Select row',
    summary: 'Authorised result',
    table: 'Analysis table',
    title: 'Liquid Canvas',
    unknown: 'Unknown',
  },
  compare: 'Compare',
  compareBreakdown: 'Break down by',
  compareDescription: 'Compare two values.',
  compareFailed: 'Comparison failed.',
  compareLeft: 'First value',
  compareNoBreakdown: 'No breakdown',
  compareNotPersisted: 'Not saved.',
  compareRight: 'Second value',
  compareTitle: 'Compare',
  comparing: 'Comparing',
  contextDescription: 'Choose a result row.',
  contextTitle: 'Exploration context',
  department: 'Department',
  difference: 'Difference',
  drill: 'Continue',
  drillDescription: 'Selected context:',
  drillInto: 'Explore by',
  drillTitle: 'Continue exploring',
  drilling: 'Running',
  employmentStatus: 'Employee status',
  job: 'Job',
  noComparisonOptions: 'No rows.',
  reset: 'Reset',
  workforce: 'Workforce',
}

const spec = validateAnalysisSpec({
  version: 1,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: ['department'],
  filters: [],
  sort: null,
  limit: 25,
  presentation: 'auto',
})

const result: AnalysisResult = {
  version: 1,
  source: 'workforce',
  entity: 'employees',
  measures: ['headcount'],
  dimensions: ['department'],
  metadata: { matchedRecordCount: 4, groupCount: 2 },
  columns: [{ key: 'dimension', dataType: 'string' }, { key: 'headcount', dataType: 'integer' }],
  rows: [
    { values: { dimension: 'Sales', headcount: 3 } },
    { values: { dimension: 'Engineering', headcount: 1 } },
  ],
  summary: { headcount: 4 },
  presentationHints: { preferred: 'table', fallback: 'table' },
}

describe('AN-6 exploration UI', () => {
  it('renders selectable aggregate rows, context navigation and compare controls without raw data', () => {
    const markup = renderToStaticMarkup(<AnalysisExploration labels={labels} rootResult={result} rootSpec={spec} />)

    expect(markup).toContain('data-analysis-exploration="v1"')
    expect(markup).toContain('data-analysis-context="true"')
    expect(markup).toContain('Select row: Sales')
    expect(markup).toContain('Compare')
    expect(markup).not.toContain('employee-1')
    expect(markup).not.toContain('tenant-a')
  })
})
