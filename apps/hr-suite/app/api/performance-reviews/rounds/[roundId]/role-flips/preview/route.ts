import { NextResponse } from 'next/server'
import { previewPerformanceReviewRoleFlip } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ roundId: string }> }) {
  try {
    return NextResponse.json(await previewPerformanceReviewRoleFlip((await context.params).roundId, await request.json()))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
