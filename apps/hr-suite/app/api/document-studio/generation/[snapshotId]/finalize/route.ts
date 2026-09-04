import { NextResponse } from 'next/server'
import { DocumentGenerationError, finalizeGeneration } from '@/lib/document-generation/service'
export async function POST(_request: Request, context: { params: Promise<{ snapshotId: string }> }) { try { return NextResponse.json({ data: await finalizeGeneration((await context.params).snapshotId) }) } catch (error) { if (error instanceof DocumentGenerationError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error } }

