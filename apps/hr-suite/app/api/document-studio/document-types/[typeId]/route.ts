import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { updateDocumentType } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ typeId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try { const { typeId } = await params; return NextResponse.json({ data: await updateDocumentType(typeId, await readJson(request)) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
