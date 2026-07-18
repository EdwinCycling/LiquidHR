import Link from 'next/link'
import { SalaryScaleManager } from '@/components/master-data/salary-scale-manager'
import { getTranslator } from '@/lib/i18n/server'
import { listSalaryStructures } from '@/lib/master-data/service'

export default async function SalaryScalesPage() {
  const [structures, t] = await Promise.all([listSalaryStructures(), getTranslator('masterData')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <header className="mb-7 border-b pb-7"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('title')}</h1><p className="mt-3 max-w-3xl text-sm text-muted-foreground">{t('salarySubtitle')}</p><nav className="mt-5 flex gap-2"><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/master-data/jobs">{t('jobs')}</Link><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/master-data/salary-scales">{t('salaryScales')}</Link></nav></header>
    <SalaryScaleManager {...structures} labels={{ scales: t('salaryScales'), revisions: t('revisions'), code: t('code'), name: t('name'), description: t('description'), validFrom: t('validFrom'), validUntil: t('validUntil'), createScale: t('createScale'), publishRevision: t('publishRevision'), steps: t('steps'), stepCode: t('stepCode'), stepName: t('stepName'), amount: t('amount'), addStep: t('addStep'), removeStep: t('removeStep'), saving: t('saving'), failed: t('failed'), empty: t('empty'), amountsRestricted: t('amountsRestricted') }} />
  </section>
}
