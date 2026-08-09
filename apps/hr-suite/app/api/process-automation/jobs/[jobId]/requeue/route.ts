import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const paramsSchema = z.object({ jobId: z.string().uuid() }).strict()

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const parsed = paramsSchema.safeParse(await params)
    if (!parsed.success) return NextResponse.json({ code: 'INVALID_WORKFLOW_JOB_ID' }, { status: 400 })
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('requeue_workflow_job', { requested_job_id: parsed.data.jobId })
    if (error) return NextResponse.json({ code: error.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'WORKFLOW_JOB_RECOVERY_FAILED' }, { status: error.message.includes('FORBIDDEN') ? 403 : 409 })
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error) ?? NextResponse.json({ code: 'WORKFLOW_JOB_RECOVERY_FAILED' }, { status: 500 })
  }
}
