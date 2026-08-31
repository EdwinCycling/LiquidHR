import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnalysisExplore, type AnalysisExploreLabels } from './analysis-explore'

const labels: AnalysisExploreLabels = {
  ascending: 'Ascending',
  auto: 'Automatic',
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
  department: 'Department',
  descending: 'Descending',
  dimension: 'Group by',
  direction: 'Direction',
  exploration: {
    back: 'Back',
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
    difference: 'Difference',
    drill: 'Continue',
    drillDescription: 'Selected context:',
    drillInto: 'Explore by',
    drillTitle: 'Continue exploring',
    drilling: 'Running',
    noComparisonOptions: 'No rows.',
    reset: 'Reset',
  },
  execute: 'Run analysis',
  executing: 'Running analysis',
  executionFailed: 'The analysis could not be run.',
  eyebrow: 'Liquid Analysis',
  filterDescription: 'Choose a dimension.',
  filterEquals: 'Equals, server-side.',
  filterRequired: 'Enter a value.',
  filterStatusActive: 'Active employees',
  filterStatusFuture: 'Future employees',
  filterStatusFormer: 'Former employees',
  filterStatusNever: 'Never employed',
  filterValue: 'Value',
  filterValuePlaceholder: 'Type a value',
  filters: 'Optional filter',
  headcount: 'Employee count',
  intro: 'Explore current workforce data.',
  job: 'Job',
  kpi: 'Key figure',
  limit: 'Maximum rows',
  measure: 'Measure',
  name: 'Name',
  namePlaceholder: 'Analysis name',
  nameRequired: 'Name required.',
  noDimension: 'No grouping',
  noFilter: 'No filter',
  noSort: 'Default',
  openSaved: 'Open saved analysis',
  presentation: 'Display',
  presentationDescription: 'A fixed display capability.',
  resultTitle: 'Your result appears here',
  save: 'Save analysis',
  saveDescription: 'Only the definition is saved.',
  saveFailed: 'Save failed.',
  saved: 'Saved.',
  saveTitle: 'Save this analysis',
  saving: 'Saving…',
  searchPlaceholder: 'Search options',
  setupDescription: 'Fixed semantic capabilities.',
  setupTitle: 'Starting point',
  sort: 'Sorting',
  sortLabel: 'Label',
  sortValue: 'Count',
  startingPoint: 'Source',
  table: 'Table',
  employmentStatus: 'Employee status',
  title: 'Explore',
  workforce: 'Workforce',
}

describe('Analysis Explore V1', () => {
  it('renders only the guided semantic controls and no client-side employee data', () => {
    const markup = renderToStaticMarkup(<AnalysisExplore labels={labels} />)

    expect(markup).toContain('data-analysis-explore="v1"')
    expect(markup).toContain('Workforce')
    expect(markup).toContain('Employee count')
    expect(markup).toContain('Department')
    expect(markup).toContain('Your result appears here')
    expect(markup).not.toContain('employee-1')
    expect(markup).not.toContain('tenant-')
    expect(markup).not.toContain('<table')
  })
})
