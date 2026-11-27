import { redirect } from 'next/navigation'
import { QuestionSetManager } from '@/components/performance-reviews/question-set-manager'
import { requirePerformanceReviewQuestionSetModule, listPerformanceReviewQuestionSets } from '@/lib/performance-reviews/question-set-service'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import Link from 'next/link'
import messagesNl from '@/messages/nl/performanceReviewQuestionSets.json'
import messagesEn from '@/messages/en/performanceReviewQuestionSets.json'

export default async function PerformanceReviewQuestionSetsPage() {
  try {
    await requirePerformanceReviewQuestionSetModule()
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    redirect('/settings/modules')
  }
  const [items, locale] = await Promise.all([listPerformanceReviewQuestionSets(), getLocale()])
  const messages = locale === 'nl' ? messagesNl : messagesEn
  return <div className="mx-auto w-full max-w-7xl space-y-4 px-5 py-8 lg:px-10">
    <Link className="inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/settings">{messages.back}</Link>
    <QuestionSetManager initialItems={items} locale={locale} />
  </div>
}
