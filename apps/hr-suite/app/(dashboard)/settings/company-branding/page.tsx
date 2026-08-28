import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { CompanyBrandingPanel } from '@/components/settings/company-branding-panel'
import { getTranslator } from '@/lib/i18n/server'
import { getHrGroupBrandingForSettings } from '@/lib/settings/branding-service'
import { PageShell } from '@/components/layout/page-shell'

export default async function CompanyBrandingPage() {
  const [branding, t] = await Promise.all([getHrGroupBrandingForSettings(), getTranslator('settings')])
  return <PageShell className="py-8 lg:py-10"><AdminSettingsPageHeader backLabel={t('admin.backToOverview')} eyebrow={t('admin.eyebrow')} subtitle={t('companyBranding.subtitle')} title={t('companyBranding.title')} /><CompanyBrandingPanel initialBranding={branding} labels={{ title: t('companyBranding.colorsTitle'), subtitle: t('companyBranding.colorsSubtitle'), colorsTitle: t('companyBranding.colorsTitle'), colorsHelp: t('companyBranding.colorsHelp'), primaryColor: t('companyBranding.primaryColor'), accentColor: t('companyBranding.accentColor'), sidebarColor: t('companyBranding.sidebarColor'), logoTitle: t('companyBranding.logoTitle'), logoHelp: t('companyBranding.logoHelp'), upload: t('companyBranding.upload'), removeLogo: t('companyBranding.removeLogo'), save: t('companyBranding.save'), saving: t('companyBranding.saving'), saved: t('companyBranding.saved'), failed: t('companyBranding.failed'), invalid: t('companyBranding.invalid') }} /></PageShell>
}
