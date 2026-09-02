import { NextResponse } from 'next/server'
import { documentStudioErrorResponse } from '@/lib/document-studio/api'
import { getEditorData } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try { const { versionId } = await params; const data = await getEditorData(versionId); return data ? NextResponse.json({ data }) : NextResponse.json({ code: 'DOCUMENT_TEMPLATE_VERSION_NOT_FOUND' }, { status: 404 }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
