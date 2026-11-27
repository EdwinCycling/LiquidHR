import { NextResponse } from 'next/server'
import { saveAdditionalReviewerContribution } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const raw = await request.json() as { submit?: boolean }
    const { submit, ...input } = raw
    return NextResponse.json(await saveAdditionalReviewerContribution((await context.params).dossierId, input, submit === true))
  } catch (error) {
    return performanceReviewErrorResponse(error)
  }
}
