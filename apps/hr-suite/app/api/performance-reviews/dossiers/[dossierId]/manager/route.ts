import { NextResponse } from 'next/server'
import { saveManagerResponse } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const raw = await request.json() as { submit?: boolean; version?: number; body?: string; meetingDate?: string | null; score?: number; ratingExplanation?: string }
    const { submit, ...input } = raw
    return NextResponse.json(await saveManagerResponse((await context.params).dossierId, input, submit === true))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
