import { NextResponse } from 'next/server'
import {
  duplicatePerformanceReviewQuestionSet,
  listPerformanceReviewQuestionSets,
  savePerformanceReviewQuestionSet,
} from '@/lib/performance-reviews/question-set-service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET() {
  try { return NextResponse.json({ items: await listPerformanceReviewQuestionSets() }) }
  catch (error) { return performanceReviewErrorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { action?: string; id?: string; name?: string }
    if (input.action === 'duplicate' && input.id && input.name) {
      return NextResponse.json(await duplicatePerformanceReviewQuestionSet(input.id, input.name), { status: 201 })
    }
    return NextResponse.json(await savePerformanceReviewQuestionSet(input), { status: 201 })
  } catch (error) { return performanceReviewErrorResponse(error) }
}
