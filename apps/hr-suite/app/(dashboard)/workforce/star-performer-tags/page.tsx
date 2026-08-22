import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listStarPerformerTagCatalog } from '@/lib/star-performers/service'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StarPerformerTagManager } from '@/components/settings/star-performer-tag-manager'

export default async function StarPerformerTagsPage() {
  let canWrite = false
  try {
    const authContext = await requirePermission('star-performer:read')
    canWrite = authContext.permissions.includes('star-performer:write')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [tags, t] = await Promise.all([listStarPerformerTagCatalog(), getTranslator('starPerformers')])
  return <PageShell className="py-6 lg:py-8" width="standard">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/workforce"><ArrowLeft aria-hidden="true" className="size-4" />{t('backToWorkforce')}</Link>
    <p className="eyebrow mt-5 text-primary">{t('tagsEyebrow')}</p>
    <PageHeader className="mt-2" description={t('tagsSubtitle')} title={t('tagsTitle')} />
    <div className="mt-8"><StarPerformerTagManager canWrite={canWrite} initialTags={tags} labels={{ activate: t('activate'), cancel: t('cancel'), close: t('close'), createTag: t('createTag'), deactivate: t('deactivate'), deactivateConfirm: t('deactivateConfirm'), deactivateDescription: t('deactivateDescription'), deactivateTitle: t('deactivateTitle'), discardCancel: t('discardCancel'), discardConfirm: t('discardConfirm'), discardDescription: t('discardDescription'), discardTitle: t('discardTitle'), editTag: t('editTag'), inactive: t('inactive'), moreActions: t('moreActions'), newTag: t('newTag'), saving: t('saving'), tagActive: t('tagActive'), tagEmpty: t('tagEmpty'), tagListTitle: t('tagListTitle'), tagManagerCardTitle: t('tagManagerCardTitle'), tagName: t('tagName'), tagSaved: t('tagSaved'), tagSaveFailed: t('tagSaveFailed'), tagSearchPlaceholder: t('tagSearchPlaceholder'), updateTag: t('updateTag'), usageCount: t('usageCount'), writeRequired: t('writeRequired') }} /></div>
  </PageShell>
}
