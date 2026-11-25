import { NextResponse } from 'next/server'
import { deletePerformanceReviewAttachment, downloadPerformanceReviewAttachment } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(_request: Request, context: { params: Promise<{ dossierId: string; attachmentId: string }> }) {
  try {
    const { dossierId, attachmentId } = await context.params
    const file = await downloadPerformanceReviewAttachment(dossierId, attachmentId)
    return NextResponse.redirect(file.signedUrl)
  } catch (error) { return performanceReviewErrorResponse(error) }
}

export async function DELETE(_request: Request, context: { params: Promise<{ dossierId: string; attachmentId: string }> }) {
  try {
    const { dossierId, attachmentId } = await context.params
    return NextResponse.json(await deletePerformanceReviewAttachment(dossierId, attachmentId))
  } catch (error) { return performanceReviewErrorResponse(error) }
}
