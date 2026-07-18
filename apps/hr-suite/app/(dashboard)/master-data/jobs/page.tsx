import Link from 'next/link'
import { JobCatalogManager } from '@/components/master-data/job-catalog-manager'
import { getTranslator } from '@/lib/i18n/server'
import { listJobCatalog } from '@/lib/master-data/service'

export default async function JobsPage() {
  const [catalog, t] = await Promise.all([listJobCatalog(), getTranslator('masterData')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <header className="mb-7 border-b pb-7"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('title')}</h1><p className="mt-3 max-w-3xl text-sm text-muted-foreground">{t('subtitle')}</p><nav className="mt-5 flex gap-2"><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/master-data/jobs">{t('jobs')}</Link><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/master-data/salary-scales">{t('salaryScales')}</Link></nav></header>
    <JobCatalogManager groups={catalog.groups} jobs={catalog.jobs} labels={{ groups: t('jobGroups'), jobs: t('jobs'), code: t('code'), name: t('name'), description: t('description'), group: t('jobGroup'), validFrom: t('validFrom'), validUntil: t('validUntil'), createGroup: t('createGroup'), createJob: t('createJob'), empty: t('empty'), saving: t('saving'), failed: t('failed'), active: t('active') }} />
  </section>
}
