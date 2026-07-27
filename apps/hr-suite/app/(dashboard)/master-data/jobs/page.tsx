import Link from 'next/link'
import { JobCatalogManager } from '@/components/master-data/job-catalog-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { listJobCatalog } from '@/lib/master-data/service'

export default async function JobsPage() {
  const [catalog, t, settings] = await Promise.all([listJobCatalog(), getTranslator('masterData'), getTranslator('settings')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <AdminSettingsPageHeader actions={<nav className="flex gap-2"><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/master-data/jobs">{t('jobs')}</Link><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/master-data/salary-scales">{t('salaryScales')}</Link></nav>} backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('subtitle')} title={t('title')} />
    <JobCatalogManager groups={catalog.groups} jobs={catalog.jobs} labels={{
      groups: t('jobGroups'), jobs: t('jobs'), code: t('code'), name: t('name'), description: t('description'),
      relatedJobs: t('relatedJobs'), selectGroup: t('selectGroup'), noGroupSelected: t('noGroupSelected'), createGroup: t('createGroup'),
      createJob: t('createJob'), edit: t('edit'), save: t('save'), delete: t('delete'), deleteConfirm: t('deleteConfirm'), inUse: t('inUse'),
      saving: t('saving'), failed: t('failed'), empty: t('empty'), active: t('active'), inactive: t('inactive'), activate: t('activate'),
      deactivate: t('deactivate'), groupSelection: t('groupSelection'), groupRequired: t('groupRequired'), search: t('search'), sortBy: t('sortBy'), sortCode: t('sortCode'), sortName: t('sortName'), sortStatus: t('sortStatus'), allGroups: t('allGroups'), addNew: t('addNew'), cancel: t('cancel'), close: t('close'), create: t('create'), editGroup: t('editGroup'), editJob: t('editJob'), confirmDeleteTitle: t('confirmDeleteTitle'), confirmDeleteBody: t('confirmDeleteBody'), confirmDelete: t('confirmDelete'), noResults: t('noResults'), listDescription: t('listDescription'),
    }} />
  </section>
}
