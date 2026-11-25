import { NextResponse } from 'next/server'
import { acknowledgePerformanceReview } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try { return NextResponse.json(await acknowledgePerformanceReview((await context.params).dossierId, await request.json())) } catch (error) { return performanceReviewErrorResponse(error) }
}
