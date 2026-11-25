import { notFound } from 'next/navigation'
import { PerformanceReviewWorkspace } from '@/components/performance-reviews/performance-review-workspace'
import { performanceReviewLabels } from '@/lib/performance-reviews/ui-labels'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function ConversationDetailPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const context = await requireAuthContext()
  if (!context.employeeId && !context.permissions.some((permission) => permission.startsWith('performance-review:'))) notFound()
  const locale = await getLocale()
  return <PerformanceReviewWorkspace role={context.permissions.includes('performance-review:manage') ? 'hr' : context.permissions.includes('performance-review:team-read') ? 'manager' : 'employee'} summaries={[{ id: (await params).conversationId, title: locale === 'nl' ? 'Gespreksdossier' : 'Conversation dossier', phase: 'LOADING' }]} labels={performanceReviewLabels(locale, context.permissions.includes('performance-review:manage') ? 'hr' : context.permissions.includes('performance-review:team-read') ? 'manager' : 'employee')} />
}
