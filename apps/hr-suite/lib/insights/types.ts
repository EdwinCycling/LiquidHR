export type EmployeeInsightReportId = 'employee-department' | 'employee-gender' | 'employee-age' | 'terminations'

export type EmployeeInsightGroupBy = 'team' | 'gender' | 'age' | 'reason' | 'person'

export interface EmployeeInsightQuery {
  report: EmployeeInsightReportId
  startDate: string
  endDate: string
  teams: string[]
  segments: string[]
  reasons: string[]
  employeeStatus: 'all' | 'active' | 'former'
  groupBy: EmployeeInsightGroupBy
  sortBy: 'total' | 'name' | 'trend'
  yearSpan: 1 | 3 | 5
}

export interface EmployeeInsightFilterOptions {
  teams: string[]
  segments: string[]
  reasons: string[]
}

export interface EmployeeInsightRow {
  administrationNumber: string
  employeeNumber: string
  employeeId: string
  employeeName: string
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
  birthDate: string | null
  age: number | null
  team: string | null
  segment: string | null
  startDate: string
  endDate: string | null
  reason: string | null
}

export interface EmployeeInsightGroup {
  label: string
  count: number
  percentage: number
  averageAge: number | null
}

export interface EmployeeInsightReport {
  report: EmployeeInsightReportId
  period: { startDate: string; endDate: string }
  total: number
  groups: EmployeeInsightGroup[]
  trend: Array<{ month: string; total: number }>
  rows: EmployeeInsightRow[]
  filterOptions: EmployeeInsightFilterOptions
}
