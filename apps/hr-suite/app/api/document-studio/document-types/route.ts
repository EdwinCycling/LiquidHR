import { NextResponse } from 'next/server'
import { documentStudioErrorResponse, readJson } from '@/lib/document-studio/api'
import { createDocumentType, listTypes } from '@/lib/document-studio/service'

export async function GET() {
  try { return NextResponse.json({ data: await listTypes() }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}

export async function POST(request: Request) {
  try { return NextResponse.json({ data: await createDocumentType(await readJson(request)) }, { status: 201 }) } catch (error) { const response = documentStudioErrorResponse(error); if (response) return response; throw error }
}
