import { notFound, redirect } from 'next/navigation'
import { PerformanceReviewRoundDetail } from '@/components/performance-reviews/performance-review-round-detail'
import { performanceReviewLabels } from '@/lib/performance-reviews/ui-labels'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { getEnabledTenantModules } from '@/lib/modules/module-service'

export default async function PerformanceReviewRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const context = await requireAuthContext()
  if (!context.permissions.includes('performance-review:manage')) redirect('/geen-toegang')
  const [locale, modules] = await Promise.all([getLocale(), getEnabledTenantModules()])
  const { roundId } = await params
  if (!roundId) notFound()
  return <PerformanceReviewRoundDetail roundId={roundId} labels={performanceReviewLabels(locale, 'hr')} locale={locale} questionSetsEnabled={modules.includes('PERFORMANCE_REVIEW_QUESTION_SETS')} />
}
