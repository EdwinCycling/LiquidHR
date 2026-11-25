import { redirect } from 'next/navigation'
import { PerformanceReviewRoundForm } from '@/components/performance-reviews/performance-review-round-form'
import { requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function NewConversationRoundPage() {
  try { await requirePermission('performance-review:manage') } catch { redirect('/geen-toegang') }
  const locale = await getLocale()
  return <PerformanceReviewRoundForm locale={locale} />
}
