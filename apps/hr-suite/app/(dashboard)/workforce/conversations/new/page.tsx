import { redirect } from 'next/navigation'
import { PerformanceReviewRoundForm } from '@/components/performance-reviews/performance-review-round-form'
import { requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { getEnabledTenantModules } from '@/lib/modules/module-service'

export default async function NewConversationRoundPage() {
  try { await requirePermission('performance-review:manage') } catch { redirect('/geen-toegang') }
  const [locale, modules] = await Promise.all([getLocale(), getEnabledTenantModules()])
  return <PerformanceReviewRoundForm locale={locale} questionSetsEnabled={modules.includes('PERFORMANCE_REVIEW_QUESTION_SETS')} />
}
