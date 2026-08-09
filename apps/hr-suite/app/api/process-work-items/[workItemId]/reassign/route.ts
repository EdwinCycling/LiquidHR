import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { reassignWorkItem, workItemErrorResponse } from '@/lib/process-automation/work-item-service'

interface Params {
  params: Promise<{ workItemId: string }>
}

const inputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  employeeId: z.string().uuid(),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ code: 'PROCESS_WORK_ITEM_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    return NextResponse.json({ data: await reassignWorkItem(workItemId, parsed.data.expectedVersion, parsed.data.employeeId) })
  } catch (error) {
    return permissionErrorResponse(error) ?? workItemErrorResponse(error) ?? NextResponse.json({ code: 'PROCESS_WORK_ITEM_OPERATION_FAILED' }, { status: 500 })
  }
}
