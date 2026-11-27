import { NextResponse } from 'next/server'
import { getPerformanceReviewRound, updatePerformanceReviewRound } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(_request: Request, context: { params: Promise<{ roundId: string }> }) {
  try { return NextResponse.json(await getPerformanceReviewRound((await context.params).roundId)) } catch (error) { return performanceReviewErrorResponse(error) }
}

export async function PATCH(request: Request, context: { params: Promise<{ roundId: string }> }) {
  try {
    const input = await request.json() as { version?: number; title?: string; introduction?: string; roundType?: string; periodStart?: string; periodEnd?: string; startDate?: string; dueDate?: string | null; rating?: { options?: Array<{ score: number; label: string; description: string }> } | null; questionSets?: { enabled: boolean; defaults: { EMPLOYEE: string | null; GV: string | null; AB: string | null }; overrides?: Record<string, unknown> } }
    if (typeof input.version !== 'number') return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    const { version, ...round } = input
    return NextResponse.json(await updatePerformanceReviewRound((await context.params).roundId, round, version))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
