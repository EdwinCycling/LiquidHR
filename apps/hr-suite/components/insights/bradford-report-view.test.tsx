// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { BradfordReportView } from './bradford-report'
import type { BradfordInsightQuery } from '@/lib/insights/bradford-query'
import type { BradfordInsightReport } from '@/lib/insights/bradford-report'

type BradfordReportLabels = Parameters<typeof BradfordReportView>[0]['labels']

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('report=absence-bradford&period=52-weeks'),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
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

  it('keeps the table and active filter chips on applied filters while a draft is being edited', () => {
    const rows: BradfordInsightReport['rows'] = [
      { employeeId: 'employee-low', employeeName: 'Aline Low', departmentName: 'Finance', firstAbsenceOn: '2026-01-01', absenceOccurrences: 1, sickDays: 2, score: 2, band: 'LOW' },
      { employeeId: 'employee-high', employeeName: 'Bert High', departmentName: 'Sales', firstAbsenceOn: '2026-01-02', absenceOccurrences: 3, sickDays: 20, score: 180, band: 'MEDIUM' },
    ]
    const mounted = mount(createElement(BradfordReportView, {
      labels,
      query,
      report: { ...report, rows, totalOccurrences: 4, totalSickDays: 22 },
      returnTo: '/insights?report=absence-bradford',
    }))

    expect(mounted.host.textContent).toContain('Aline Low')
    expect(mounted.host.textContent).toContain('Bert High')
    act(() => (mounted.host.querySelector('button[aria-label="Risk level"]') as HTMLButtonElement).click())
    act(() => (document.body.querySelector('[role="option"][aria-selected="false"]') as HTMLButtonElement).click())

    expect(mounted.host.textContent).toContain('Aline Low')
    expect(mounted.host.textContent).toContain('Bert High')
    expect(mounted.host.textContent).not.toContain('Risk level: Medium')
    expect(mounted.host.textContent).toContain('4')
    mounted.unmount()
  })
})
