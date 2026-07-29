import { redirect } from 'next/navigation'
import { LeaveTypeEditor } from '@/components/leave/leave-type-editor'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listLeaveCatalog } from '@/lib/leave/leave-service'
import { accrualRuleEditorLabels } from '@/lib/leave/editor-labels'

export default async function NewLeaveTypePage() {
  try { await requirePermission('leave:write') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [labels, catalog] = await Promise.all([getTranslator('leave'), listLeaveCatalog()])
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={labels('page.back')} backHref="/settings/leave-accrual" eyebrow={labels('page.title')} title={labels('type.newTitle')} /><LeaveTypeEditor catalog={catalog} mode="leave" labels={typeLabels(labels)} /></div>
}

function typeLabels(t: Awaited<ReturnType<typeof getTranslator>>) {
  return {
    save: t('page.save'), archive: t('page.archive'), saving: t('page.saving'), saved: t('page.saved'), failed: t('page.failed'),
    tabs: { base: t('type.baseTab'), limits: t('type.limitsTab'), advanced: t('type.advancedTab') }, name: t('type.name'), color: t('type.color'),
    colorOptions: { blue: t('type.colorBlue'), teal: t('type.colorTeal'), green: t('type.colorGreen'), orange: t('type.colorOrange'), red: t('type.colorRed'), primary: t('type.colorPrimary'), success: t('type.colorSuccess'), warning: t('type.colorWarning'), destructive: t('type.colorDestructive'), accent: t('type.colorAccent'), muted: t('type.colorMuted'), sidebar: t('type.colorSidebar') },
    scope: t('type.scope'), scopeStatutory: t('type.scopeStatutory'), scopeNonStatutory: t('type.scopeNonStatutory'), scopeAdv: t('type.scopeAdv'), scopeOther: t('type.scopeOther'), category: t('type.category'), regularWork: t('type.regularWork'), overtime: t('type.overtime'), informational: t('type.informational'), activeLabel: t('type.activeLabel'), selfService: t('type.selfService'), entitlement: t('type.entitlement'), accrual: t('type.accrual'), unlimited: t('type.unlimited'), annualCap: t('type.annualCap'), weeklyFactorCap: t('type.weeklyFactorCap'), annualCapValue: t('type.annualCapValue'), weeklyFactor: t('type.weeklyFactor'), cancel: t('type.cancel'), configureAfterSave: t('type.configureAfterSave'), exceptionsForAll: t('type.exceptionsForAll'), notifyManagerOnEntry: t('type.notifyManagerOnEntry'), notApplicable: t('type.notApplicable'),
    ruleEditor: accrualRuleEditorLabels(t),
    leaveSettings: { title: t('type.leaveSettingsTitle'), allowLimitOverrun: t('type.allowLimitOverrun'), pinInCalendar: t('type.pinInCalendar'), requiresManagerApproval: t('type.requiresManagerApproval'), notifyManagerOnRequest: t('type.notifyManagerOnRequest'), requiresManagerApprovalOnCancellation: t('type.requiresManagerApprovalOnCancellation') },
    advancedPlaceholder: t('type.advancedPlaceholder'),
  }
}
