import { NextResponse } from 'next/server'
import { listPrivateNotes, savePrivateNote } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(_request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try { return NextResponse.json(await listPrivateNotes((await context.params).dossierId)) } catch (error) { return performanceReviewErrorResponse(error) }
}

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const input = await request.json() as { version?: number; body?: string }
    const version = input.version
    if (typeof version !== 'number' || !Number.isInteger(version) || typeof input.body !== 'string' || !input.body.trim()) return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    return NextResponse.json(await savePrivateNote((await context.params).dossierId, input.body, version))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
