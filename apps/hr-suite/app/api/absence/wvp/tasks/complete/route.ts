import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AbsenceServiceError, completeAbsenceWvpTask } from '@/lib/absence/service'

const inputSchema = z.object({
  taskId: z.string().uuid(),
  completionNote: z.string().trim().max(1000).nullable().optional(),
}).strict()

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'ABSENCE_WVP_TASK_INPUT_INVALID' }, { status: 400 })
    const taskId = await completeAbsenceWvpTask(parsed.data.taskId, parsed.data.completionNote)
    return NextResponse.json({ data: taskId })
  } catch (error) {
    if (error instanceof AbsenceServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'ABSENCE_WVP_TASK_COMPLETION_FAILED' }, { status: 500 })
  }
}
