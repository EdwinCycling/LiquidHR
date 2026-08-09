import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { runWorkflowJobs, WorkflowJobError } from '@/lib/process-automation/workflow-job-service'

const inputSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
  language: z.enum(['nl', 'en']).default('nl'),
}).strict()

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ code: 'PROCESS_AUTOMATION_RUN_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await runWorkflowJobs(parsed.data.limit, parsed.data.language) })
  } catch (error) {
    if (error instanceof WorkflowJobError) return NextResponse.json({ code: error.code }, { status: error.code === 'FORBIDDEN' ? 403 : 500 })
    return permissionErrorResponse(error) ?? NextResponse.json({ code: 'PROCESS_AUTOMATION_RUN_FAILED' }, { status: 500 })
  }
}
