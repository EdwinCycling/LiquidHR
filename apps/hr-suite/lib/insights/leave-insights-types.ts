import type { LeaveAccrualFrequency, LeaveAccrualTiming } from '@/lib/leave/leave-engine'

export const LEAVE_INSIGHT_VIEWS = [
  'overview',
  'balances',
  'expiry',
  'usage',
  'capacity',
  'accrual',
  'mutations',
  'finance',
  'contract-end',
  'year-close',
  'exceptions',
] as const

export type LeaveInsightsView = typeof LEAVE_INSIGHT_VIEWS[number]
export type LeaveInsightsSeverity = 'INFO' | 'ATTENTION' | 'ACTION_REQUIRED'
export type LeaveInsightsReservoirStatus = 'UNLIMITED' | 'UNAVAILABLE' | 'LOW' | 'HEALTHY' | 'HIGH' | 'CRITICAL'
export type LeaveInsightsMutationClass = 'OPENING_BALANCE' | 'ACCRUAL' | 'TAKEN' | 'MANUAL_ADJUSTMENT' | 'EXPIRED_DEDUCTION'

export type LeaveInsightsExceptionCode =
  | 'NEGATIVE_BALANCE'
  | 'HIGH_RESERVOIR'
  | 'CRITICAL_RESERVOIR'
  | 'COHORT_EXPIRING'
  | 'EXPIRED_COHORT_REMAINS'
  | 'NO_LEAVE_TAKEN'
  | 'NO_FUTURE_LEAVE_PLANNED'
  | 'CONTRACT_END_WITH_BALANCE'
  | 'LARGE_MANUAL_ADJUSTMENT'
  | 'REPEATED_MANUAL_ADJUSTMENTS'
  | 'BALANCE_RECONCILIATION_MISMATCH'
  | 'REQUEST_ALLOCATION_MISMATCH'
  | 'TAKEN_ALLOCATION_MISMATCH'
  | 'NON_WORKDAY_CONSUMPTION'
  | 'HOLIDAY_CONSUMPTION'
  | 'DELETED_EMPLOYMENT_HAS_ACTIVE_LEAVE_FACTS'
  | 'NO_EFFECTIVE_LEAVE_PROFILE'
  | 'NO_EFFECTIVE_ACCRUAL_RULE'
  | 'INVALID_PRIORITY_CONFIGURATION'
  | 'YEAR_LOCK_INCONSISTENCY'
  | 'LONG_TERM_ABSENCE_WITH_EXPIRY_REVIEW'
  | 'MISSING_FINANCIAL_VALUATION_BASIS'

export interface LeaveInsightsQuery {
  report: 'leave'
  view: LeaveInsightsView
  year: number
  asOfDate: string
  periodStart: string
  periodEnd: string
  departmentId: string | null
  managerId: string | null
  leaveTypeId: string | null
  profileId: string | null
  severity: LeaveInsightsSeverity | null
  reservoirThreshold: number
}

export interface LeaveInsightsEmploymentFact {
  employeeId: string
  employeeNumber: string | null
  employeeName: string
  employmentId: string
  employmentNumber: string | null
  administrationId: string
  startsOn: string
  endsOn: string | null
  departmentId: string | null
  departmentName: string | null
  managerId: string | null
  managerName: string | null
  profileId: string | null
  profileName: string | null
  partTimeFactor: number | null
  deletedAt: string | null
}

export interface LeaveInsightsLeaveTypeFact {
  id: string
  name: string
  colorCode: string | null
  entitlementMode: string
  annualHoursCap: number | null
  annualHoursFteCap: number | null
}

export interface LeaveInsightsProfileFact {
  id: string
  name: string
  isActive: boolean
  isGroupDefault?: boolean
}

export interface LeaveInsightsEmployeeSetFact {
  id: string
  leaveProfileId: string
  priority: number
  name: string
  isActive: boolean
}

export interface LeaveInsightsEmployeeSetMemberFact {
  employeeSetId: string
  employeeId: string
  validFrom: string
  validUntil: string | null
}

export interface LeaveInsightsRulePauseTypeFact {
  accrualRuleId: string
  pauseLeaveTypeId: string
}

export interface LeaveInsightsAbsenceFact {
  employmentId: string
  firstAbsenceOn: string
  status: string
}

export interface LeaveInsightsProfileAssignmentFact {
  employmentId: string
  profileId: string
  validFrom: string
  validUntil: string | null
}

export interface LeaveInsightsRuleFact {
  id: string
  profileId: string
  leaveTypeId: string
  validFrom: string
  validUntil: string | null
  accrualBasis: string
  accrualFrequency: LeaveAccrualFrequency
  accrualTiming: LeaveAccrualTiming
  accrualAmount: number | null
  accrualRate: number | null
  expirationMonths: number | null
}

export interface LeaveInsightsExceptionFact {
  employmentId: string | null
  leaveTypeId: string | null
  validFrom: string
  validUntil: string | null
  noAccrual: boolean
  accrualAmount: number | null
  expirationMonths: number | null
  reason: string | null
}

export interface LeaveInsightsBucketFact {
  id: string
  employmentId: string
  leaveTypeId: string
  accrualYear: number
  sourceAccrualYear: number | null
  accrualReferenceDate: string
  expirationDate: string
  cohortKey: string | null
  totalAccrued: number
  totalTaken: number
  totalExpired: number
}

export interface LeaveInsightsTransactionFact {
  id: string
  employmentId: string
  leaveTypeId: string
  bucketId: string
  transactionType: LeaveInsightsMutationClass
  amount: number
  transactionDate: string
  reason: string | null
  actorUserId: string | null
  actorDisplayName: string | null
  sourceType: string | null
  sourceKey: string | null
  createdAt: string
}

export interface LeaveInsightsRequestFact {
  id: string
  employeeId: string
  employmentId: string
  requestMode: 'DIRECT' | 'PRIORITY'
  timeMode: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'
  startDate: string
  endDate: string
  specificStart: string | null
  specificEnd: string | null
  requestedMinutes: number
  status: string
  priorityRuleId: string | null
}

export interface LeaveInsightsAllocationFact {
  requestId: string
  employmentId: string
  leaveTypeId: string
  bucketId: string | null
  allocatedHours: number
  sortOrder: number
}

export interface LeaveInsightsPriorityRuleFact {
  id: string
  profileId: string | null
  validFrom: string
  validUntil: string | null
  isActive: boolean
}

export interface LeaveInsightsPriorityItemFact {
  priorityRuleId: string
  leaveTypeId: string
  sortOrder: number
}

export interface LeaveInsightsScheduleDayFact {
  employmentId: string
  date: string
  scheduledHours: number
  isWorkingDay: boolean
}

export interface LeaveInsightsProjectedDayFact {
  requestId: string
  employeeId: string
  employmentId: string
  date: string
  leaveTypeId: string
  hours: number
  requestMode: 'DIRECT' | 'PRIORITY'
  timeMode: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'
}

export interface LeaveInsightsYearControlFact {
  administrationId: string
  year: number
  status: string
}

export interface LeaveInsightsFinancialValuationFact {
  employmentId: string
  valuationDate: string
  hourlyRate: number | null
  basisLabel: string | null
}

export interface LeaveInsightsFacts {
  employments: readonly LeaveInsightsEmploymentFact[]
  leaveTypes: readonly LeaveInsightsLeaveTypeFact[]
  profiles: readonly LeaveInsightsProfileFact[]
  employeeSets: readonly LeaveInsightsEmployeeSetFact[]
  employeeSetMembers: readonly LeaveInsightsEmployeeSetMemberFact[]
  assignments: readonly LeaveInsightsProfileAssignmentFact[]
  rules: readonly LeaveInsightsRuleFact[]
  rulePauseTypes: readonly LeaveInsightsRulePauseTypeFact[]
  exceptions: readonly LeaveInsightsExceptionFact[]
  buckets: readonly LeaveInsightsBucketFact[]
  transactions: readonly LeaveInsightsTransactionFact[]
  requests: readonly LeaveInsightsRequestFact[]
  allocations: readonly LeaveInsightsAllocationFact[]
  priorityRules: readonly LeaveInsightsPriorityRuleFact[]
  priorityItems: readonly LeaveInsightsPriorityItemFact[]
  scheduleDays: readonly LeaveInsightsScheduleDayFact[]
  projectedDays: readonly LeaveInsightsProjectedDayFact[]
  holidays: ReadonlySet<string>
  yearControls: readonly LeaveInsightsYearControlFact[]
  financialValuations: readonly LeaveInsightsFinancialValuationFact[]
  absences: readonly LeaveInsightsAbsenceFact[]
}

export interface LeaveInsightsBalanceRow extends LeaveInsightsEmploymentFact {
  leaveTypeId: string
  leaveTypeName: string
  entitlementMode: string
  annualFullTimeEntitlement: number | null
  annualEntitlement: number | null
  openingBalance: number | null
  accruedToDate: number | null
  manualAdjustment: number
  takenToDate: number
  expiredToDate: number
  asOfBalance: number | null
  futurePlanned: number | null
  freeToPlan: number | null
  projectedYearEnd: number | null
  projectedContractEnd: number | null
  reservoirRatio: number | null
  reservoirStatus: LeaveInsightsReservoirStatus
}

export interface LeaveInsightsCohortRow extends LeaveInsightsEmploymentFact {
  leaveTypeId: string
  leaveTypeName: string
  bucketId: string
  sourceAccrualYear: number
  accrualYear: number
  cohortKey: string | null
  expirationDate: string
  daysUntilExpiration: number
  accruedHours: number
  takenHours: number
  expiredHours: number
  remainingHours: number
  status: 'EXPIRED_REMAINS' | 'EXPIRING_SOON' | 'ACTIVE' | 'EMPTY'
}

export interface LeaveInsightsUsageRow extends LeaveInsightsEmploymentFact {
  leaveTypeId: string
  leaveTypeName: string
  approvedRequestCount: number
  takenHours: number
  plannedHours: number
  takenDays: number
  plannedDays: number
  halfDayCount: number
  fullDayCount: number
  multiDayPeriodCount: number
  averagePeriodHours: number | null
  medianPeriodHours: number | null
  firstTakenDate: string | null
  lastTakenDate: string | null
}

export interface LeaveInsightsCapacityRow extends LeaveInsightsEmploymentFact {
  scheduledHours: number
  leaveHours: number
  availableHours: number
  scheduledDays: number
  leaveDays: number
  leaveRate: number
  nonWorkdayConsumption: number
  holidayConsumption: number
}

export interface LeaveInsightsCapacityDayRow {
  date: string
  scheduledHours: number
  leaveHours: number
  availableHours: number
  leaveRate: number
  employeeCount: number
  leaveEmployeeCount: number
}

export interface LeaveInsightsAccrualRow extends LeaveInsightsEmploymentFact {
  leaveTypeId: string
  leaveTypeName: string
  profileId: string | null
  profileName: string | null
  ruleId: string | null
  accrualBasis: string | null
  accrualFrequency: LeaveAccrualFrequency | null
  accrualTiming: LeaveAccrualTiming | null
  accrualAmount: number | null
  accrualRate: number | null
  expirationMonths: number | null
  annualFullTimeEntitlement: number | null
  partTimeFactor: number | null
  noAccrual: boolean
  pauseLeaveTypeNames: string[]
  accruedToDate: number | null
  projectedAccrual: number | null
  effectiveEntitlement: number | null
  migrationCutoverDate: string | null
  exceptionReason: string | null
  explanation: string
}

export interface LeaveInsightsMutationRow extends LeaveInsightsEmploymentFact {
  id: string
  leaveTypeId: string
  leaveTypeName: string
  bucketId: string
  transactionType: LeaveInsightsMutationClass
  amount: number
  transactionDate: string
  reason: string | null
  actorDisplayName: string | null
  sourceType: string | null
  sourceKey: string | null
  cohortKey: string | null
  accrualYear: number | null
  createdAt: string
}

export interface LeaveInsightsFinanceRow extends LeaveInsightsEmploymentFact {
  leaveTypeId: string
  leaveTypeName: string
  hours: number
  hourlyRate: number | null
  liabilityAmount: number | null
  valuationStatus: 'VALUED' | 'UNAVAILABLE'
  basisLabel: string | null
  valuationDate: string | null
}

export interface LeaveInsightsContractEndRow extends LeaveInsightsEmploymentFact {
  contractEndDate: string
  daysUntilContractEnd: number
  balanceAtAsOf: number
  plannedThroughContractEnd: number
  balanceAtContractEnd: number
  hasBalance: boolean
}

export interface LeaveInsightsYearCloseRow extends LeaveInsightsEmploymentFact {
  leaveTypeId: string
  leaveTypeName: string
  ledgerBalance: number
  bucketBalance: number
  difference: number
  beginningBalance: number
  openingBalance: number
  accrual: number
  positiveManualAdjustments: number
  negativeManualAdjustments: number
  taken: number
  expired: number
  endingBalance: number
  controlStatus: string
  status: 'RECONCILED' | 'MISMATCH' | 'NOT_LOCKED'
}

export interface LeaveInsightsExceptionRow extends LeaveInsightsEmploymentFact {
  code: LeaveInsightsExceptionCode
  severity: LeaveInsightsSeverity
  leaveTypeId: string | null
  leaveTypeName: string | null
  details: string
}

export interface LeaveInsightsOverviewKpis {
  employees: number
  employments: number
  balanceHours: number
  takenHours: number
  futurePlannedHours: number
  expiringHours: number
  expiring30Hours: number
  expiring60Hours: number
  expiring90Hours: number
  expiring180Hours: number
  carryForwardHours: number
  employeesWithReservoirSignal: number
  employeesWithoutTakenLeave: number
  employeesWithoutFutureLeave: number
  contractsEndingWithBalance: number
  exceptionCount: number
  valuedLiabilityHours: number
  valuedLiabilityAmount: number | null
}

export interface LeaveInsightsFilterOption {
  value: string
  label: string
}

export interface LeaveInsightsFilterOptions {
  departments: LeaveInsightsFilterOption[]
  managers: LeaveInsightsFilterOption[]
  leaveTypes: LeaveInsightsFilterOption[]
  profiles: LeaveInsightsFilterOption[]
  severities: LeaveInsightsFilterOption[]
}

export interface LeaveInsightsReport {
  report: 'leave'
  query: LeaveInsightsQuery
  kpis: LeaveInsightsOverviewKpis
  balances: LeaveInsightsBalanceRow[]
  cohorts: LeaveInsightsCohortRow[]
  usage: LeaveInsightsUsageRow[]
  capacity: LeaveInsightsCapacityRow[]
  capacityDays: LeaveInsightsCapacityDayRow[]
  accrual: LeaveInsightsAccrualRow[]
  mutations: LeaveInsightsMutationRow[]
  finance: LeaveInsightsFinanceRow[]
  contractEnd: LeaveInsightsContractEndRow[]
  yearClose: LeaveInsightsYearCloseRow[]
  exceptions: LeaveInsightsExceptionRow[]
  filterOptions: LeaveInsightsFilterOptions
  financeAvailable: boolean
}
