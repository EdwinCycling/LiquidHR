import { NextResponse } from 'next/server'
import { createDocumentDistribution, listDistributionHistory } from '@/lib/document-generation/batch-service'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ data: await listDistributionHistory() })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await createDocumentDistribution(await request.json().catch(() => null)) }, { status: 201 })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}
