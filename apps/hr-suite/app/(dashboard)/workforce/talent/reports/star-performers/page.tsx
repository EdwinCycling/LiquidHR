import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { StarPerformersTalentReports } from '@/components/settings/star-performers-talent-reports'
import { buttonClasses } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { Surface } from '@/components/ui/surface'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { createStarPerformersInsightLabels, createStarPerformersReportFilterLabels } from '@/lib/star-performers/presentation'
import { starPerformerWorkspaceQuerySchema } from '@/lib/star-performers/schemas'
import { getStarPerformersInsights, listStarPerformersWorkspacePage, resolveStarPerformersReadAccess } from '@/lib/star-performers/v2-service'

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function insightValue(value: string | undefined): 'top-talent' | 'key-employees' | 'skills' | 'skill-gaps' | 'development' | 'appraisal' | undefined {
  return value === 'top-talent' || value === 'key-employees' || value === 'skills' || value === 'skill-gaps' || value === 'development' || value === 'appraisal' ? value : undefined
}

export default async function StarPerformersTalentReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let readAccess
  try {
    readAccess = await resolveStarPerformersReadAccess()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const canViewEmployees = readAccess.auth.permissions.includes('employee:read')

  const rawQuery = await searchParams
  const insight = insightValue(queryValue(rawQuery.report) ?? queryValue(rawQuery.insight)) ?? 'top-talent'
  const perspective = insight === 'key-employees' ? 'key-employees' : 'top-talent'
  const query = starPerformerWorkspaceQuerySchema.parse({
    perspective,
    area: 'insights',
    insight,
    q: queryValue(rawQuery.q),
    departmentId: queryValue(rawQuery.departmentId),
    jobId: queryValue(rawQuery.jobId),
    jobGroupId: queryValue(rawQuery.jobGroupId),
    period: queryValue(rawQuery.period),
    periodFrom: queryValue(rawQuery.periodFrom),
    periodTo: queryValue(rawQuery.periodTo),
    appraisalStatus: queryValue(rawQuery.appraisalStatus),
    status: queryValue(rawQuery.status),
    page: queryValue(rawQuery.page),
    pageSize: queryValue(rawQuery.pageSize),
  })
  const [initial, initialWorkspace, talentT, starT] = await Promise.all([
    getStarPerformersInsights(query, readAccess, insight === 'development' ? { includeSkills: true, includeDevelopment: true, includeAppraisal: true } : undefined),
    listStarPerformersWorkspacePage(query, readAccess),
    getTranslator('talent'),
    getTranslator('starPerformers'),
  ])

  return <PageShell className="py-6 lg:py-8" width="wide">
    <AdminSettingsPageHeader actions={readAccess.isAdmin ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/star-performers"><ArrowUpRight aria-hidden="true" className="size-4" />{starT('title')}</Link> : undefined} backHref="/workforce/talent/reports" backLabel={talentT('reportTitle')} title={starT('insights')} subtitle={starT('insightsDescription')} />
    {insight === 'development' && <section aria-labelledby="talent-development-overview" className="my-5 space-y-3">
      <h2 id="talent-development-overview" className="text-lg font-semibold">{talentT('ins01.title')}</h2>
      <p className="text-sm text-muted-foreground">{talentT('ins01.description')}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Surface className="p-4"><h3 className="font-semibold">{talentT('ins01.plans')}</h3>{initial.development.sources.plans ? <><p className="mt-2 text-sm">{talentT('ins01.activePlans')}: {initial.development.activePlansCount}</p><p className="text-sm">{talentT('ins01.averageProgress')}: {initial.development.averageProgress === null ? '—' : `${initial.development.averageProgress}%`}</p><Link className="mt-2 inline-block text-sm text-primary underline" href="/workforce/talent/goals">{talentT('ins01.openPlans')}</Link></> : <p className="mt-2 text-sm">{talentT('ins01.unavailable')}</p>}</Surface>
        <Surface className="p-4"><h3 className="font-semibold">{talentT('ins01.skills')}</h3>{initial.skillGaps.state === 'unavailable' ? <p className="mt-2 text-sm">{talentT('ins01.unavailable')}</p> : initial.skillGaps.state === 'no-data' ? <p className="mt-2 text-sm">{talentT('ins01.noSkills')}</p> : <><p className="mt-2 text-sm">{talentT('ins01.assessed')}: {initial.skillGaps.assessedEmployees}</p><p className="text-sm">{talentT('ins01.notAssessed')}: {initial.skillGaps.rows.reduce((sum, row) => sum + row.statusCounts.NOT_ASSESSED, 0)}</p><p className="text-sm">{talentT('ins01.expiredEvidence')}: {initial.skillGaps.rows.reduce((sum, row) => sum + row.statusCounts.EXPIRED_EVIDENCE, 0)}</p></>}<Link className="mt-2 inline-block text-sm text-primary underline" href="/workforce/talent/reports/star-performers?report=skill-gaps">{talentT('ins01.openSkills')}</Link></Surface>
        <Surface className="p-4"><h3 className="font-semibold">{talentT('ins01.conversations')}</h3>{initial.appraisal.sources.items ? <><p className="mt-2 text-sm">{talentT('ins01.noConversation')}: {initial.appraisal.noConversationEmployees}</p><p className="text-sm">{talentT('ins01.overdueFollowUp')}: {initial.appraisal.overdueFollowUpCount}</p></> : <p className="mt-2 text-sm">{talentT('ins01.unavailable')}</p>}<Link className="mt-2 inline-block text-sm text-primary underline" href="/workforce/talent/reports/star-performers?report=appraisal">{talentT('ins01.openConversations')}</Link></Surface>
      </div>
      <p className="text-xs text-muted-foreground">{talentT('ins01.limits')}</p>
    </section>}
    <StarPerformersTalentReports canViewEmployees={canViewEmployees} filterLabels={createStarPerformersReportFilterLabels(starT)} initial={initial} initialQuery={query} initialWorkspace={initialWorkspace} insightLabels={createStarPerformersInsightLabels(starT)} />
  </PageShell>
}
