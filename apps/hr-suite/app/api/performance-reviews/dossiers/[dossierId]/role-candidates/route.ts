import { NextResponse } from 'next/server'
import { searchPerformanceReviewRoleCandidates } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const search = new URL(request.url).searchParams.get('search') ?? ''
    return NextResponse.json(await searchPerformanceReviewRoleCandidates((await context.params).dossierId, search))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
