import { NextResponse } from 'next/server'
import { createPerformanceReviewRound, listPerformanceReviewRounds } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET() {
  try { return NextResponse.json(await listPerformanceReviewRounds()) } catch (error) { return performanceReviewErrorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!idempotencyKey) return NextResponse.json({ error: 'PERFORMANCE_IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 })
    return NextResponse.json(await createPerformanceReviewRound(await request.json(), idempotencyKey), { status: 201 })
  } catch (error) { return performanceReviewErrorResponse(error) }
}
