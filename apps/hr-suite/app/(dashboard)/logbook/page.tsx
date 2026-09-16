import { redirect } from 'next/navigation'
import { LogbookPage, type LogbookPageLabels } from '@/components/logbook/logbook-page'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listPersonalLogbookEntries } from '@/lib/logbook/service'

export default async function LogbookRoute({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  let context
  try {
    context = await requirePermission('logbook:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [entries, t, locale, query] = await Promise.all([listPersonalLogbookEntries(), getTranslator('logbook'), getLocale(), searchParams])
  const labels: LogbookPageLabels = {
    title: t('title'),
    description: t('description'),
    newEntry: t('newEntry'),
    editEntry: t('editEntry'),
    titleLabel: t('titleLabel'),
    descriptionLabel: t('descriptionLabel'),
    save: t('save'),
    saving: t('saving'),
    cancel: t('cancel'),
    close: t('close'),
    delete: t('delete'),
    deleteTitle: t('deleteTitle'),
    deleteDescription: t('deleteDescription'),
    confirmDelete: t('confirmDelete'),
    empty: t('empty'),
    sourceManual: t('sourceManual'),
    sourceAi: t('sourceAi'),
    createdAt: t('createdAt'),
    context: t('context'),
    saved: t('saved'),
    failed: t('failed'),
    deleted: t('deleted'),
    discardTitle: t('discardTitle'),
    discardDescription: t('discardDescription'),
    discardConfirm: t('discardConfirm'),
    discardCancel: t('discardCancel'),
    backToStart: t('backToStart'),
  }
  return <LogbookPage canDelete={context.permissions.includes('logbook:delete')} canWrite={context.permissions.includes('logbook:write')} initial={entries} initialOpen={query.new === '1'} labels={labels} locale={locale} />
}
