import { redirect } from 'next/navigation'
import type { Json } from '@scope/db'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TemplateCatalog } from '@/components/journeys/template-catalog'
import { AuthorizationError, requireAnyPermission, requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { journeyTemplates } from '@/lib/journeys'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { requireTenantModule } from '@/lib/modules/module-service'

async function allowed(permission: string): Promise<boolean> {
  try { await requirePermission(permission); return true }
  catch (error) { if (error instanceof AuthorizationError) return false; throw error }
}

export default async function JourneyTemplateCatalogPage() {
  try {
    await requireAnyPermission(['journey-template:read', 'journey-template:write', 'journey-template:publish'])
    await requireTenantModule('JOURNEYS')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    redirect('/settings/modules')
  }
  const [templates, labels, locale, canWrite] = await Promise.all([journeyTemplates.listTemplates(), getJourneyLabels(), getLocale(), allowed('journey-template:write')])
  const localized = (value: Json): string => typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value[locale] === 'string' ? value[locale] : ''
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={labels.backToSettings} eyebrow={labels.eyebrow} subtitle={labels.catalogSubtitle} title={labels.catalogTitle} /><TemplateCatalog canWrite={canWrite} items={templates.map((template) => ({ ...template, name: localized(template.name), description: localized(template.description) }))} labels={labels} locale={locale} /></div>
}
