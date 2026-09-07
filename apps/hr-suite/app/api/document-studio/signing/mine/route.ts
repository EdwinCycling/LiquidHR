import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { listMySigningRequests } from '@/lib/document-generation/signing-service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ data: await listMySigningRequests() })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}
