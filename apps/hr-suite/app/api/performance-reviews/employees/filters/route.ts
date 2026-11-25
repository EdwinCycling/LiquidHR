import { NextResponse } from 'next/server'
import { listPerformanceReviewEmployeeFilters } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(request: Request) {
  try {
    const language = new URL(request.url).searchParams.get('language') === 'en' ? 'en' : 'nl'
    return NextResponse.json(await listPerformanceReviewEmployeeFilters(language))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
