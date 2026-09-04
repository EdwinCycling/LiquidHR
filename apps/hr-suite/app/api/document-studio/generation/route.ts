import { NextResponse } from 'next/server'
import { DocumentGenerationError, createGenerationPreview, listGenerationHistory } from '@/lib/document-generation/service'
export async function GET() { try { return NextResponse.json({ data: await listGenerationHistory() }) } catch (error) { if (error instanceof DocumentGenerationError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error } }
export async function POST(request: Request) { try { return NextResponse.json({ data: await createGenerationPreview(await request.json()) }, { status: 201 }) } catch (error) { if (error instanceof DocumentGenerationError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error } }

