import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { confirmActionDraft } from '@/lib/hera/action-drafts'
import { heRaErrorResponse } from '@/lib/hera/http-errors'
import { requireHeRaContext } from '@/lib/hera/request-context'

interface Params {
  params: Promise<{ draftId: string }>
}

const confirmSchema = z.object({
  expectedVersion: z.number().int().positive(),
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
    const data = await confirmActionDraft(context, {
      draftId,
      expectedVersion: parsed.data.expectedVersion,
    })
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? heRaErrorResponse(error)
      ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
