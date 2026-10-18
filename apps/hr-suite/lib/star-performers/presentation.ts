import type { Translator } from '@/lib/i18n/translator'

export type StarPerformersInsightLabels = {
  activePlans: string
  allPeriods: string
  approvedGrid: string
  assessedCount: string
  assessedKeyEmployees: string
  averageProgress: string
  byDepartment: string
  byJob: string
  byJobGroup: string
  comparableHistory: string
  comparableMovement: string
  comparedWith: string
  coverage: string
  criticality: string
  criticalityDistribution: string
  criticalityDistributionDescription: string
  department: string
  developmentPlans: string
  due: string
  employee: string
  employees: string
  employeesInScope: string
  employeesWithPlans: string
  evaluatedEmployees: string
  gaps: string
  gridDistribution: string
  gridDistributionDescription: string
  group: string
  highCriticalCount: string
  highCriticalEmployees: string
  highCriticalThreshold: string
  highHighEmployees: string
  highHighEmployeesDescription: string
  highHighSignals: string
  independentAssessmentSources: string
  insightKpiScope: string
  insightNavigation: string
  insights: string
  insightsDescription: string
  insightsDevelopment: string
  insightsKeyEmployees: string
  insightsSkillGaps: string
  insightsSkills: string
  insightsTopTalent: string
  job: string
  loadFailed: string
  loading: string
  movement: string
  movementDown: string
  movementStable: string
  movementUnavailable: string
  movementUp: string
  noAssessedKeyEmployees: string
  noBreakdownData: string
  noDevelopmentData: string
  noHighHighEmployees: string
  noHighHighEmployeesDescription: string
  noOpenActions: string
  noRoleData: string
  noSkillGaps: string
  noSkillsData: string
  noSkillsDataDescription: string
  ofAssessed: string
  openActions: string
  openEmployee: string
  overlap: string
  overlapDescription: string
  overlapEmployees: string
  period: string
  requirements: string
  retry: string
  roleSkillCoverage: string
  roleSkillCoverageDescription: string
  rolesWithEvidence: string
  skillGapAffectedEmployees: string
  skillGapAsOf: string
  skillGapAssessed: string
  skillGapCoverage: string
  skillGapCurrentLevel: string
  skillGapDescription: string
  skillGapDependency: string
  skillGapExport: string
  skillGapExpiredEvidence: string
  skillGapInsufficientLevel: string
  skillGapMissingEvidence: string
  skillGapMissingLevel: string
  skillGapMatch: string
  skillGapNoData: string
  skillGapNoDataDescription: string
  skillGapNotAssessed: string
  skillGapRequiredLevel: string
  skillGapRelevantEmployees: string
  skillGapSourceProfile: string
  skillGapStatus: string
  skillGaps: string
  skills: string
  sourceUnavailable: string
  topGaps: string
  trendAvailable: string
  trendUnavailable: string
  unavailable: string
  until: string
  vulnerabilitySignals: string
}

export type StarPerformersReportFilterLabels = {
  allJobGroups: string
  allJobs: string
  allStatuses: string
  allTeams: string
  filtersTitle: string
  job: string
  jobGroup: string
  relevantStatus: string
  search: string
  searchPlaceholder: string
  statusAssessed: string
  statusHighHigh: string
  statusNotAssessed: string
  team: string
}

export function createStarPerformersInsightLabels(t: Translator): StarPerformersInsightLabels {
  return {
    activePlans: t('activePlans'), allPeriods: t('allPeriods'), approvedGrid: t('approvedGrid'), assessedCount: t('assessedCount'), assessedKeyEmployees: t('assessedKeyEmployees'), averageProgress: t('averageProgress'), byDepartment: t('byDepartment'), byJob: t('byJob'), byJobGroup: t('byJobGroup'), comparableHistory: t('comparableHistory'), comparableMovement: t('comparableMovement'), comparedWith: t('comparedWith'), coverage: t('coverage'), criticality: t('criticality'), criticalityDistribution: t('criticalityDistribution'), criticalityDistributionDescription: t('criticalityDistributionDescription'), department: t('department'), developmentPlans: t('developmentPlans'), due: t('due'), employee: t('employee'), employees: t('employees'), employeesInScope: t('employeesInScope'), employeesWithPlans: t('employeesWithPlans'), evaluatedEmployees: t('evaluatedEmployees'), gaps: t('gaps'), gridDistribution: t('gridDistribution'), gridDistributionDescription: t('gridDistributionDescription'), group: t('group'), highCriticalCount: t('highCriticalCount'), highCriticalEmployees: t('highCriticalEmployees'), highCriticalThreshold: t('highCriticalThreshold'), highHighEmployees: t('highHighEmployees'), highHighEmployeesDescription: t('highHighEmployeesDescription'), highHighSignals: t('highHighSignals'), independentAssessmentSources: t('independentAssessmentSources'), insightKpiScope: t('insightKpiScope'), insightNavigation: t('insightNavigation'), insights: t('insights'), insightsDescription: t('insightsDescription'), insightsDevelopment: t('insightsDevelopment'), insightsKeyEmployees: t('insightsKeyEmployees'), insightsSkillGaps: t('insightsSkillGaps'), insightsSkills: t('insightsSkills'), insightsTopTalent: t('insightsTopTalent'), job: t('job'), loadFailed: t('loadFailed'), loading: t('loading'), movement: t('movement'), movementDown: t('movementDown'), movementStable: t('movementStable'), movementUnavailable: t('movementUnavailable'), movementUp: t('movementUp'), noAssessedKeyEmployees: t('noAssessedKeyEmployees'), noBreakdownData: t('noBreakdownData'), noDevelopmentData: t('noDevelopmentData'), noHighHighEmployees: t('noHighHighEmployees'), noHighHighEmployeesDescription: t('noHighHighEmployeesDescription'), noOpenActions: t('noOpenActions'), noRoleData: t('noRoleData'), noSkillGaps: t('noSkillGaps'), noSkillsData: t('noSkillsData'), noSkillsDataDescription: t('noSkillsDataDescription'), ofAssessed: t('ofAssessed'), openActions: t('openActions'), openEmployee: t('openEmployee'), overlap: t('overlap'), overlapDescription: t('overlapDescription'), overlapEmployees: t('overlapEmployees'), period: t('period'), requirements: t('requirements'), retry: t('retry'), roleSkillCoverage: t('roleSkillCoverage'), roleSkillCoverageDescription: t('roleSkillCoverageDescription'), rolesWithEvidence: t('rolesWithEvidence'), skillGapAffectedEmployees: t('skillGapAffectedEmployees'), skillGapAsOf: t('skillGapAsOf'), skillGapAssessed: t('skillGapAssessed'), skillGapCoverage: t('skillGapCoverage'), skillGapCurrentLevel: t('skillGapCurrentLevel'), skillGapDescription: t('skillGapDescription'), skillGapDependency: t('skillGapDependency'), skillGapExport: t('skillGapExport'), skillGapExpiredEvidence: t('skillGapExpiredEvidence'), skillGapInsufficientLevel: t('skillGapInsufficientLevel'), skillGapMissingEvidence: t('skillGapMissingEvidence'), skillGapMissingLevel: t('skillGapMissingLevel'), skillGapMatch: t('skillGapMatch'), skillGapNoData: t('skillGapNoData'), skillGapNoDataDescription: t('skillGapNoDataDescription'), skillGapNotAssessed: t('skillGapNotAssessed'), skillGapRequiredLevel: t('skillGapRequiredLevel'), skillGapRelevantEmployees: t('skillGapRelevantEmployees'), skillGapSourceProfile: t('skillGapSourceProfile'), skillGapStatus: t('skillGapStatus'), skillGaps: t('skillGaps'), skills: t('skills'), sourceUnavailable: t('sourceUnavailable'), topGaps: t('topGaps'), trendAvailable: t('trendAvailable'), trendUnavailable: t('trendUnavailable'), unavailable: t('unavailable'), until: t('until'), vulnerabilitySignals: t('vulnerabilitySignals'),
  }
}

export function createStarPerformersReportFilterLabels(t: Translator): StarPerformersReportFilterLabels {
  return {
    allJobGroups: t('allJobGroups'), allJobs: t('allJobs'), allStatuses: t('allStatuses'), allTeams: t('allTeams'), filtersTitle: t('filtersTitle'), job: t('job'), jobGroup: t('jobGroup'), relevantStatus: t('relevantStatus'), search: t('search'), searchPlaceholder: t('searchPlaceholder'), statusAssessed: t('statusAssessed'), statusHighHigh: t('statusHighHigh'), statusNotAssessed: t('statusNotAssessed'), team: t('team'),
  }
}
