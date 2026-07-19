import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listStarPerformerTagCatalog } from '@/lib/star-performers/service'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { StarPerformerTagManager } from '@/components/settings/star-performer-tag-manager'

export default async function StarPerformerTagsPage() {
  try {
    await requirePermission('star-performer:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [tags, t, settings] = await Promise.all([
    listStarPerformerTagCatalog(),
    getTranslator('starPerformers'),
    getTranslator('settings'),
  ])

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <AdminSettingsPageHeader
        backLabel={settings('admin.backToOverview')}
        eyebrow={t('tagsEyebrow')}
        subtitle={t('tagsSubtitle')}
        title={t('tagsTitle')}
      />

      <StarPerformerTagManager
        initialTags={tags}
        labels={{
          tagManagerCardTitle: t('tagManagerCardTitle'),
          tagName: t('tagName'),
          tagActive: t('tagActive'),
          inactive: t('inactive'),
          createTag: t('createTag'),
          updateTag: t('updateTag'),
          editTag: t('editTag'),
          newTag: t('newTag'),
          usageCount: t('usageCount'),
          tagListTitle: t('tagListTitle'),
          tagSearchPlaceholder: t('tagSearchPlaceholder'),
          tagEmpty: t('tagEmpty'),
          tagSaved: t('tagSaved'),
          tagSaveFailed: t('tagSaveFailed'),
        }}
      />
    </section>
  )
}
