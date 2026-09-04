import { NextResponse } from 'next/server'
import { documentGenerationErrorResponse } from '@/lib/document-generation/api'
import { createGenerationDownload } from '@/lib/document-generation/service'
export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ snapshotId: string }> }) { try { const url = await createGenerationDownload((await context.params).snapshotId); return NextResponse.redirect(url, { headers: { 'cache-control': 'no-store' } }) } catch (error) { const response = documentGenerationErrorResponse(error); if (response) return response; throw error } }
