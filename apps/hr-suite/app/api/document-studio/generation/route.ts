import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { createGenerationPreview, listGenerationHistory } from '@/lib/document-generation/service'
export const runtime = 'nodejs'
export async function GET() { try { return NextResponse.json({ data: await listGenerationHistory() }) } catch (error) { const response = documentGenerationErrorResponse(error); if (response) return response; throw error } }
export async function POST(request: Request) { try { return NextResponse.json({ data: await createGenerationPreview(await request.json().catch(() => null)) }, { status: 201 }) } catch (error) { const response = documentGenerationErrorResponse(error); if (response) return response; throw error } }
