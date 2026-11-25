import { redirect } from 'next/navigation'
import { PerformanceReviewWorkspace } from '@/components/performance-reviews/performance-review-workspace'
import { performanceReviewLabels } from '@/lib/performance-reviews/ui-labels'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function ConversationsPage() {
  const context = await requireAuthContext()
  const canManage = context.permissions.includes('performance-review:manage')
  const canRead = canManage || context.permissions.includes('performance-review:read') || context.permissions.includes('performance-review:team-read')
  if (!canRead) redirect('/geen-toegang')
  const locale = await getLocale()
  return <PerformanceReviewWorkspace role={canManage ? 'hr' : 'manager'} summaries={[]} labels={performanceReviewLabels(locale, canManage ? 'hr' : 'manager')} />
}
