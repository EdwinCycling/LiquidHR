import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { finalizeGeneration } from '@/lib/document-generation/service'
export const runtime = 'nodejs'
export async function POST(request: Request, context: { params: Promise<{ snapshotId: string }> }) { try { const body = await request.json().catch(() => ({})) as { idempotencyKey?: string }; return NextResponse.json({ data: await finalizeGeneration((await context.params).snapshotId, body.idempotencyKey) }) } catch (error) { const response = documentGenerationErrorResponse(error); if (response) return response; throw error } }
