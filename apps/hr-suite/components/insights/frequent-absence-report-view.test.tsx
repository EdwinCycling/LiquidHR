// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { FrequentAbsenceReportView } from './frequent-absence-report'
import type { FrequentAbsenceQuery } from '@/lib/insights/frequent-absence-query'
import type { FrequentAbsenceReport } from '@/lib/insights/frequent-absence-report'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('report=absence-frequent&period=12-months'),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const query: FrequentAbsenceQuery = {
  report: 'absence-frequent',
  period: '12-months',
  year: 2026,
  startDate: '2025-10-01',
  endDate: '2026-09-30',
  departmentId: null,
  search: '',
  frequentOnly: false,
}

const report: FrequentAbsenceReport = {
  report: 'absence-frequent',
  period: query,
  threshold: 3,
  rows: [
    { employeeId: 'employee-frequent', employeeName: 'Aline Frequent', departmentName: 'Finance', reportCount: 4, totalSickDays: 8, isFrequent: true },
    { employeeId: 'employee-other', employeeName: 'Bert Other', departmentName: 'Sales', reportCount: 1, totalSickDays: 2, isFrequent: false },
  ],
  departments: [],
  totalEmployees: 2,
  frequentCount: 1,
  totalReports: 5,
}

const labels = {
  title: 'Frequent absence',
  description: 'Employees with repeated absence',
  exportExcel: 'Export to Excel',
  exportPreparing: 'Preparing export',
  exportSuccess: 'Export ready',
  exportFailed: 'Export failed',
  period: 'Period',
  last12Months: 'Last 12 months',
  thisYear: 'This year',
  previousYear: 'Previous year',
  team: 'Team',
  allDepartments: 'All departments',
  applyFilters: 'Apply filters',
  resetFilters: 'Reset filters',
  clearFilters: 'Clear filters',
  removeFilter: 'Remove filter',
  filterStatus: '{count} selected',
  search: 'Search',
  searchPlaceholder: 'Search people',
  employee: 'Employee',
  reportCount: 'Reports',
  sickDays: 'Sick days',
  frequent: 'Frequent',
  threshold: 'Threshold',
  thresholdDescription: 'Threshold {threshold}',
  totalEmployees: 'Total employees',
  frequentCount: 'Frequent employees',
  totalReports: 'Total reports',
  noResults: 'No results',
  yearLabel: 'Year',
}

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

describe('Frequent absence report view', () => {
  it('keeps table rows and active filter chips on applied query while filter drafts change', () => {
    const mounted = mount(createElement(FrequentAbsenceReportView, {
      labels,
      query,
      report,
      returnTo: '/insights?report=absence-frequent',
    }))

    expect(mounted.host.textContent).toContain('Aline Frequent')
    expect(mounted.host.textContent).toContain('Bert Other')
    act(() => (mounted.host.querySelector('input[type="checkbox"]') as HTMLInputElement).click())

    expect(mounted.host.textContent).toContain('Aline Frequent')
    expect(mounted.host.textContent).toContain('Bert Other')
    expect(mounted.host.textContent).not.toContain('Frequent:')
    expect(mounted.host.textContent).toContain('2 / 2')
    mounted.unmount()
  })
})
