import type { DashboardWidgetType } from './schemas'

export const dashboardWidgetCategories = ['CORE_HR', 'EMPLOYMENT', 'DOCUMENTS', 'COMPENSATION', 'ORGANIZATION_TIME'] as const
export type DashboardWidgetCategory = (typeof dashboardWidgetCategories)[number]

export const dashboardWidgetWidths = ['HALF', 'TWO_THIRDS', 'FULL'] as const
export type DashboardWidgetWidth = (typeof dashboardWidgetWidths)[number]

export const dashboardWidgetVisualizations = ['PROFILE', 'KPI', 'TABLE', 'PROGRESS', 'BAR', 'DONUT', 'LINE', 'TIMELINE', 'CALENDAR'] as const
export type DashboardWidgetVisualization = (typeof dashboardWidgetVisualizations)[number]

export interface DashboardWidgetCatalogEntry {
  type: DashboardWidgetType
  category: DashboardWidgetCategory
  titleKey: string
  descriptionKey: string
  visualization: DashboardWidgetVisualization
  defaultWidth: DashboardWidgetWidth
  loader: string
  permissions: readonly string[]
  selfOnly?: boolean
}

const employeeRead = ['employee:read'] as const
const hrRead = ['employee:read', 'department:read'] as const
const employmentRead = ['employee:read', 'contract:read'] as const
const salaryRead = ['employee:read', 'salary:read'] as const

export const DASHBOARD_WIDGET_CATALOG: readonly DashboardWidgetCatalogEntry[] = [
  { type: 'WELCOME', category: 'CORE_HR', titleKey: 'welcome', descriptionKey: 'welcomeBody', visualization: 'PROFILE', defaultWidth: 'FULL', loader: 'welcome', permissions: [] },
  { type: 'MY_PROFILE', category: 'CORE_HR', titleKey: 'widgets.myProfile.title', descriptionKey: 'widgets.myProfile.description', visualization: 'PROFILE', defaultWidth: 'HALF', loader: 'myProfile', permissions: employeeRead, selfOnly: true },
  { type: 'PROFILE_COMPLETENESS', category: 'CORE_HR', titleKey: 'widgets.profileCompleteness.title', descriptionKey: 'widgets.profileCompleteness.description', visualization: 'PROGRESS', defaultWidth: 'HALF', loader: 'profileCompleteness', permissions: employeeRead, selfOnly: true },
  { type: 'MY_EMERGENCY_CONTACTS', category: 'CORE_HR', titleKey: 'widgets.myEmergencyContacts.title', descriptionKey: 'widgets.myEmergencyContacts.description', visualization: 'TABLE', defaultWidth: 'HALF', loader: 'myEmergencyContacts', permissions: employeeRead, selfOnly: true },
  { type: 'EMPLOYEE_DIRECTORY', category: 'CORE_HR', titleKey: 'widgets.employeeDirectory.title', descriptionKey: 'widgets.employeeDirectory.description', visualization: 'TABLE', defaultWidth: 'TWO_THIRDS', loader: 'employeeDirectory', permissions: employeeRead },
  { type: 'UPCOMING_BIRTHDAYS', category: 'CORE_HR', titleKey: 'widgets.upcomingBirthdays.title', descriptionKey: 'widgets.upcomingBirthdays.description', visualization: 'CALENDAR', defaultWidth: 'HALF', loader: 'upcomingBirthdays', permissions: employeeRead },
  { type: 'HEADCOUNT_BY_DEPARTMENT', category: 'CORE_HR', titleKey: 'widgets.headcountByDepartment.title', descriptionKey: 'widgets.headcountByDepartment.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'headcountByDepartment', permissions: hrRead },
  { type: 'GENDER_DISTRIBUTION', category: 'CORE_HR', titleKey: 'widgets.genderDistribution.title', descriptionKey: 'widgets.genderDistribution.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'genderDistribution', permissions: hrRead },
  { type: 'EDUCATION_MIX', category: 'CORE_HR', titleKey: 'widgets.educationMix.title', descriptionKey: 'widgets.educationMix.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'educationMix', permissions: hrRead },
  { type: 'NATIONALITY_DISTRIBUTION', category: 'CORE_HR', titleKey: 'widgets.nationalityDistribution.title', descriptionKey: 'widgets.nationalityDistribution.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'nationalityDistribution', permissions: hrRead },
  { type: 'MY_CONTRACT_DETAILS', category: 'EMPLOYMENT', titleKey: 'widgets.myContractDetails.title', descriptionKey: 'widgets.myContractDetails.description', visualization: 'PROFILE', defaultWidth: 'HALF', loader: 'myContractDetails', permissions: employmentRead, selfOnly: true },
  { type: 'CONTRACT_TYPE_MIX', category: 'EMPLOYMENT', titleKey: 'widgets.contractTypeMix.title', descriptionKey: 'widgets.contractTypeMix.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'contractTypeMix', permissions: employmentRead },
  { type: 'EXPIRING_CONTRACTS', category: 'EMPLOYMENT', titleKey: 'widgets.expiringContracts.title', descriptionKey: 'widgets.expiringContracts.description', visualization: 'TABLE', defaultWidth: 'TWO_THIRDS', loader: 'expiringContracts', permissions: employmentRead },
  { type: 'PROBATION_ALERTS', category: 'EMPLOYMENT', titleKey: 'widgets.probationAlerts.title', descriptionKey: 'widgets.probationAlerts.description', visualization: 'TABLE', defaultWidth: 'HALF', loader: 'probationAlerts', permissions: employmentRead },
  { type: 'UPCOMING_STARTS', category: 'EMPLOYMENT', titleKey: 'widgets.upcomingStarts.title', descriptionKey: 'widgets.upcomingStarts.description', visualization: 'TABLE', defaultWidth: 'HALF', loader: 'upcomingStarts', permissions: employmentRead },
  { type: 'CURRENT_MONTH_ENDS', category: 'EMPLOYMENT', titleKey: 'widgets.currentMonthEnds.title', descriptionKey: 'widgets.currentMonthEnds.description', visualization: 'TABLE', defaultWidth: 'HALF', loader: 'currentMonthEnds', permissions: employmentRead },
  { type: 'AVERAGE_TENURE', category: 'EMPLOYMENT', titleKey: 'widgets.averageTenure.title', descriptionKey: 'widgets.averageTenure.description', visualization: 'KPI', defaultWidth: 'HALF', loader: 'averageTenure', permissions: employmentRead },
  { type: 'EMPLOYMENT_STATUS_MIX', category: 'EMPLOYMENT', titleKey: 'widgets.employmentStatusMix.title', descriptionKey: 'widgets.employmentStatusMix.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'employmentStatusMix', permissions: employmentRead },
  { type: 'EMPLOYMENT_CHANGE_TIMELINE', category: 'EMPLOYMENT', titleKey: 'widgets.employmentChangeTimeline.title', descriptionKey: 'widgets.employmentChangeTimeline.description', visualization: 'TIMELINE', defaultWidth: 'FULL', loader: 'employmentChangeTimeline', permissions: employmentRead },
  { type: 'MY_RECENT_DOCUMENTS', category: 'DOCUMENTS', titleKey: 'widgets.myRecentDocuments.title', descriptionKey: 'widgets.myRecentDocuments.description', visualization: 'TABLE', defaultWidth: 'HALF', loader: 'myRecentDocuments', permissions: employeeRead, selfOnly: true },
  { type: 'EXPIRING_DOCUMENTS', category: 'DOCUMENTS', titleKey: 'widgets.expiringDocuments.title', descriptionKey: 'widgets.expiringDocuments.description', visualization: 'TABLE', defaultWidth: 'TWO_THIRDS', loader: 'expiringDocuments', permissions: ['employee:read', 'document:read'] },
  { type: 'DOCUMENTS_BY_CATEGORY', category: 'DOCUMENTS', titleKey: 'widgets.documentsByCategory.title', descriptionKey: 'widgets.documentsByCategory.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'documentsByCategory', permissions: ['employee:read', 'document:read'] },
  { type: 'DOCUMENTS_PER_EMPLOYEE', category: 'DOCUMENTS', titleKey: 'widgets.documentsPerEmployee.title', descriptionKey: 'widgets.documentsPerEmployee.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'documentsPerEmployee', permissions: ['employee:read', 'document:read'] },
  { type: 'DOCUMENT_REMINDER_STATUS', category: 'DOCUMENTS', titleKey: 'widgets.documentReminderStatus.title', descriptionKey: 'widgets.documentReminderStatus.description', visualization: 'KPI', defaultWidth: 'HALF', loader: 'documentReminderStatus', permissions: ['employee:read', 'document:read'] },
  { type: 'MY_SALARY_HISTORY', category: 'COMPENSATION', titleKey: 'widgets.mySalaryHistory.title', descriptionKey: 'widgets.mySalaryHistory.description', visualization: 'LINE', defaultWidth: 'TWO_THIRDS', loader: 'mySalaryHistory', permissions: salaryRead, selfOnly: true },
  { type: 'AVERAGE_SALARY_BY_DEPARTMENT', category: 'COMPENSATION', titleKey: 'widgets.averageSalaryByDepartment.title', descriptionKey: 'widgets.averageSalaryByDepartment.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'averageSalaryByDepartment', permissions: ['employee:read', 'salary:read', 'department:read'] },
  { type: 'SALARY_SCALE_OCCUPANCY', category: 'COMPENSATION', titleKey: 'widgets.salaryScaleOccupancy.title', descriptionKey: 'widgets.salaryScaleOccupancy.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'salaryScaleOccupancy', permissions: ['employee:read', 'salary:read'] },
  { type: 'PAYMENT_TYPE_MIX', category: 'COMPENSATION', titleKey: 'widgets.paymentTypeMix.title', descriptionKey: 'widgets.paymentTypeMix.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'paymentTypeMix', permissions: salaryRead },
  { type: 'COST_ALLOCATION_MIX', category: 'COMPENSATION', titleKey: 'widgets.costAllocationMix.title', descriptionKey: 'widgets.costAllocationMix.description', visualization: 'DONUT', defaultWidth: 'HALF', loader: 'costAllocationMix', permissions: salaryRead },
  { type: 'SALARY_CHANGE_TIMELINE', category: 'COMPENSATION', titleKey: 'widgets.salaryChangeTimeline.title', descriptionKey: 'widgets.salaryChangeTimeline.description', visualization: 'TIMELINE', defaultWidth: 'FULL', loader: 'salaryChangeTimeline', permissions: salaryRead },
  { type: 'MY_WEEKLY_ROSTER', category: 'ORGANIZATION_TIME', titleKey: 'widgets.myWeeklyRoster.title', descriptionKey: 'widgets.myWeeklyRoster.description', visualization: 'TABLE', defaultWidth: 'TWO_THIRDS', loader: 'myWeeklyRoster', permissions: ['employee:read', 'work-schedule:read'], selfOnly: true },
  { type: 'WEEKDAY_HOURS', category: 'ORGANIZATION_TIME', titleKey: 'widgets.weekdayHours.title', descriptionKey: 'widgets.weekdayHours.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'weekdayHours', permissions: ['employee:read', 'work-schedule:read'] },
  { type: 'FTE_BY_DEPARTMENT', category: 'ORGANIZATION_TIME', titleKey: 'widgets.fteByDepartment.title', descriptionKey: 'widgets.fteByDepartment.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'fteByDepartment', permissions: hrRead },
  { type: 'ROSTER_COVERAGE_BY_DEPARTMENT', category: 'ORGANIZATION_TIME', titleKey: 'widgets.rosterCoverageByDepartment.title', descriptionKey: 'widgets.rosterCoverageByDepartment.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'rosterCoverageByDepartment', permissions: ['employee:read', 'work-schedule:read', 'department:read'] },
  { type: 'UPCOMING_HOLIDAYS', category: 'ORGANIZATION_TIME', titleKey: 'widgets.upcomingHolidays.title', descriptionKey: 'widgets.upcomingHolidays.description', visualization: 'CALENDAR', defaultWidth: 'HALF', loader: 'upcomingHolidays', permissions: ['hr-calendar:read'] },
  { type: 'ACTIVE_REMINDERS', category: 'ORGANIZATION_TIME', titleKey: 'widgets.activeReminders.title', descriptionKey: 'widgets.activeReminders.description', visualization: 'TABLE', defaultWidth: 'HALF', loader: 'activeReminders', permissions: ['reminder:read'] },
  { type: 'ORGANIZATION_SUMMARY', category: 'ORGANIZATION_TIME', titleKey: 'widgets.organizationSummary.title', descriptionKey: 'widgets.organizationSummary.description', visualization: 'KPI', defaultWidth: 'HALF', loader: 'organizationSummary', permissions: ['organization-chart:read'] },
  { type: 'WORK_PATTERNS_BY_DEPARTMENT', category: 'ORGANIZATION_TIME', titleKey: 'widgets.workPatternsByDepartment.title', descriptionKey: 'widgets.workPatternsByDepartment.description', visualization: 'BAR', defaultWidth: 'TWO_THIRDS', loader: 'workPatternsByDepartment', permissions: ['employee:read', 'work-schedule:read', 'department:read'] },
]

export function getWidgetCatalogEntry(type: DashboardWidgetType): DashboardWidgetCatalogEntry | undefined {
  return DASHBOARD_WIDGET_CATALOG.find((entry) => entry.type === type)
}

export function getAvailableWidgetCatalog(): readonly DashboardWidgetCatalogEntry[] {
  return DASHBOARD_WIDGET_CATALOG
}
