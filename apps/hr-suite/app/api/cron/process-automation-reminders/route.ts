import { NextResponse } from 'next/server'
import { runScheduledProcessReminderJobs } from '@/lib/process-automation/workflow-job-service'
import { runDuePerformanceReviewActivations } from '@/lib/performance-reviews/scheduled-activation-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) return NextResponse.json({ code: 'CRON_UNAVAILABLE' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ code: 'CRON_UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const result = await runScheduledProcessReminderJobs()
    const performanceReviews = await runDuePerformanceReviewActivations()
    return NextResponse.json({ data: {
      claimed: result.claimed,
      succeeded: result.succeeded,
      retried: result.retried,
      deadLettered: result.deadLettered,
      errorCodes: result.errors,
      performanceReviewsActivated: performanceReviews.activated,
    } })
  } catch {
    return NextResponse.json({ code: 'PROCESS_REMINDER_SCHEDULER_FAILED' }, { status: 500 })
  }
}
