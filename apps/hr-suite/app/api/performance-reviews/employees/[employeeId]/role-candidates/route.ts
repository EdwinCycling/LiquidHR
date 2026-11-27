import { NextResponse } from 'next/server'
import { searchPerformanceReviewCandidateEmployees } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    const params = new URL(request.url).searchParams
    const administrationId = params.get('administrationId')
    if (!administrationId) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_ADMINISTRATION_REQUIRED' }, { status: 400 })
    return NextResponse.json(await searchPerformanceReviewCandidateEmployees((await context.params).employeeId, administrationId, params.get('search') ?? ''))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
