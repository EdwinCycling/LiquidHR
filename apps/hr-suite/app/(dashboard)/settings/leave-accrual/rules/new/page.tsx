import { redirect } from 'next/navigation'
import { AccrualRuleEditor } from '@/components/leave/accrual-rule-editor'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listLeaveCatalog } from '@/lib/leave/leave-service'
import { accrualRuleEditorLabels } from '@/lib/leave/editor-labels'

export default async function NewAccrualRulePage({ searchParams }: { searchParams: Promise<{ leaveTypeId?: string; predecessorRuleId?: string }> }) {
  try { await requirePermission('leave:write') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [{ leaveTypeId, predecessorRuleId }, catalog, labels] = await Promise.all([searchParams, listLeaveCatalog(), getTranslator('leave')])
  if (!leaveTypeId || !catalog.leaveTypes.some((item) => item.id === leaveTypeId)) redirect('/settings/leave-accrual')
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={labels('page.back')} backHref={`/settings/leave-accrual/types/${leaveTypeId}?tab=limits`} eyebrow={labels('page.title')} title={labels('rule.newTitle')} subtitle={labels('rule.chainDescription')} /><AccrualRuleEditor catalog={catalog} leaveTypeId={leaveTypeId} predecessorRuleId={predecessorRuleId} labels={accrualRuleEditorLabels(labels)} /></div>
}
