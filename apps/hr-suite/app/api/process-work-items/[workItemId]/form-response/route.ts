import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { formRuntimeErrorResponse, saveProcessFormResponse } from '@/lib/process-automation/form-runtime-service'
import { formValuesSchema } from '@/lib/process-automation/form-runtime'

interface Params {
  params: Promise<{ workItemId: string }>
}

const inputSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(),
  values: formValuesSchema,
  idempotencyKey: z.string().trim().min(1).max(200),
  correlationId: z.string().uuid().nullable().optional(),
  language: z.enum(['nl', 'en']).default('nl'),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'PROCESS_FORM_RUNTIME_INPUT_INVALID' }, { status: 400 })
    const { workItemId } = await params
    return NextResponse.json({ data: await saveProcessFormResponse({ workItemId, ...parsed.data }) })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? formRuntimeErrorResponse(error)
      ?? NextResponse.json({ code: 'PROCESS_FORM_RUNTIME_OPERATION_FAILED' }, { status: 500 })
  }
}
