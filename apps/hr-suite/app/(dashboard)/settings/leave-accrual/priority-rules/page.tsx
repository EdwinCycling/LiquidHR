import { redirect } from 'next/navigation'
import { PriorityRulesPage } from '@/components/leave/priority-rules-page'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listLeaveCatalog } from '@/lib/leave/leave-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function LeavePriorityRulesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  try {
    await requirePermission('leave:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [{ year: yearParam }, catalog, pageLabels, settingsLabels] = await Promise.all([searchParams, listLeaveCatalog(), getTranslator('leave'), getTranslator('settings')])
  const parsedYear = yearParam ? Number(yearParam) : new Date().getFullYear()
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : new Date().getFullYear()
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={settingsLabels('admin.backToOverview')} backHref="/settings/leave-accrual" eyebrow={settingsLabels('admin.eyebrow')} title={pageLabels('priority.listTitle')} subtitle={pageLabels('priority.listSubtitle')} /><PriorityRulesPage initial={catalog} initialYear={year} labels={{ add: pageLabels('priority.add'), year: pageLabels('priority.year'), columns: { name: pageLabels('priority.columns.name'), types: pageLabels('priority.columns.types'), status: pageLabels('priority.columns.status') }, active: pageLabels('priority.active'), inactive: pageLabels('priority.inactive'), empty: pageLabels('priority.empty'), emptyDescription: pageLabels('priority.emptyDescription'), back: settingsLabels('admin.backToOverview'), profile: pageLabels('priority.profile'), types: pageLabels('priority.types'), edit: pageLabels('priority.edit'), showInactive: pageLabels('priority.showInactive') }} /></div>
}
