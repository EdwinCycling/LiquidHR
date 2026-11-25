import { NextResponse } from 'next/server'
import { reassignPerformanceReviewReviewer } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const input = await request.json() as { reviewerEmployeeId?: string; version?: number }
    if (!input.reviewerEmployeeId || typeof input.version !== 'number' || !Number.isInteger(input.version)) {
      return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    }
    return NextResponse.json(await reassignPerformanceReviewReviewer((await context.params).dossierId, input.reviewerEmployeeId, input.version))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
