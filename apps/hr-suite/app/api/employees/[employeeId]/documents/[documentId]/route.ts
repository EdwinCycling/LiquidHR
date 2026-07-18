import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { DocumentServiceError, restoreDocument, softDeleteDocument } from '@/lib/documents/document-service'
import { documentDeleteSchema } from '@/lib/documents/schemas'
interface Context { params: Promise<{ employeeId: string; documentId: string }> }
function failure(error: unknown) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status }); return null }
export async function DELETE(request: Request, context: Context) { try { const { employeeId, documentId } = await context.params; const parsed = documentDeleteSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ code: 'DOCUMENT_INPUT_INVALID' }, { status: 400 }); await softDeleteDocument(employeeId, documentId, parsed.data); return NextResponse.json({ data: { ok: true } }) } catch (error) { const response = failure(error); if (response) return response; throw error } }
export async function PATCH(_request: Request, context: Context) { try { const { employeeId, documentId } = await context.params; await restoreDocument(employeeId, documentId); return NextResponse.json({ data: { ok: true } }) } catch (error) { const response = failure(error); if (response) return response; throw error } }
