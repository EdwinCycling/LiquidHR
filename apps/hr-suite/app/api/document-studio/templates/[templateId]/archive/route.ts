import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { archiveTemplate } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ templateId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try { const { templateId } = await params; return NextResponse.json({ data: await archiveTemplate(templateId, await readJson(request)) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
