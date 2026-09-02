import { NextResponse } from 'next/server'
import { documentStudioErrorResponse } from '@/lib/document-studio/api'
import { createDraftFromActive } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ templateId: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try { const { templateId } = await params; return NextResponse.json({ data: await createDraftFromActive(templateId) }, { status: 201 }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
