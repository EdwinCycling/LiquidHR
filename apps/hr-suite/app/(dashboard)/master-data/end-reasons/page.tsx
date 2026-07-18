import { redirect } from 'next/navigation'
import { EndReasonManager } from '@/components/master-data/end-reason-manager'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listEndReasons } from '@/lib/master-data/end-reasons'
import { getTranslator } from '@/lib/i18n/server'
export default async function EndReasonsPage() { try { await requirePermission('settings:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error } const [reasons, t] = await Promise.all([listEndReasons(), getTranslator('masterData')]); return <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold">{t('endReasonsTitle')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('endReasonsSubtitle')}</p><div className="mt-7"><EndReasonManager reasons={reasons} labels={{ active: t('active'), inactive: t('inactive'), toggle: t('toggle'), delete: t('delete'), inUse: t('inUse') }} /></div></main> }
