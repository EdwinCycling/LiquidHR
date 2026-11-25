import { NextResponse } from 'next/server'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'
import { closePerformanceReviewRound } from '@/lib/performance-reviews/service'

export async function POST(request: Request, context: { params: Promise<{ roundId: string }> }) {
  try {
    const input = await request.json() as { version?: number; reason?: string }
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (typeof input.version !== 'number' || !Number.isInteger(input.version) || !input.reason?.trim() || !idempotencyKey) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await closePerformanceReviewRound((await context.params).roundId, input.reason, input.version, idempotencyKey))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
