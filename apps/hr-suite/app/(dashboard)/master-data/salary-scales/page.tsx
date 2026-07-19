import Link from 'next/link'
import { SalaryScaleManager } from '@/components/master-data/salary-scale-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { listSalaryStructures } from '@/lib/master-data/service'

export default async function SalaryScalesPage() {
  const [structures, t, settings] = await Promise.all([listSalaryStructures(), getTranslator('masterData'), getTranslator('settings')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <AdminSettingsPageHeader actions={<nav className="flex gap-2"><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/master-data/jobs">{t('jobs')}</Link><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/master-data/salary-scales">{t('salaryScales')}</Link></nav>} backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('salarySubtitle')} title={t('title')} />
    <SalaryScaleManager {...structures} labels={{ scales: t('salaryScales'), revisions: t('revisions'), code: t('code'), name: t('name'), description: t('description'), validFrom: t('validFrom'), validUntil: t('validUntil'), createScale: t('createScale'), publishRevision: t('publishRevision'), steps: t('steps'), stepCode: t('stepCode'), stepName: t('stepName'), amount: t('amount'), addStep: t('addStep'), removeStep: t('removeStep'), saving: t('saving'), failed: t('failed'), empty: t('empty'), amountsRestricted: t('amountsRestricted') }} />
  </section>
}
