import { NextResponse } from 'next/server'
import { listDistributionItems } from '@/lib/document-generation/batch-service'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    return NextResponse.json({ data: await listDistributionItems((await context.params).batchId) })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}
