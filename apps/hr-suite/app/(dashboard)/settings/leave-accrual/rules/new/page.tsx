import { redirect } from 'next/navigation'
import { AccrualRuleEditor } from '@/components/leave/accrual-rule-editor'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listLeaveCatalog } from '@/lib/leave/leave-service'

export default async function NewAccrualRulePage({ searchParams }: { searchParams: Promise<{ leaveTypeId?: string; predecessorRuleId?: string }> }) {
  try { await requirePermission('leave:write') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [{ leaveTypeId, predecessorRuleId }, catalog, labels] = await Promise.all([searchParams, listLeaveCatalog(), getTranslator('leave')])
  if (!leaveTypeId || !catalog.leaveTypes.some((item) => item.id === leaveTypeId)) redirect('/settings/leave-accrual')
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><AdminSettingsPageHeader backLabel={labels('page.back')} backHref={`/settings/leave-accrual/types/${leaveTypeId}`} eyebrow={labels('page.title')} title={labels('rule.newTitle')} subtitle={labels('rule.chainDescription')} /><AccrualRuleEditor catalog={catalog} leaveTypeId={leaveTypeId} predecessorRuleId={predecessorRuleId} labels={{ save: labels('rule.add'), saving: labels('page.saving'), chainTitle: labels('rule.chainTitle'), chainDescription: labels('rule.chainDescription'), predecessor: labels('rule.predecessor'), profile: labels('rule.profile'), successor: labels('rule.successor'), successorStart: labels('rule.successorStart'), validUntil: labels('rule.validUntil'), basis: labels('rule.basis'), frequency: labels('rule.frequency'), timing: labels('rule.timing'), amount: labels('rule.amount'), rate: labels('rule.rate'), expiry: labels('rule.expiry'), pause: labels('rule.pause'), workHours: labels('rule.workHours'), contractHours: labels('type.contractHours'), workedHours: labels('type.workedHours'), payrollPeriod: labels('type.payrollPeriod'), yearly: labels('type.yearly'), upfront: labels('type.upfront'), arrears: labels('type.arrears'), noPredecessor: labels('rule.noPredecessor'), version: labels('rule.version'), lockedHint: labels('rule.lockedHint'), selectAtLeastOne: labels('rule.selectAtLeastOne'), failed: labels('messages.inputInvalid'), saved: labels('page.saved') }} /></div>
}
