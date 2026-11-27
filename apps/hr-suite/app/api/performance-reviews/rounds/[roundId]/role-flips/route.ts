import { NextResponse } from 'next/server'
import { applyPerformanceReviewRoleFlip } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ roundId: string }> }) {
  try {
    const key = request.headers.get('Idempotency-Key')
    if (!key) return NextResponse.json({ error: 'PERFORMANCE_IDEMPOTENCY_KEY_INVALID' }, { status: 400 })
    return NextResponse.json(await applyPerformanceReviewRoleFlip((await context.params).roundId, await request.json(), key))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
