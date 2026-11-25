import { NextResponse } from 'next/server'
import { saveSelfReflection } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const input = await request.json() as { version?: number; body?: string; submit?: boolean }
    const version = input.version
    if (typeof version !== 'number' || !Number.isInteger(version) || typeof input.body !== 'string') return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    const body = input.body
    return NextResponse.json(await saveSelfReflection((await context.params).dossierId, version, body, input.submit === true))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
