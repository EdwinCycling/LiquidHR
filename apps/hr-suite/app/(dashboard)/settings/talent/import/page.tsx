import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentImportWorkspace } from '@/components/talent/talent-import-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'

export default async function TalentImportSettingsPage() {
  try { await requirePermission('talent-import:manage') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const t = await getTranslator('talent')
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/settings/talent" backLabel={t('backToTalent')} title={t('importTitle')} subtitle={t('importSubtitle')} /><TalentImportWorkspace labels={{ title: t('importTitle'), subtitle: t('importSubtitle'), filename: t('importFilename'), chooseFile: t('importChooseFile'), preview: t('importPreview'), commit: t('importCommit'), rollback: t('importRollback'), invalid: t('importInvalid'), valid: t('importValid'), applied: t('importApplied'), rolledBack: t('importRolledBack'), empty: t('importEmpty'), failed: t('importFailed'), committed: t('importCommitted'), rolledBackMessage: t('importRolledBackMessage'), template: t('importTemplate') }} /></section>
}
