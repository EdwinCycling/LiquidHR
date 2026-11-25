import { NextResponse } from 'next/server'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'
import { searchPerformanceReviewEmployees } from '@/lib/performance-reviews/service'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const rawCursor = params.get('cursor') ?? '0'
    const rawLimit = params.get('limit') ?? '25'
    if (!/^\d{1,5}$/.test(rawCursor) || !/^\d{1,3}$/.test(rawLimit)) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await searchPerformanceReviewEmployees({
      search: params.get('search') ?? params.get('q') ?? '',
      offset: Number(rawCursor),
      limit: Number(rawLimit),
    }))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
