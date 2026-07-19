import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { starPerformerQuerySchema } from '@/lib/star-performers/schemas'
import { listStarPerformerWorkspace } from '@/lib/star-performers/service'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { StarPerformerManager } from '@/components/settings/star-performer-manager'

export default async function StarPerformersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  try {
    await requirePermission('star-performer:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const rawQuery = await searchParams
  const query = starPerformerQuerySchema.parse({
    level: rawQuery.level,
    q: rawQuery.q,
    jobId: rawQuery.jobId,
    jobGroupId: rawQuery.jobGroupId,
    tagId: rawQuery.tagId,
    minStars: rawQuery.minStars,
  })

  const [workspace, t, settings] = await Promise.all([
    listStarPerformerWorkspace(),
    getTranslator('starPerformers'),
    getTranslator('settings'),
  ])

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <AdminSettingsPageHeader
        backLabel={settings('admin.backToOverview')}
        eyebrow={t('eyebrow')}
        subtitle={t('subtitle')}
        title={t('title')}
      />

      <StarPerformerManager
        labels={{
          filtersTitle: t('filtersTitle'),
          level: t('level'),
          levelJob: t('levelJob'),
          levelJobGroup: t('levelJobGroup'),
          jobGroup: t('jobGroup'),
          job: t('job'),
          search: t('search'),
          searchPlaceholder: t('searchPlaceholder'),
          tagFilter: t('tagFilter'),
          minStars: t('minStars'),
          all: t('all'),
          selectJobGroup: t('selectJobGroup'),
          selectJob: t('selectJob'),
          manageTags: t('manageTags'),
          summaryEmployees: t('summaryEmployees'),
          summaryRated: t('summaryRated'),
          summaryAverage: t('summaryAverage'),
          summaryTags: t('summaryTags'),
          emptyTitle: t('emptyTitle'),
          emptyDescription: t('emptyDescription'),
          noResults: t('noResults'),
          stars: t('stars'),
          notRatedYet: t('notRatedYet'),
          tags: t('tags'),
          noTagsSelected: t('noTagsSelected'),
          lastUpdated: t('lastUpdated'),
          saveFailed: t('saveFailed'),
          saving: t('saving'),
          saved: t('saved'),
          noTagsAvailable: t('noTagsAvailable'),
          toggleTags: t('toggleTags'),
          employeeNumber: t('employeeNumber'),
          department: t('department'),
          workEmail: t('workEmail'),
          currentContext: t('currentContext'),
        }}
        query={query}
        workspace={workspace}
      />
    </section>
  )
}
