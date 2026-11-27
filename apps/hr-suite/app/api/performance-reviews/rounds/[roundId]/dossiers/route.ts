import { NextResponse } from 'next/server'
import { addPerformanceReviewDossier } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ roundId: string }> }) {
  try {
    const input = await request.json() as { employeeId?: string; reviewerEmployeeId?: string; additionalReviewerEmployeeId?: string | null; administrationId?: string; questionSetOverrides?: unknown }
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!input.employeeId || !idempotencyKey) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await addPerformanceReviewDossier((await context.params).roundId, input.employeeId, input.reviewerEmployeeId, input.administrationId, idempotencyKey, input.additionalReviewerEmployeeId, input.questionSetOverrides), { status: 201 })
  } catch (error) { return performanceReviewErrorResponse(error) }
}
