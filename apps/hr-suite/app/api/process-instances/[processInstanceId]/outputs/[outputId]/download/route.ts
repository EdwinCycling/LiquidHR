import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createProcessOutputDocumentDownload, DocumentServiceError } from '@/lib/documents/document-service'
import { createClient } from '@/lib/supabase/server'

const paramsSchema = z.object({ processInstanceId: z.string().uuid(), outputId: z.string().uuid() }).strict()
const contextSchema = z.object({ subjectEmployeeId: z.string().uuid(), documentId: z.string().uuid() }).passthrough()

export async function GET(_request: Request, { params }: { params: Promise<{ processInstanceId: string; outputId: string }> }) {
  try {
    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) return NextResponse.json({ code: 'INVALID_PROCESS_OUTPUT_ID' }, { status: 400 })
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_process_output_download_context', {
      requested_process_instance_id: parsedParams.data.processInstanceId,
      requested_output_id: parsedParams.data.outputId,
    })
    if (error) return NextResponse.json({ code: 'PROCESS_OUTPUT_DOWNLOAD_FORBIDDEN' }, { status: error.message.includes('FORBIDDEN') ? 403 : 404 })
    const context = contextSchema.safeParse(data)
    if (!context.success) return NextResponse.json({ code: 'PROCESS_OUTPUT_DOWNLOAD_FAILED' }, { status: 500 })
    return NextResponse.redirect(await createProcessOutputDocumentDownload(context.data.subjectEmployeeId, context.data.documentId))
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof DocumentServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
    return NextResponse.json({ code: 'PROCESS_OUTPUT_DOWNLOAD_FAILED' }, { status: 500 })
  }
}
