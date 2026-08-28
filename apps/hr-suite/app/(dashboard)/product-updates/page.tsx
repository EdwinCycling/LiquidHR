import Link from 'next/link'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { buttonClasses } from '@/components/ui/button'
import { ProductUpdatesPage } from '@/components/product-updates/product-updates-page'
import type { ProductUpdateSurfaceLabels } from '@/components/product-updates/product-update-surfaces'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getProductUpdateDashboardData } from '@/lib/product-updates/service'

export default async function ProductUpdatesRoute() {
  const [t, locale, auth, data] = await Promise.all([getTranslator('productUpdates'), getLocale(), requireAuthContext(), getProductUpdateDashboardData()])
  const labels: ProductUpdateSurfaceLabels & { search: string } = {
    title: t('title'), subtitle: t('subtitle'), open: t('open'), close: t('close'), kindNewFeature: t('kindNewFeature'), kindImprovement: t('kindImprovement'), giftWindow: t('giftWindow'), loginPopup: t('loginPopup'), topBanner: t('topBanner'), dateFrom: t('dateFrom'), dateUntil: t('dateUntil'), more: t('more'), manage: t('manage'), seen: t('seen'), empty: t('empty'), unreadCount: t('unreadCount'), search: t('search'),
  }
  return <PageShell className="py-7 lg:py-10" width="reading"><PageHeader actions={auth.permissions.includes('product-updates:write') || auth.permissions.includes('product-updates:global-write') ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/product-updates">{t('manage')}</Link> : undefined} description={t('subtitle')} title={t('title')} /><ProductUpdatesPage initial={data.updates} labels={labels} locale={locale} /></PageShell>
}
