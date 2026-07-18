import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createDocumentDownload, DocumentServiceError } from '@/lib/documents/document-service'
interface Context { params: Promise<{ employeeId: string; documentId: string }> }
export async function GET(_request: Request, context: Context) { try { const { employeeId, documentId } = await context.params; return NextResponse.redirect(await createDocumentDownload(employeeId, documentId)) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); throw error } }
