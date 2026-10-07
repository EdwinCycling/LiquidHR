import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { cancelActionDraft } from '@/lib/hera/action-drafts'
import { heRaErrorResponse } from '@/lib/hera/http-errors'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { controlledActionErrorResponse } from '@/lib/controlled-actions/http-errors'
import { controlledActions, findControlledActionDraft } from '@/lib/controlled-actions/service'

interface Params {
  params: Promise<{ draftId: string }>
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext()
    const { draftId } = await params
    if (await findControlledActionDraft(context, draftId)) {
      const result = await controlledActions.cancel(context, draftId)
      return NextResponse.json({ data: {
        id: result.draft.id,
        status: result.draft.status,
        version: result.draft.version,
      } })
    }
    await cancelActionDraft(context, draftId)
    return NextResponse.json({ data: { id: draftId, status: 'CANCELLED' } })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? controlledActionErrorResponse(error)
      ?? heRaErrorResponse(error)
      ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
