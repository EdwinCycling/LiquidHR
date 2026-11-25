import { NextResponse } from 'next/server'
import { searchPerformanceReviewEmployees } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const uuid = (key: string) => {
      const value = params.get(key)
      return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null
    }
    const rawStatus = params.get('employmentStatus') ?? 'ACTIVE'
    const rawCursor = params.get('cursor') ?? '0'
    const rawLimit = params.get('limit') ?? '25'
    if (!['ACTIVE', 'ENDED', 'ALL'].includes(rawStatus) || !/^\d{1,5}$/.test(rawCursor) || !/^\d{1,3}$/.test(rawLimit)) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    for (const key of ['hrGroupId', 'administrationId', 'departmentId', 'jobId', 'locationId', 'managerId', 'employeeId']) {
      if (params.has(key) && !uuid(key)) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    }
    return NextResponse.json(await searchPerformanceReviewEmployees({
      search: params.get('search') ?? '',
      hrGroupId: uuid('hrGroupId'),
      administrationId: uuid('administrationId'),
      departmentId: uuid('departmentId'),
      jobId: uuid('jobId'),
      locationId: uuid('locationId'),
      managerId: uuid('managerId'),
      employeeId: uuid('employeeId'),
      employmentStatus: rawStatus as 'ACTIVE' | 'ENDED' | 'ALL',
      offset: Number(rawCursor),
      limit: Number(rawLimit),
    }))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
