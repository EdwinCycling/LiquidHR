import { redirect } from 'next/navigation'
import { EndReasonManager } from '@/components/master-data/end-reason-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listEndReasons } from '@/lib/master-data/end-reasons'
import { getTranslator } from '@/lib/i18n/server'
export default async function EndReasonsPage() { try { await requirePermission('settings:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error } const [reasons, t, settings] = await Promise.all([listEndReasons(), getTranslator('masterData'), getTranslator('settings')]); return <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('endReasonsSubtitle')} title={t('endReasonsTitle')} /><div><EndReasonManager reasons={reasons} labels={{ active: t('active'), inactive: t('inactive'), toggle: t('toggle'), delete: t('delete'), inUse: t('inUse') }} /></div></main> }
