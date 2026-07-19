import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { StarPerformerError, updateStarPerformerTag } from '@/lib/star-performers/service'
import { starPerformerTagUpdateSchema } from '@/lib/star-performers/schemas'

function failure(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof StarPerformerError) {
    return NextResponse.json({ code: error.code }, { status: error.status })
  }
  return null
}

export async function PATCH(request: Request, context: { params: Promise<{ tagId: string }> }) {
  try {
    const { tagId } = await context.params
    const parsed = starPerformerTagUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ code: 'STAR_PERFORMER_TAG_INPUT_INVALID' }, { status: 400 })
    }
    return NextResponse.json({ data: { id: await updateStarPerformerTag(tagId, parsed.data) } })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
