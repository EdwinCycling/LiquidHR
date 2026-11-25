import { NextResponse } from 'next/server'
import { uploadPerformanceReviewAttachment } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function POST(request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')
    if (!idempotencyKey) return NextResponse.json({ error: 'PERFORMANCE_IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'PERFORMANCE_ATTACHMENT_REQUIRED' }, { status: 400 })
    return NextResponse.json(await uploadPerformanceReviewAttachment((await context.params).dossierId, file, idempotencyKey), { status: 201 })
  } catch (error) { return performanceReviewErrorResponse(error) }
}
