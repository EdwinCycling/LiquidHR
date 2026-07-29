import { redirect } from 'next/navigation'
import { EndReasonManager } from '@/components/master-data/end-reason-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listEndReasonCountries, listEndReasons } from '@/lib/master-data/end-reasons'
import { getTranslator } from '@/lib/i18n/server'
export default async function EndReasonsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  try { await requirePermission('settings:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const requestedCountry = (await searchParams).country?.toUpperCase()
  const countryCode = requestedCountry && /^[A-Z]{2}$/.test(requestedCountry) ? requestedCountry : 'NL'
  const [reasons, countries, t, settings] = await Promise.all([listEndReasons(countryCode), listEndReasonCountries(), getTranslator('masterData'), getTranslator('settings')])
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('endReasonsSubtitle')} title={t('endReasonsTitle')} /><EndReasonManager countries={countries} countryCode={countryCode} reasons={reasons} labels={{ country: t('endReasonsCountry'), addCountry: t('endReasonsAddCountry'), code: t('code'), nameNl: t('catalog.nameNl'), nameEn: t('catalog.nameEn'), add: t('endReasonsAdd'), edit: t('edit'), save: t('save'), cancel: t('cancel'), active: t('active'), inactive: t('inactive'), activate: t('activate'), deactivate: t('deactivate'), delete: t('delete'), inUse: t('inUse'), failed: t('failed'), emptyCountry: t('endReasonsEmptyCountry'), fallbackReason: t('endReasonsFallback') }} /></main>
}
