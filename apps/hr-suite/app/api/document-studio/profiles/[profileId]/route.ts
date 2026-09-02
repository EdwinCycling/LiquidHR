import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { updateDocumentProfile } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ profileId: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try { const { profileId } = await params; return NextResponse.json({ data: await updateDocumentProfile(profileId, await readJson(request)) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
