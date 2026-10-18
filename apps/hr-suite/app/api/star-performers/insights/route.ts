import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { starPerformerWorkspaceQuerySchema } from '@/lib/star-performers/schemas'
import { StarPerformerError } from '@/lib/star-performers/service'
import { getStarPerformersInsights } from '@/lib/star-performers/v2-service'

function failure(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof StarPerformerError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const parsed = starPerformerWorkspaceQuerySchema.safeParse({
      perspective: searchParams.get('perspective') ?? undefined,
      area: searchParams.get('area') ?? undefined,
      insight: searchParams.get('insight') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      jobId: searchParams.get('jobId') ?? undefined,
      jobGroupId: searchParams.get('jobGroupId') ?? undefined,
      period: searchParams.get('period') ?? undefined,
      periodFrom: searchParams.get('periodFrom') ?? undefined,
      periodTo: searchParams.get('periodTo') ?? undefined,
      appraisalStatus: searchParams.get('appraisalStatus') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ code: 'STAR_PERFORMER_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await getStarPerformersInsights(parsed.data) })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
