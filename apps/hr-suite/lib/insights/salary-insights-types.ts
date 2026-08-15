import type { SalaryApplicationRoute } from '@/lib/salary-application/calculations'
import type { SalaryBandPositionStatus } from '@/lib/salary-application/calculations'

export const SALARY_INSIGHT_REPORT_IDS = [
  'salary-overview',
  'salary-band-position',
  'salary-band-status',
  'salary-scale-steps',
  'salary-structure-exceptions',
  'salary-internal-position',
] as const

export type SalaryInsightReportId = typeof SALARY_INSIGHT_REPORT_IDS[number]

export type SalaryInsightGroupBy =
  | 'salaryRoute'
  | 'administration'
  | 'department'
  | 'team'
  | 'functionGroup'
  | 'salaryStructure'
  | 'salaryBand'
  | 'salaryScale'
  | 'salaryStep'
  | 'status'
  | 'validity'
  | 'severity'
  | 'exceptionType'
  | 'function'

export type SalaryInsightSortBy =
  | 'name'
  | 'salary-desc'
  | 'salary-asc'
  | 'fte'
  | 'status'
  | 'compa-desc'
  | 'compa-asc'
  | 'band'
  | 'deviation'
  | 'structure'
  | 'scale'
  | 'step'
  | 'severity'
  | 'date'
  | 'type'
  | 'median-delta'
  | 'relative-position'

export interface SalaryInsightFilters {
  asOfDate: string
  groupBy: SalaryInsightGroupBy
  sortBy: SalaryInsightSortBy
  administrations: string[]
  departments: string[]
  teams: string[]
  managers: string[]
  functions: string[]
  functionGroups: string[]
  locations: string[]
  laborConditions: string[]
  structures: string[]
  bands: string[]
  scales: string[]
  steps: string[]
  fteBuckets: string[]
  employmentTypes: string[]
  salaryRoutes: string[]
  statuses: string[]
  severities: string[]
  exceptionTypes: string[]
}

export interface SalaryInsightProjectionRow {
  employeeId: string
  employeeNumber: string | null
  employeeName: string
  employmentId: string
  employmentNumber: string | null
  administrationId: string
  administrationName: string | null
  administrationNumber: string | null
  departmentId: string | null
  departmentName: string | null
  managerId: string | null
  managerName: string | null
  functionName: string | null
  functionGroupId: string | null
  functionGroupName: string | null
  seniorityId: string | null
  seniorityName: string | null
  locationId: string | null
  locationName: string | null
  laborConditionSetId: string | null
  laborConditionSetName: string | null
  employmentType: string | null
  fte: string | null
  fulltimeSalary: string | null
  actualSalary: string | null
  salaryRoute: SalaryApplicationRoute | null
  salaryStructureId: string | null
  salaryStructureName: string | null
  salaryStructureCode: string | null
  salaryStructureActive: boolean | null
  revisionId: string | null
  revisionEffectiveFrom: string | null
  revisionNumber: number | null
  salaryBandId: string | null
  salaryBandCode: string | null
  salaryBandName: string | null
  bandMinimum: string | null
  bandMidpoint: string | null
  bandMaximum: string | null
  salaryScaleId: string | null
  salaryScaleCode: string | null
  salaryScaleName: string | null
  salaryStepCode: string | null
  salaryStepName: string | null
  hasPublishedRevision: boolean
  hasResolvedBand: boolean
  hasResolvedScaleStep: boolean
  structureDisabled: boolean
}

export type SalaryInsightExceptionType =
  | 'NO_VALID_BAND'
  | 'INVALID_SCALE_STEP'
  | 'DISABLED_STRUCTURE'
  | 'NO_PUBLISHED_REVISION'

export type SalaryInsightExceptionSeverity = 'ATTENTION' | 'ACTION_REQUIRED'

export interface SalaryInsightRow extends SalaryInsightProjectionRow {
  bandStatus: SalaryBandPositionStatus | null
  bandDeviation: string | null
  compaRatio: string | null
  rangePenetration: string | null
  fteBucket: 'lt0.5' | '0.5to1' | 'gte1' | null
  exceptionTypes: SalaryInsightExceptionType[]
  exceptionType: SalaryInsightExceptionType | null
  exceptionSeverity: SalaryInsightExceptionSeverity | null
  peerGroupDefinition: string | null
  peerGroupSize: number | null
  peerMedian: string | null
  peerAverage: string | null
  medianDelta: string | null
  medianDeltaPercentage: string | null
  relativePosition: string | null
  peerStatus: 'SUFFICIENT' | 'INSUFFICIENT' | null
}

export interface SalaryInsightOption {
  value: string
  label: string
}

export interface SalaryInsightFilterOptions {
  administrations: SalaryInsightOption[]
  departments: SalaryInsightOption[]
  teams: SalaryInsightOption[]
  managers: SalaryInsightOption[]
  functions: SalaryInsightOption[]
  functionGroups: SalaryInsightOption[]
  locations: SalaryInsightOption[]
  laborConditions: SalaryInsightOption[]
  structures: SalaryInsightOption[]
  bands: SalaryInsightOption[]
  scales: SalaryInsightOption[]
  steps: SalaryInsightOption[]
  fteBuckets: SalaryInsightOption[]
  employmentTypes: SalaryInsightOption[]
  salaryRoutes: SalaryInsightOption[]
  statuses: SalaryInsightOption[]
  severities: SalaryInsightOption[]
  exceptionTypes: SalaryInsightOption[]
}

export interface SalaryInsightGroup {
  value: string
  label: string
  count: number
  percentage: number
}

export type SalaryInsightChartKind = 'fte-salary' | 'compa-distribution' | 'band-status' | 'group-distribution' | 'peer-position'

export interface SalaryInsightChartBucket {
  value: string
  label: string
  count: number
  percentage: number
  lowerBound: string | null
  upperBound: string | null
}

export interface SalaryInsightChart {
  kind: SalaryInsightChartKind
  population: number
  excluded: number
  buckets: SalaryInsightChartBucket[]
}

export interface SalaryInsightKpi {
  id: string
  value: string
  context: string | null
}

export interface SalaryInsightReport {
  report: SalaryInsightReportId
  asOfDate: string
  total: number
  authorizedPopulation: number
  filters: SalaryInsightFilters
  kpis: SalaryInsightKpi[]
  groups: SalaryInsightGroup[]
  chart: SalaryInsightChart
  rows: SalaryInsightRow[]
  filterOptions: SalaryInsightFilterOptions
}
