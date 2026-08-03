import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentTeamMatrix } from '@/components/talent/talent-team-matrix'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentTeamMatrix } from '@/lib/talent/team-service'

export default async function TalentTeamSettingsPage() {
  try { await requirePermission('talent-team:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [initial, t] = await Promise.all([listTalentTeamMatrix(), getTranslator('talent')])
  const labels = { title: t('teamMatrixTitle'), subtitle: t('teamMatrixHrSubtitle'), search: t('teamMatrixSearch'), searchPlaceholder: t('teamMatrixSearchPlaceholder'), type: t('teamMatrixType'), status: t('teamMatrixStatus'), source: t('teamMatrixSource'), all: t('teamMatrixAll'), noResults: t('teamMatrixNoResults'), empty: t('teamMatrixEmpty'), employee: t('teamMatrixEmployee'), job: t('teamMatrixJob'), capabilities: t('teamMatrixCapabilities'), noCapabilities: t('teamMatrixNoCapabilities'), draft: t('personalRecordStatusDraft'), released: t('personalRecordStatusReleased'), expired: t('personalRecordStatusExpired'), self: t('personalRecordSourceSelf'), hr: t('personalRecordSourceHr'), manager: t('personalRecordSourceManager'), imported: t('personalRecordSourceImported'), scope: t('teamMatrixScope'), aggregateDisabled: t('teamMatrixAggregateDisabled') }
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/settings/talent" backLabel={t('backToTalent')} title={t('teamMatrixTitle')} subtitle={t('teamMatrixHrSubtitle')} /><TalentTeamMatrix initial={initial} labels={labels} /></section>
}
