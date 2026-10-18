import type { EmployeeInsightReportId } from './types'
import { SALARY_INSIGHT_REPORT_IDS, type SalaryInsightReportId } from './salary-insights-types'

export type InsightReportId = EmployeeInsightReportId | SalaryInsightReportId | 'leave' | 'absence' | 'absence-bradford' | 'absence-frequent' | 'provision' | 'wvp' | 'upcoming-events' | 'ai-usage' | 'actual-work' | 'talent-top-talent' | 'talent-key-employees' | 'talent-star-skills' | 'talent-development' | 'talent-skills' | 'talent-pop'
export type InsightReportCategory = 'employees' | 'leave' | 'absence' | 'salary' | 'talent' | 'other'

export interface InsightReportDefinition {
  id: InsightReportId
  category: InsightReportCategory
  permission: string
  additionalPermissions?: readonly string[]
  route?: string
  adminRoute?: string
  available: boolean
}

export const INSIGHT_REPORTS: readonly InsightReportDefinition[] = [
  { id: 'employee-department', category: 'employees', permission: 'report-employee-department:read', available: true },
  { id: 'employee-gender', category: 'employees', permission: 'report-employee-gender:read', available: true },
  { id: 'employee-age', category: 'employees', permission: 'report-employee-age:read', available: true },
  { id: 'terminations', category: 'employees', permission: 'report-terminations:read', available: true },
  { id: 'upcoming-events', category: 'employees', permission: 'report-upcoming-events:read', available: true },
  { id: 'leave', category: 'leave', permission: 'report-leave:read', available: true },
  { id: 'absence', category: 'absence', permission: 'report-absence:read', available: true },
  { id: 'absence-bradford', category: 'absence', permission: 'report-absence:read', available: true },
  { id: 'absence-frequent', category: 'absence', permission: 'report-absence:read', available: true },
  ...SALARY_INSIGHT_REPORT_IDS.map((id): InsightReportDefinition => ({ id, category: 'salary', permission: 'salary:read', available: true })),
  { id: 'provision', category: 'other', permission: 'report-leave-provision:read', available: false },
  { id: 'wvp', category: 'other', permission: 'report-wvp:read', available: false },
  { id: 'ai-usage', category: 'other', permission: 'ai:usage-read', available: true },
  { id: 'actual-work', category: 'other', permission: 'leave:write', available: true },
  { id: 'talent-top-talent', category: 'talent', permission: 'star-performer:read', additionalPermissions: ['star-performer:manager-read'], route: '/workforce/talent/reports/star-performers?report=top-talent', available: true },
  { id: 'talent-key-employees', category: 'talent', permission: 'star-performer:read', additionalPermissions: ['star-performer:manager-read'], route: '/workforce/talent/reports/star-performers?report=key-employees', available: true },
  { id: 'talent-star-skills', category: 'talent', permission: 'star-performer:read', additionalPermissions: ['star-performer:manager-read'], route: '/workforce/talent/reports/star-performers?report=skills', available: true },
  { id: 'talent-development', category: 'talent', permission: 'star-performer:read', additionalPermissions: ['star-performer:manager-read'], route: '/workforce/talent/reports/star-performers?report=development', available: true },
  { id: 'talent-skills', category: 'talent', permission: 'talent-report:read', route: '/workforce/talent/reports?reportType=capabilities', adminRoute: '/settings/talent/reports?reportType=capabilities', available: true },
  { id: 'talent-pop', category: 'talent', permission: 'talent-report:read', route: '/workforce/talent/reports?reportType=goals', adminRoute: '/settings/talent/reports?reportType=goals', available: true },
] as const

export function isEmployeeInsightReportId(report: InsightReportId): report is EmployeeInsightReportId {
  return report === 'employee-department' || report === 'employee-gender' || report === 'employee-age' || report === 'terminations'
}

export function isSalaryInsightReportId(report: InsightReportId): report is SalaryInsightReportId {
  return (SALARY_INSIGHT_REPORT_IDS as readonly string[]).includes(report)
}

export function insightReportPermission(report: InsightReportId): string {
  const definition = INSIGHT_REPORTS.find((item) => item.id === report)
  if (!definition) throw new Error('INSIGHTS_REPORT_UNKNOWN')
  return definition.permission
}

export function canReadInsightReport(report: InsightReportDefinition, permissions: readonly string[]): boolean {
  return [report.permission, ...(report.additionalPermissions ?? [])].some((permission) => permissions.includes(permission))
}

export function insightReportRoute(report: InsightReportDefinition, isHrAdmin: boolean): string | undefined {
  return isHrAdmin ? report.adminRoute ?? report.route : report.route
}
