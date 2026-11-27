import { redirect } from 'next/navigation'
import { PerformanceReviewWorkspace } from '@/components/performance-reviews/performance-review-workspace'
import { performanceReviewLabels } from '@/lib/performance-reviews/ui-labels'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { getEnabledTenantModules } from '@/lib/modules/module-service'
import questionSetMessagesNl from '@/messages/nl/performanceReviewQuestionSets.json'
import questionSetMessagesEn from '@/messages/en/performanceReviewQuestionSets.json'

export default async function ConversationsPage() {
  const context = await requireAuthContext()
  const canManage = context.permissions.includes('performance-review:manage')
  const canRead = canManage || context.permissions.includes('performance-review:read') || context.permissions.includes('performance-review:team-read')
  if (!canRead) redirect('/geen-toegang')
  const [locale, modules] = await Promise.all([getLocale(), getEnabledTenantModules()])
  const questionSetMessages = locale === 'nl' ? questionSetMessagesNl : questionSetMessagesEn
  const questionSetsHref = canManage && modules.includes('PERFORMANCE_REVIEW_QUESTION_SETS') ? '/settings/performance-reviews/question-sets' : undefined
  return <PerformanceReviewWorkspace role={canManage ? 'hr' : 'manager'} summaries={[]} labels={performanceReviewLabels(locale, canManage ? 'hr' : 'manager')} questionSetsHref={questionSetsHref} questionSetsLabel={questionSetMessages.title} locale={locale} />
}
