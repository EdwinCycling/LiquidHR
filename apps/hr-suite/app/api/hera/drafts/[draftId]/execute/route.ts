import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { controlledActionErrorResponse } from '@/lib/controlled-actions/http-errors'
import { controlledActions, findControlledActionDraft } from '@/lib/controlled-actions/service'
import { requireHeRaContext } from '@/lib/hera/request-context'

interface Params { params: Promise<{ draftId: string }> }

const executeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  expectedPreviewHash: z.string().regex(/^[0-9a-f]{64}$/i),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = executeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'CONTROLLED_ACTION_INPUT_INVALID' }, { status: 400 })
    const context = await requireHeRaContext()
    const { draftId } = await params
    if (!await findControlledActionDraft(context, draftId)) {
      return NextResponse.json({ error: 'CONTROLLED_ACTION_NOT_FOUND' }, { status: 404 })
    }
    const result = await controlledActions.execute(context, {
      draftId,
      expectedVersion: parsed.data.expectedVersion,
      expectedPreviewHash: parsed.data.expectedPreviewHash,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? controlledActionErrorResponse(error)
      ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
