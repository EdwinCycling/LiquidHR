import Link from 'next/link'
import { JobCatalogManager } from '@/components/master-data/job-catalog-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { listJobCatalog } from '@/lib/master-data/service'

export default async function JobsPage() {
  const [catalog, t, settings] = await Promise.all([listJobCatalog(), getTranslator('masterData'), getTranslator('settings')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <AdminSettingsPageHeader actions={<nav className="flex gap-2"><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/master-data/jobs">{t('jobs')}</Link><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/master-data/salary-scales">{t('salaryScales')}</Link></nav>} backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('subtitle')} title={t('title')} />
    <JobCatalogManager groups={catalog.groups} jobs={catalog.jobs} labels={{ groups: t('jobGroups'), jobs: t('jobs'), code: t('code'), name: t('name'), description: t('description'), group: t('jobGroup'), validFrom: t('validFrom'), validUntil: t('validUntil'), createGroup: t('createGroup'), createJob: t('createJob'), empty: t('empty'), saving: t('saving'), failed: t('failed'), active: t('active') }} />
  </section>
}
