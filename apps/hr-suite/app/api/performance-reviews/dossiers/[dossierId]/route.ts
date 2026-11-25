import { NextResponse } from 'next/server'
import { getPerformanceReviewDossier } from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(_request: Request, context: { params: Promise<{ dossierId: string }> }) {
  try { return NextResponse.json(await getPerformanceReviewDossier((await context.params).dossierId)) } catch (error) { return performanceReviewErrorResponse(error) }
}
