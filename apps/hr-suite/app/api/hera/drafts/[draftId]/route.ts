import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { cancelActionDraft } from '@/lib/hera/action-drafts'
import { heRaErrorResponse } from '@/lib/hera/http-errors'
import { requireHeRaContext } from '@/lib/hera/request-context'

interface Params {
  params: Promise<{ draftId: string }>
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext()
    const { draftId } = await params
    await cancelActionDraft(context, draftId)
    return NextResponse.json({ data: { id: draftId, status: 'CANCELLED' } })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? heRaErrorResponse(error)
      ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
