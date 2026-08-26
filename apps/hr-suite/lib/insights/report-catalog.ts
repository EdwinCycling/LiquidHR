import type { EmployeeInsightReportId } from './types'
import { SALARY_INSIGHT_REPORT_IDS, type SalaryInsightReportId } from './salary-insights-types'

export type InsightReportId = EmployeeInsightReportId | SalaryInsightReportId | 'leave' | 'absence' | 'absence-bradford' | 'absence-frequent' | 'provision' | 'wvp' | 'upcoming-events'
export type InsightReportCategory = 'employees' | 'leave' | 'absence' | 'salary' | 'other'

export interface InsightReportDefinition {
  id: InsightReportId
  category: InsightReportCategory
  permission: string
  available: boolean
}

export const INSIGHT_REPORTS: readonly InsightReportDefinition[] = [
  { id: 'employee-department', category: 'employees', permission: 'report-employee-department:read', available: true },
  { id: 'employee-gender', category: 'employees', permission: 'report-employee-gender:read', available: true },
  { id: 'employee-age', category: 'employees', permission: 'report-employee-age:read', available: true },
  { id: 'terminations', category: 'employees', permission: 'report-terminations:read', available: true },
  { id: 'upcoming-events', category: 'employees', permission: 'report-upcoming-events:read', available: true },
  { id: 'leave', category: 'leave', permission: 'report-leave:read', available: false },
  { id: 'absence', category: 'absence', permission: 'report-absence:read', available: true },
  { id: 'absence-bradford', category: 'absence', permission: 'report-absence:read', available: true },
  { id: 'absence-frequent', category: 'absence', permission: 'report-absence:read', available: true },
  ...SALARY_INSIGHT_REPORT_IDS.map((id): InsightReportDefinition => ({ id, category: 'salary', permission: 'salary:read', available: true })),
  { id: 'provision', category: 'other', permission: 'report-leave-provision:read', available: false },
  { id: 'wvp', category: 'other', permission: 'report-wvp:read', available: false },
] as const

export function isEmployeeInsightReportId(report: InsightReportId): report is EmployeeInsightReportId {
  return report === 'employee-department' || report === 'employee-gender' || report === 'employee-age' || report === 'terminations'
}

export function isSalaryInsightReportId(report: InsightReportId): report is SalaryInsightReportId {
  return (SALARY_INSIGHT_REPORT_IDS as readonly string[]).includes(report)
}

export function insightReportPermission(report: EmployeeInsightReportId): string {
  const definition = INSIGHT_REPORTS.find((item) => item.id === report)
  if (!definition) throw new Error('INSIGHTS_REPORT_UNKNOWN')
  return definition.permission
}
