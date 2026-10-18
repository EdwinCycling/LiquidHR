import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { StarPerformersTalentReports } from '@/components/settings/star-performers-talent-reports'
import { buttonClasses } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { createStarPerformersInsightLabels, createStarPerformersReportFilterLabels } from '@/lib/star-performers/presentation'
import { starPerformerWorkspaceQuerySchema } from '@/lib/star-performers/schemas'
import { getStarPerformersInsights, listStarPerformersWorkspacePage, resolveStarPerformersReadAccess } from '@/lib/star-performers/v2-service'

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function insightValue(value: string | undefined): 'top-talent' | 'key-employees' | 'skills' | 'skill-gaps' | 'development' | undefined {
  return value === 'top-talent' || value === 'key-employees' || value === 'skills' || value === 'skill-gaps' || value === 'development' ? value : undefined
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
    status: queryValue(rawQuery.status),
    page: queryValue(rawQuery.page),
    pageSize: queryValue(rawQuery.pageSize),
  })
  const [initial, initialWorkspace, talentT, starT] = await Promise.all([
    getStarPerformersInsights(query, readAccess),
    listStarPerformersWorkspacePage(query, readAccess),
    getTranslator('talent'),
    getTranslator('starPerformers'),
  ])

  return <PageShell className="py-6 lg:py-8" width="wide">
    <AdminSettingsPageHeader actions={readAccess.isAdmin ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/star-performers"><ArrowUpRight aria-hidden="true" className="size-4" />{starT('title')}</Link> : undefined} backHref="/workforce/talent/reports" backLabel={talentT('reportTitle')} title={starT('insights')} subtitle={starT('insightsDescription')} />
    <StarPerformersTalentReports canViewEmployees={canViewEmployees} filterLabels={createStarPerformersReportFilterLabels(starT)} initial={initial} initialQuery={query} initialWorkspace={initialWorkspace} insightLabels={createStarPerformersInsightLabels(starT)} />
  </PageShell>
}
