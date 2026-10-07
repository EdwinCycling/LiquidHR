import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { confirmActionDraft } from '@/lib/hera/action-drafts'
import { heRaErrorResponse } from '@/lib/hera/http-errors'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { controlledActionErrorResponse } from '@/lib/controlled-actions/http-errors'
import { controlledActions, findControlledActionDraft } from '@/lib/controlled-actions/service'

interface Params {
  params: Promise<{ draftId: string }>
}

const confirmSchema = z.object({
  expectedVersion: z.number().int().positive(),
  expectedPreviewHash: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
}).strict()

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'HERA_INPUT_INVALID' }, { status: 400 })
    }
    const context = await requireHeRaContext()
    const { draftId } = await params
    if (await findControlledActionDraft(context, draftId)) {
      if (!parsed.data.expectedPreviewHash) {
        return NextResponse.json({ error: 'CONTROLLED_ACTION_INPUT_INVALID' }, { status: 400 })
      }
      const result = await controlledActions.confirm(context, {
        draftId,
        expectedVersion: parsed.data.expectedVersion,
        expectedPreviewHash: parsed.data.expectedPreviewHash,
      })
      return NextResponse.json({ data: {
        status: result.draft.status,
        version: result.draft.version,
        confirmedAt: result.draft.confirmedAt,
        controlPayload: result.draft.controlPayload,
      } })
    }
    const data = await confirmActionDraft(context, {
      draftId,
      expectedVersion: parsed.data.expectedVersion,
    })
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? controlledActionErrorResponse(error)
      ?? heRaErrorResponse(error)
      ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
