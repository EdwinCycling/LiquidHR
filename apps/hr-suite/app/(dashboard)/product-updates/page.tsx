import Link from 'next/link'
import { ProductUpdatesPage } from '@/components/product-updates/product-updates-page'
import type { ProductUpdateSurfaceLabels } from '@/components/product-updates/product-update-surfaces'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getProductUpdateDashboardData } from '@/lib/product-updates/service'

export default async function ProductUpdatesRoute() {
  const [t, locale, auth, data] = await Promise.all([getTranslator('productUpdates'), getLocale(), requireAuthContext(), getProductUpdateDashboardData()])
  const labels: ProductUpdateSurfaceLabels = {
    title: t('title'), open: t('open'), close: t('close'), kindNewFeature: t('kindNewFeature'), kindImprovement: t('kindImprovement'), giftWindow: t('giftWindow'), loginPopup: t('loginPopup'), topBanner: t('topBanner'), dateFrom: t('dateFrom'), dateUntil: t('dateUntil'), more: t('more'), manage: t('manage'), seen: t('seen'),
  }
  return <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Liquid HR</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{t('title')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t('subtitle')}</p></div>{auth.permissions.includes('product-updates:write') || auth.permissions.includes('product-updates:global-write') ? <Link className="button-secondary" href="/settings/product-updates">{t('manage')}</Link> : null}</div><ProductUpdatesPage initial={data.updates} labels={labels} locale={locale} /></main>
}
