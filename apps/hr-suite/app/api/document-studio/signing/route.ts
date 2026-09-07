import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { listSigningRequests, prepareSigning } from '@/lib/document-generation/signing-service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ data: await listSigningRequests() })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { snapshotId?: unknown } | null
    return NextResponse.json({ data: await prepareSigning(body?.snapshotId) }, { status: 201 })
  } catch (error) {
    const response = documentGenerationErrorResponse(error)
    if (response) return response
    throw error
  }
}
