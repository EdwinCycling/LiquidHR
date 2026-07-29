import { JobCatalogManager } from '@/components/master-data/job-catalog-manager'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { getTranslator } from '@/lib/i18n/server'
import { listJobCatalog } from '@/lib/master-data/service'

export default async function JobsPage() {
  const [catalog, t, settings] = await Promise.all([listJobCatalog(), getTranslator('masterData'), getTranslator('settings')])
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
    <AdminSettingsPageHeader backLabel={settings('admin.backToOverview')} eyebrow={t('eyebrow')} subtitle={t('jobsSubtitle')} title={t('jobsTitle')} />
    <JobCatalogManager groups={catalog.groups} jobs={catalog.jobs} labels={{
      groups: t('jobGroups'), jobs: t('jobs'), code: t('code'), name: t('name'), description: t('description'),
      relatedJobs: t('relatedJobs'), selectGroup: t('selectGroup'), noGroupSelected: t('noGroupSelected'), createGroup: t('createGroup'),
      createJob: t('createJob'), edit: t('edit'), save: t('save'), delete: t('delete'), deleteConfirm: t('deleteConfirm'), inUse: t('inUse'),
      saving: t('saving'), failed: t('failed'), empty: t('empty'), active: t('active'), inactive: t('inactive'), activate: t('activate'),
      deactivate: t('deactivate'), groupSelection: t('groupSelection'), groupRequired: t('groupRequired'), search: t('search'), sortBy: t('sortBy'), sortCode: t('sortCode'), sortName: t('sortName'), sortStatus: t('sortStatus'), allGroups: t('allGroups'), addNew: t('addNew'), cancel: t('cancel'), close: t('close'), create: t('create'), editGroup: t('editGroup'), editJob: t('editJob'), confirmDeleteTitle: t('confirmDeleteTitle'), confirmDeleteBody: t('confirmDeleteBody'), confirmDelete: t('confirmDelete'), noResults: t('noResults'), listDescription: t('listDescription'), filters: t('filters'), graphTitle: t('graphTitle'), graphSubtitle: t('graphSubtitle'), jobsInGroup: t('jobsInGroup'), noJobsInGroup: t('noJobsInGroup'),
    }} />
  </section>
}
