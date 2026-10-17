import Link from 'next/link'
import { ArrowLeft, Tags } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { starPerformerWorkspaceQuerySchema } from '@/lib/star-performers/schemas'
import { listStarPerformersWorkspacePage } from '@/lib/star-performers/v2-service'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StarPerformersWorkspace } from '@/components/settings/star-performers-workspace'

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function StarPerformersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let canWrite = false
  let canViewEmployees = false
  try {
    const authContext = await requirePermission('star-performer:read')
    canWrite = authContext.permissions.includes('star-performer:write')
    canViewEmployees = authContext.permissions.includes('employee:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const rawQuery = await searchParams
  const query = starPerformerWorkspaceQuerySchema.parse({
    perspective: queryValue(rawQuery.perspective),
    area: queryValue(rawQuery.area),
    insight: queryValue(rawQuery.insight),
    q: queryValue(rawQuery.q),
    departmentId: queryValue(rawQuery.departmentId),
    jobId: queryValue(rawQuery.jobId),
    jobGroupId: queryValue(rawQuery.jobGroupId),
    period: queryValue(rawQuery.period),
    status: queryValue(rawQuery.status),
    page: queryValue(rawQuery.page),
    pageSize: queryValue(rawQuery.pageSize),
  })
  const [initial, t] = await Promise.all([listStarPerformersWorkspacePage(query), getTranslator('starPerformers')])

  const labels = {
    perspective: t('perspective'), topTalent: t('topTalent'), keyEmployees: t('keyEmployees'), topTalentDescription: t('topTalentDescription'), keyEmployeesDescription: t('keyEmployeesDescription'), areaNavigation: t('areaNavigation'), overview: t('overview'), employees: t('employees'), keyRoles: t('keyRoles'), development: t('development'), insights: t('insights'), insightsDescription: t('insightsDescription'), insightsTopTalent: t('insightsTopTalent'), insightsKeyEmployees: t('insightsKeyEmployees'), insightsSkills: t('insightsSkills'), insightsDevelopment: t('insightsDevelopment'), insightNavigation: t('insightNavigation'), insightKpiScope: t('insightKpiScope'), period: t('period'), allPeriods: t('allPeriods'), comparableMovement: t('comparableMovement'), gridDistribution: t('gridDistribution'), gridDistributionDescription: t('gridDistributionDescription'), ofAssessed: t('ofAssessed'), highHighEmployees: t('highHighEmployees'), highHighEmployeesDescription: t('highHighEmployeesDescription'), sourceUnavailable: t('sourceUnavailable'), noHighHighEmployees: t('noHighHighEmployees'), noHighHighEmployeesDescription: t('noHighHighEmployeesDescription'), comparedWith: t('comparedWith'), comparableHistory: t('comparableHistory'), movementUnavailable: t('movementUnavailable'), highCriticalEmployees: t('highCriticalEmployees'), overlap: t('overlap'), criticalityDistribution: t('criticalityDistribution'), criticalityDistributionDescription: t('criticalityDistributionDescription'), highCriticalThreshold: t('highCriticalThreshold'), overlapDescription: t('overlapDescription'), overlapEmployees: t('overlapEmployees'), independentAssessmentSources: t('independentAssessmentSources'), group: t('group'), assessedCount: t('assessedCount'), highCriticalCount: t('highCriticalCount'), byDepartment: t('byDepartment'), byJobGroup: t('byJobGroup'), byJob: t('byJob'), noBreakdownData: t('noBreakdownData'), employee: t('employee'), noAssessedKeyEmployees: t('noAssessedKeyEmployees'), roleSkillCoverage: t('roleSkillCoverage'), roleSkillCoverageDescription: t('roleSkillCoverageDescription'), evaluatedEmployees: t('evaluatedEmployees'), rolesWithEvidence: t('rolesWithEvidence'), vulnerabilitySignals: t('vulnerabilitySignals'), requirements: t('requirements'), coverage: t('coverage'), gaps: t('gaps'), noSkillsData: t('noSkillsData'), noSkillsDataDescription: t('noSkillsDataDescription'), topGaps: t('topGaps'), activePlans: t('activePlans'), employeesWithPlans: t('employeesWithPlans'), averageProgress: t('averageProgress'), openActions: t('openActions'), noDevelopmentData: t('noDevelopmentData'), due: t('due'), until: t('until'), noOpenActions: t('noOpenActions'), trendAvailable: t('trendAvailable'), trendUnavailable: t('trendUnavailable'), filtersTitle: t('filtersTitle'), search: t('search'), searchPlaceholder: t('searchPlaceholder'), team: t('team'), allTeams: t('allTeams'), job: t('job'), allJobs: t('allJobs'), jobGroup: t('jobGroup'), allJobGroups: t('allJobGroups'), relevantStatus: t('relevantStatus'), allStatuses: t('allStatuses'), statusHighHigh: t('statusHighHigh'), statusAssessed: t('statusAssessed'), statusNotAssessed: t('statusNotAssessed'), employeesInScope: t('employeesInScope'), approvedGrid: t('approvedGrid'), highHighSignals: t('highHighSignals'), assessedKeyEmployees: t('assessedKeyEmployees'), inSelection: t('inSelection'), employeesTitle: t('employeesTitle'), employeesDescription: t('employeesDescription'), keyRolesTitle: t('keyRolesTitle'), keyRolesDescription: t('keyRolesDescription'), developmentTitle: t('developmentTitle'), developmentDescription: t('developmentDescription'), overviewTitle: t('overviewTitle'), overviewDescription: t('overviewDescription'), noEmployees: t('noEmployees'), noEmployeesDescription: t('noEmployeesDescription'), noSelectedEmployee: t('noSelectedEmployee'), selectEmployee: t('selectEmployee'), detailTitle: t('detailTitle'), employeeNumber: t('employeeNumber'), department: t('department'), notAssessed: t('notAssessed'), approvedSignal: t('approvedSignal'), noApprovedSignal: t('noApprovedSignal'), campaign: t('campaign'), closedOn: t('closedOn'), movement: t('movement'), movementUp: t('movementUp'), movementDown: t('movementDown'), movementStable: t('movementStable'), movementNew: t('movementNew'), performance: t('performance'), potential: t('potential'), grid: t('grid'), skills: t('skills'), skillsDescription: t('skillsDescription'), noSkills: t('noSkills'), jobProfile: t('jobProfile'), jobProfileDescription: t('jobProfileDescription'), noJobProfile: t('noJobProfile'), skillGaps: t('skillGaps'), noSkillGaps: t('noSkillGaps'), developmentPlans: t('developmentPlans'), noDevelopmentPlans: t('noDevelopmentPlans'), appraisal: t('appraisal'), noAppraisal: t('noAppraisal'), openSource: t('openSource'), openEmployee: t('openEmployee'), openGrid: t('openGrid'), openSkills: t('openSkills'), openRoleExplorer: t('openRoleExplorer'), openComparison: t('openComparison'), openDevelopment: t('openDevelopment'), openAppraisal: t('openAppraisal'), unavailable: t('unavailable'), loading: t('loading'), loadFailed: t('loadFailed'), retry: t('retry'), readOnly: t('readOnly'), criticality: t('criticality'), saved: t('saved'), saveFailed: t('saveFailed'), saving: t('saving'), tags: t('tags'), noTags: t('noTags'), noTagsAvailable: t('noTagsAvailable'), pagination: t('pagination'), previous: t('previous'), next: t('next'), rolesPageOnly: t('rolesPageOnly'), roleEmployees: t('roleEmployees'), noRoleData: t('noRoleData')
  } as const

  return <PageShell className="py-6 lg:py-8" width="wide">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/workforce"><ArrowLeft aria-hidden="true" className="size-4" />{t('backToWorkforce')}</Link>
    <p className="eyebrow mt-5 text-primary">{t('eyebrow')}</p>
    <PageHeader actions={<Link className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/settings/talent?area=star-performer-tags"><Tags aria-hidden="true" className="size-4" />{t('manageTags')}</Link>} className="mt-2" description={t('subtitle')} title={t('title')} />
    <div className="mt-8"><StarPerformersWorkspace canViewEmployees={canViewEmployees} canWrite={canWrite} initial={initial} initialQuery={query} labels={labels} /></div>
  </PageShell>
}
