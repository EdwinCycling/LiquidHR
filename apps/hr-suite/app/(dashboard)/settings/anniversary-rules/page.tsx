import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AnniversaryRulesManager } from '@/components/settings/anniversary-rules-manager'
import { getTranslator } from '@/lib/i18n/server'
import { listAnniversaryRules } from '@/lib/settings/anniversary-rules'

export default async function AnniversaryRulesPage() {
  const [rules, t] = await Promise.all([listAnniversaryRules(), getTranslator('settings')])
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={t('admin.backToOverview')} eyebrow={t('admin.sections.hrSetup')} subtitle={t('anniversaryRules.subtitle')} title={t('anniversaryRules.title')} /><AnniversaryRulesManager labels={{ add: t('anniversaryRules.add'), years: t('anniversaryRules.years'), save: t('anniversaryRules.save'), delete: t('anniversaryRules.delete'), saved: t('anniversaryRules.saved'), failed: t('anniversaryRules.failed'), empty: t('anniversaryRules.empty') }} rules={rules} /></div>
}
