import { NextResponse } from 'next/server'
import {
  archivePerformanceReviewQuestionSet,
  savePerformanceReviewQuestionSet,
} from '@/lib/performance-reviews/question-set-service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function PUT(request: Request, { params }: { params: Promise<{ questionSetId: string }> }) {
  try {
    const { questionSetId } = await params
    const input = await request.json() as Record<string, unknown>
    return NextResponse.json(await savePerformanceReviewQuestionSet({ ...input, id: questionSetId }))
  } catch (error) { return performanceReviewErrorResponse(error) }
}

export async function POST(request: Request, { params }: { params: Promise<{ questionSetId: string }> }) {
  try {
    const { questionSetId } = await params
    const input = await request.json() as { action?: string; version?: number }
    if (input.action !== 'archive' || !Number.isInteger(input.version)) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await archivePerformanceReviewQuestionSet(questionSetId, input.version as number))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
