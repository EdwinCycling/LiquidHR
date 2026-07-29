import { SalaryScaleManager } from '@/components/master-data/salary-scale-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { listSalaryStructures } from '@/lib/master-data/service'

export default async function SalaryScalesPage() {
  const [structures, t, settings] = await Promise.all([listSalaryStructures(), getTranslator('masterData'), getTranslator('settings')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('salarySubtitle')} title={t('salaryScalesTitle')} />
    <SalaryScaleManager {...structures} labels={{ scales: t('salaryScales'), revisions: t('revisions'), code: t('code'), name: t('name'), description: t('description'), validFrom: t('validFrom'), validUntil: t('validUntil'), createScale: t('createScale'), publishRevision: t('publishRevision'), steps: t('steps'), stepCode: t('stepCode'), stepName: t('stepName'), amount: t('amount'), addStep: t('addStep'), removeStep: t('removeStep'), saving: t('saving'), failed: t('failed'), empty: t('empty'), amountsRestricted: t('amountsRestricted') }} />
  </section>
}
