import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { getTemplateDetail, updateTemplateMetadata } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ templateId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try { const { templateId } = await params; const data = await getTemplateDetail(templateId); return data ? NextResponse.json({ data }) : NextResponse.json({ code: 'DOCUMENT_TEMPLATE_NOT_FOUND' }, { status: 404 }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try { const { templateId } = await params; return NextResponse.json({ data: await updateTemplateMetadata(templateId, await readJson(request)) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
