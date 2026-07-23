import { notFound, redirect } from 'next/navigation'
import { LeaveTypeEditor } from '@/components/leave/leave-type-editor'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listLeaveCatalog } from '@/lib/leave/leave-service'

export default async function LeaveTypePage({ params }: { params: Promise<{ leaveTypeId: string }> }) {
  try { await requirePermission('leave:write') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [{ leaveTypeId }, catalog, labels] = await Promise.all([params, listLeaveCatalog(), getTranslator('leave')])
  const leaveType = catalog.leaveTypes.find((item) => item.id === leaveTypeId)
  if (!leaveType) notFound()
  const year = new Date().getFullYear()
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={labels('page.back')} backHref="/settings/leave-accrual" eyebrow={labels('page.title')} title={labels('type.editTitle', { name: leaveType.name, year })} /><LeaveTypeEditor catalog={catalog} existing={leaveType} mode="leave" labels={typeLabels(labels)} /></div>
}

function typeLabels(t: Awaited<ReturnType<typeof getTranslator>>) {
  return { save: t('page.save'), archive: t('page.archive'), saving: t('page.saving'), saved: t('page.saved'), failed: t('page.failed'), tabs: { base: t('type.baseTab'), limits: t('type.limitsTab'), advanced: t('type.advancedTab') }, name: t('type.name'), color: t('type.color'), colorOptions: { blue: t('type.colorBlue'), teal: t('type.colorTeal'), green: t('type.colorGreen'), orange: t('type.colorOrange'), red: t('type.colorRed'), primary: t('type.colorPrimary'), success: t('type.colorSuccess'), warning: t('type.colorWarning') }, scope: t('type.scope'), scopeStatutory: t('type.scopeStatutory'), scopeNonStatutory: t('type.scopeNonStatutory'), scopeAdv: t('type.scopeAdv'), scopeOther: t('type.scopeOther'), category: t('type.category'), regularWork: t('type.regularWork'), overtime: t('type.overtime'), informational: t('type.informational'), activeLabel: t('type.activeLabel'), selfService: t('type.selfService'), entitlement: t('type.entitlement'), accrual: t('type.accrual'), unlimited: t('type.unlimited'), annualCap: t('type.annualCap'), weeklyFactorCap: t('type.weeklyFactorCap'), annualCapValue: t('type.annualCapValue'), weeklyFactor: t('type.weeklyFactor'), ruleTitle: t('type.ruleTitle'), ruleEmpty: t('type.ruleEmpty'), addRule: t('type.addRule'), notApplicable: t('type.notApplicable'), messages: { inputInvalid: t('messages.inputInvalid'), failed: t('messages.notFound') } }
}
