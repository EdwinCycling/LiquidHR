import { redirect } from 'next/navigation'
import { LeaveCatalogPage } from '@/components/leave/leave-catalog-page'
import { LeaveLedgerPanel } from '@/components/leave/leave-ledger-panel'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listLeaveCatalog } from '@/lib/leave/leave-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function LeaveAccrualSettingsPage() {
  try {
    await requirePermission('leave:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [catalog, pageLabels, settingsLabels] = await Promise.all([listLeaveCatalog(), getTranslator('leave'), getTranslator('settings')])
  return <div className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={settingsLabels('admin.backToOverview')} backHref="/settings" eyebrow={settingsLabels('admin.eyebrow')} title={pageLabels('page.title')} subtitle={pageLabels('page.subtitle')} /><LeaveCatalogPage initial={catalog} labels={{ addType: pageLabels('page.addType'), addWorkHour: pageLabels('page.addWorkHour'), priorityRules: pageLabels('page.priorityRules'), showInactive: pageLabels('page.showInactive'), empty: pageLabels('page.empty'), emptyDescription: pageLabels('page.emptyDescription'), active: pageLabels('page.active'), inactive: pageLabels('page.inactive'), moreActions: pageLabels('page.moreActions'), tabs: { leave: pageLabels('page.tabs.leave'), overtime: pageLabels('page.tabs.overtime'), workHours: pageLabels('page.tabs.workHours') }, columns: { name: pageLabels('page.columns.name'), accrual: pageLabels('page.columns.accrual'), expiry: pageLabels('page.columns.expiry'), approval: pageLabels('page.columns.approval'), category: pageLabels('page.columns.category') }, approvalYes: pageLabels('page.approvalYes'), approvalNo: pageLabels('page.approvalNo'), perYear: pageLabels('page.perYear'), unlimited: pageLabels('page.unlimited'), noExpiry: pageLabels('page.noExpiry'), yearEnd: pageLabels('page.yearEnd'), monthsAfterYear: pageLabels('page.monthsAfterYear'), notConfigured: pageLabels('page.notConfigured'), contractHours: pageLabels('type.contractHours'), workedHours: pageLabels('type.workedHours'), payrollPeriod: pageLabels('type.payrollPeriod'), yearly: pageLabels('type.yearly') }} /><LeaveLedgerPanel labels={{ title: pageLabels('page.ledgerTitle'), description: pageLabels('page.ledgerDescription'), yearStatus: pageLabels('page.yearStatus'), yearLocked: pageLabels('page.yearLocked'), yearActive: pageLabels('page.yearActive'), yearFuture: pageLabels('page.yearFuture'), closeYear: pageLabels('page.closeYear'), closeYearConfirm: pageLabels('page.closeYearConfirm'), closeYearDone: pageLabels('page.closeYearDone'), empty: pageLabels('page.ledgerEmpty'), failed: pageLabels('page.ledgerFailed'), loading: pageLabels('page.ledgerLoading'), working: pageLabels('page.ledgerWorking') }} /></div>
}
