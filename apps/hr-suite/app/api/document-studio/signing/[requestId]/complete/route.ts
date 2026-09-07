import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { completeSigning } from '@/lib/document-generation/signing-service'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    return NextResponse.json({ data: await completeSigning((await context.params).requestId) })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}
