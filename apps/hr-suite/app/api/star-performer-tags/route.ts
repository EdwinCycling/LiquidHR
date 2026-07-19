import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createStarPerformerTag, listStarPerformerTagCatalog, StarPerformerError } from '@/lib/star-performers/service'
import { starPerformerTagCreateSchema } from '@/lib/star-performers/schemas'

function failure(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof StarPerformerError) {
    return NextResponse.json({ code: error.code }, { status: error.status })
  }
  return null
}

export async function GET() {
  try {
    return NextResponse.json({ data: await listStarPerformerTagCatalog() })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const parsed = starPerformerTagCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ code: 'STAR_PERFORMER_TAG_INPUT_INVALID' }, { status: 400 })
    }
    return NextResponse.json({ data: { id: await createStarPerformerTag(parsed.data) } }, { status: 201 })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
