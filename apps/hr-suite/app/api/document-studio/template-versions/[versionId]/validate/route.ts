import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { validateDraft } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try { const { versionId } = await params; const body = await readJson(request); return NextResponse.json({ data: await validateDraft({ ...(typeof body === 'object' && body !== null ? body : {}), draftVersionId: versionId }) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
