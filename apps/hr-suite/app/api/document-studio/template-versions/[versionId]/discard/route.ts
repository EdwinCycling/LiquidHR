import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { discardDraft } from '@/lib/document-studio/service'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try { const { versionId } = await params; return NextResponse.json({ data: await discardDraft(versionId, await readJson(request)) }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
