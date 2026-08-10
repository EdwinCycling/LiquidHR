import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  internalTransferErrorResponse,
  requestInternalTransferChanges,
} from '@/lib/process-automation/internal-transfer-service'

interface Params { params: Promise<{ workItemId: string }> }

const inputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  stepExpectedVersion: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(1).max(4000),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'REQUEST_CHANGES_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    const data = await requestInternalTransferChanges({ workItemId, ...parsed.data, stepExpectedVersion: parsed.data.stepExpectedVersion ?? null, correlationId: parsed.data.correlationId ?? null })
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? internalTransferErrorResponse(error)
      ?? NextResponse.json({ code: 'REQUEST_CHANGES_OPERATION_FAILED' }, { status: 500 })
  }
}
