import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { replaceTemplateTags } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ templateId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { templateId } = await params
    const body = await readJson(request)
    const tagIds = typeof body === 'object' && body !== null && 'tagIds' in body && Array.isArray(body.tagIds) ? body.tagIds.filter((value): value is string => typeof value === 'string') : []
    return NextResponse.json({ data: await replaceTemplateTags(templateId, tagIds) })
  } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
