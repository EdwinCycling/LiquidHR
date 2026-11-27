import { NextResponse } from 'next/server'
import { getPerformanceReviewDashboard } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(request: Request) {
  try {
    const role = new URL(request.url).searchParams.get('role')
    const workspaceRole = role === 'employee' || role === 'manager' || role === 'additional-reviewer' ? role : 'hr'
    return NextResponse.json(await getPerformanceReviewDashboard(workspaceRole))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
