import Link from 'next/link'
import { BarChart3, Library, Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { ResearchSettingsWorkspace } from '@/components/research/research-settings-workspace'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { listResearchSettingsData } from '@/lib/research/admin-service'
import { listResearchMonitor } from '@/lib/research/results-service'

export default async function ResearchSettingsPage() {
  let data
  let campaigns
  try { [data, campaigns] = await Promise.all([listResearchSettingsData(), listResearchMonitor()]) } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [t, locale] = await Promise.all([getTranslator('research'), getLocale()])
  return <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><AdminSettingsPageHeader backLabel={t('settings.back')} eyebrow={t('eyebrow')} subtitle={t('settings.subtitle')} title={t('settings.title')} actions={<div className="flex flex-wrap gap-3">{data.modules.surveys ? <Link className={buttonClasses()} href="/settings/research/surveys/new"><Plus aria-hidden="true" size={16} />{t('settings.newSurvey')}</Link> : null}{data.modules.enps ? <Link className={buttonClasses()} href="/settings/research/enps/new"><Plus aria-hidden="true" size={16} />{t('settings.newEnps')}</Link> : null}<Link className={buttonClasses({ variant: 'secondary' })} href="/settings/research/question-bank"><Library aria-hidden="true" size={16} />{t('settings.manageQuestionBank')}</Link><Link className={buttonClasses({ variant: 'secondary' })} href="/research/monitor"><BarChart3 aria-hidden="true" size={16} />{t('hub.monitor')}</Link></div>} />{!data.modules.surveys || !data.modules.enps ? <Surface className="mb-5 p-4 text-sm text-muted-foreground" variant="subtle">{t('settings.moduleDisabled')}</Surface> : null}<ResearchSettingsWorkspace campaigns={campaigns} labels={{ search: t('settings.search'), searchPlaceholder: t('settings.searchPlaceholder'), allTypes: t('settings.allTypes'), allStatuses: t('settings.allStatuses'), sortNewest: t('settings.sortNewest'), sortStart: t('settings.sortStart'), empty: t('settings.empty'), invited: t('settings.invited'), responses: t('settings.responses'), activate: t('settings.activate'), close: t('settings.close'), remind: t('settings.remind'), editDraft: t('settings.editDraft'), working: t('settings.working'), actionFailed: t('settings.actionFailed'), actionDone: t('settings.actionDone'), openMonitor: t('settings.openMonitor'), survey: t('hub.survey'), enps: t('hub.enps'), statuses: { DRAFT: t('status.DRAFT'), ACTIVE: t('status.ACTIVE'), CLOSED: t('status.CLOSED') } }} locale={locale} /></main>
}
