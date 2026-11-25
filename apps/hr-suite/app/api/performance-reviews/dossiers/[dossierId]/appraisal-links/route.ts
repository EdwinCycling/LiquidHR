import { NextResponse } from 'next/server'
import { linkPerformanceAppraisal } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const input = await request.json() as { appraisalItemId?: string }
    if (!input.appraisalItemId) return NextResponse.json({ error: 'PERFORMANCE_APPRAISAL_ID_REQUIRED' }, { status: 400 })
    return NextResponse.json(await linkPerformanceAppraisal((await context.params).dossierId, input.appraisalItemId), { status: 201 })
  } catch (error) { return performanceReviewErrorResponse(error) }
}
