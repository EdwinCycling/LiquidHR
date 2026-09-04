import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { getGenerationPreview } from '@/lib/document-generation/service'
export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ snapshotId: string }> }) { try { return NextResponse.json({ data: await getGenerationPreview((await context.params).snapshotId) }) } catch (error) { const response = documentGenerationErrorResponse(error); if (response) return response; throw error } }
