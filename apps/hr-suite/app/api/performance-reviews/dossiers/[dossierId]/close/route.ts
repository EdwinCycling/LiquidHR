import { NextResponse } from 'next/server'
import { closePerformanceReviewDossier } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const input = await request.json() as { version?: number }
    if (typeof input.version !== 'number' || !Number.isInteger(input.version)) {
      return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    }
    return NextResponse.json(await closePerformanceReviewDossier((await context.params).dossierId, input.version))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
