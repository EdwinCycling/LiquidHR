import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  commitInternalTransfer,
  internalTransferErrorResponse,
} from '@/lib/process-automation/internal-transfer-service'

interface Params { params: Promise<{ workItemId: string }> }

const inputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  stepExpectedVersion: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: z.string().uuid().nullable().optional(),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'INTERNAL_TRANSFER_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    return NextResponse.json({ data: await commitInternalTransfer({ workItemId, ...parsed.data, stepExpectedVersion: parsed.data.stepExpectedVersion ?? null, correlationId: parsed.data.correlationId ?? null }) })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? internalTransferErrorResponse(error)
      ?? NextResponse.json({ code: 'INTERNAL_TRANSFER_OPERATION_FAILED' }, { status: 500 })
  }
}
