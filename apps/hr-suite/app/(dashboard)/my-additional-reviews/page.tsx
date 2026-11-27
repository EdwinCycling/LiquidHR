import { redirect } from 'next/navigation'
import { PerformanceReviewWorkspace } from '@/components/performance-reviews/performance-review-workspace'
import { performanceReviewLabels } from '@/lib/performance-reviews/ui-labels'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function MyAdditionalReviewsPage() {
  const context = await requireAuthContext()
  if (!context.employeeId) redirect('/geen-toegang')
  const locale = await getLocale()
  return <PerformanceReviewWorkspace role="additional-reviewer" summaries={[]} labels={performanceReviewLabels(locale, 'additional-reviewer')} locale={locale} />
}
