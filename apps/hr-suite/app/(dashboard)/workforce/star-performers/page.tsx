import Link from 'next/link'
import { ArrowLeft, Tags } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { starPerformerQuerySchema } from '@/lib/star-performers/schemas'
import { listStarPerformerWorkspace } from '@/lib/star-performers/service'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StarPerformerManager } from '@/components/settings/star-performer-manager'

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
  const query = starPerformerQuerySchema.parse({ level: rawQuery.level, q: rawQuery.q, jobId: rawQuery.jobId, jobGroupId: rawQuery.jobGroupId, tagId: rawQuery.tagId, minStars: rawQuery.minStars })
  const [workspace, t] = await Promise.all([listStarPerformerWorkspace(), getTranslator('starPerformers')])

  return <PageShell className="py-6 lg:py-8" width="wide">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/workforce"><ArrowLeft aria-hidden="true" className="size-4" />{t('backToWorkforce')}</Link>
    <p className="eyebrow mt-5 text-primary">{t('eyebrow')}</p>
    <PageHeader actions={<Link className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/workforce/star-performer-tags"><Tags aria-hidden="true" className="size-4" />{t('manageTags')}</Link>} className="mt-2" description={t('subtitle')} title={t('title')} />
    <div className="mt-8"><StarPerformerManager canViewEmployees={canViewEmployees} canWrite={canWrite} labels={{ all: t('all'), currentContext: t('currentContext'), department: t('department'), employeeNumber: t('employeeNumber'), emptyDescription: t('emptyDescription'), emptyTitle: t('emptyTitle'), filtersTitle: t('filtersTitle'), job: t('job'), jobGroup: t('jobGroup'), levelJob: t('levelJob'), levelJobGroup: t('levelJobGroup'), minStars: t('minStars'), moreTags: t('moreTags'), noResults: t('noResults'), noTagsAvailable: t('noTagsAvailable'), noTagsSelected: t('noTagsSelected'), notRatedYet: t('notRatedYet'), openEmployee: t('openEmployee'), readOnly: t('readOnly'), saved: t('saved'), saveFailed: t('saveFailed'), saving: t('saving'), search: t('search'), searchPlaceholder: t('searchPlaceholder'), selectJob: t('selectJob'), selectJobGroup: t('selectJobGroup'), stars: t('stars'), summaryAverage: t('summaryAverage'), summaryEmployees: t('summaryEmployees'), summaryRated: t('summaryRated'), summaryTags: t('summaryTags'), tagFilter: t('tagFilter'), tags: t('tags'), toggleTags: t('toggleTags'), workEmail: t('workEmail') }} query={query} workspace={workspace} /></div>
  </PageShell>
}
