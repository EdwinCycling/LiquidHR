import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BradfordReportView } from './bradford-report'
import type { BradfordInsightQuery } from '@/lib/insights/bradford-query'
import type { BradfordInsightReport } from '@/lib/insights/bradford-report'

type BradfordReportLabels = Parameters<typeof BradfordReportView>[0]['labels']

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('report=absence-bradford&period=52-weeks'),
}))

const query: BradfordInsightQuery = {
  report: 'absence-bradford',
  period: '52-weeks',
  year: 2026,
  month: 9,
  startDate: '2025-09-30',
  endDate: '2026-09-29',
  departmentId: null,
  risk: 'ALL',
  search: '',
}

const report: BradfordInsightReport = {
  report: 'absence-bradford',
  period: query,
  rows: [],
  departments: [],
  totalOccurrences: 0,
  totalSickDays: 0,
}

const labels: BradfordReportLabels = {
  title: 'Bradford factor',
  backToAbsence: 'Back to absence',
  exportExcel: 'Export to Excel',
  exportPreparing: 'Preparing export',
  exportSuccess: 'Export ready',
  exportFailed: 'Export failed',
  period: 'Period',
  last52Weeks: 'Last 52 weeks',
  thisYear: 'This year',
  previousYear: 'Previous year',
  team: 'Team',
  allDepartments: 'All departments',
  applyFilters: 'Apply filters',
  resetFilters: 'Reset filters',
  clearFilters: 'Clear filters',
  removeFilter: 'Remove filter',
  filterStatus: '{count} selected',
  groupBy: 'Group by',
  person: 'Person',
  search: 'Search',
  searchPlaceholder: 'Search people',
  risk: 'Risk level',
  allRisks: 'All levels',
  lowRisk: 'Low',
  mediumRisk: 'Medium',
  highRisk: 'High',
  employee: 'Employee',
  distribution: 'Distribution',
  score: 'Bradford score',
  occurrences: 'Occurrences',
  days: 'Sick days',
  since: 'First day',
  dossier: 'Open absence record',
  info: 'About Bradford',
  infoTitle: 'Bradford factor',
  infoFormula: 'Formula',
  infoInterpretation: 'Interpretation',
  infoLow: 'Low',
  infoMedium: 'Medium',
  infoHigh: 'High',
  infoCaveat: 'Caveat',
  infoSource: 'Source',
  close: 'Close',
  noResults: 'No results',
  activeFilters: 'Active filters',
}

const labelsWithCardDescription = {
  ...labels,
  description: 'This summary is already shown in the report card header.',
}

describe('Bradford report view', () => {
  it('does not repeat the description that belongs to the report-card header', () => {
    const markup = renderToStaticMarkup(
      <BradfordReportView labels={labelsWithCardDescription} query={query} report={report} returnTo="/insights?report=absence-bradford" />,
    )

    expect(markup).not.toContain(labelsWithCardDescription.description)
    expect(markup).toContain('Back to absence')
    expect(markup).toContain('Apply filters')
  })
})
