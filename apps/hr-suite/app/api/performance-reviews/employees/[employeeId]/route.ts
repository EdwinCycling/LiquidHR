import { NextResponse } from 'next/server'
import { listPerformanceReviewHistory } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(_request: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    const { employeeId } = await context.params
    return NextResponse.json({ items: await listPerformanceReviewHistory(employeeId) })
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
