import { NextResponse } from 'next/server'
import { releaseAdditionalReviewer } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const input = await request.json() as { version?: number; reason?: string }
    if (typeof input.version !== 'number' || !Number.isInteger(input.version) || !input.reason?.trim()) {
      return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    }
    return NextResponse.json(await releaseAdditionalReviewer((await context.params).dossierId, input.version, input.reason))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
