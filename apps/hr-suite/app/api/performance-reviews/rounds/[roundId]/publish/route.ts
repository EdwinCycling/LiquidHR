import { NextResponse } from 'next/server'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'
import { publishPerformanceReviewRound } from '@/lib/performance-reviews/service'

export async function POST(request: Request, context: { params: Promise<{ roundId: string }> }) {
  try {
    const input = await request.json() as { version?: number }
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (typeof input.version !== 'number' || !Number.isInteger(input.version) || !idempotencyKey) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await publishPerformanceReviewRound((await context.params).roundId, input.version, idempotencyKey))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
