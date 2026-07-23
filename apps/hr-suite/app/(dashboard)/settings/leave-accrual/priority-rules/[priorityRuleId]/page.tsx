import { notFound, redirect } from 'next/navigation'
import { PriorityRuleEditor } from '@/components/leave/priority-rule-editor'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listLeaveCatalog } from '@/lib/leave/leave-service'
import { getTranslator } from '@/lib/i18n/server'

export default async function EditLeavePriorityRulePage({ params, searchParams }: { params: Promise<{ priorityRuleId: string }>; searchParams: Promise<{ year?: string }> }) {
  try {
    await requirePermission('leave:read')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const [{ priorityRuleId }, { year: yearParam }, catalog, labels] = await Promise.all([params, searchParams, listLeaveCatalog(), getTranslator('leave')])
  const existing = catalog.priorityRules.find((rule) => rule.id === priorityRuleId)
  if (!existing) notFound()
  const parsedYear = yearParam ? Number(yearParam) : new Date().getFullYear()
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : new Date().getFullYear()
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><PriorityRuleEditor catalog={catalog} existing={existing} labels={{ save: labels('priority.save'), saving: labels('priority.saving'), back: labels('priority.back'), profile: labels('priority.profile'), name: labels('priority.name'), validFrom: labels('priority.validFrom'), validUntil: labels('priority.validUntil'), noEnd: labels('priority.noEnd'), active: labels('priority.active'), activeHint: labels('priority.activeHint'), orderTitle: labels('priority.orderTitle'), orderHint: labels('priority.orderHint'), first: labels('priority.first'), last: labels('priority.last'), addType: labels('priority.addType'), remove: labels('priority.remove'), moveUp: labels('priority.moveUp'), moveDown: labels('priority.moveDown'), noTypes: labels('priority.noTypes'), failed: labels('priority.failed'), newTitle: labels('priority.newTitle'), editTitle: labels('priority.editTitle'), year: String(year) }} year={year} /></div>
}
