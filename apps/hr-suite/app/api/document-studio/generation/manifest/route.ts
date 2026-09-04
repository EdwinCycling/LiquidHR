import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { listGenerationManifest } from '@/lib/document-generation/service'
export const runtime = 'nodejs'
export async function GET(request: Request) { try { const templateVersionId = new URL(request.url).searchParams.get('templateVersionId') ?? ''; return NextResponse.json({ data: await listGenerationManifest(templateVersionId) }) } catch (error) { const response = documentGenerationErrorResponse(error); if (response) return response; throw error } }
