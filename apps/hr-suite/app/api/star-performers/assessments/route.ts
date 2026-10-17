import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { saveStarPerformerAssessment, StarPerformerError } from '@/lib/star-performers/service'
import { starPerformerAssessmentSchema, starPerformerWorkspaceQuerySchema } from '@/lib/star-performers/schemas'
import { getStarPerformersDetail, listStarPerformersWorkspacePage } from '@/lib/star-performers/v2-service'

const employeeIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function failure(error: unknown) {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof StarPerformerError) {
    return NextResponse.json({ code: error.code }, { status: error.status })
  }
  return null
}

export async function POST(request: Request) {
  try {
    const parsed = starPerformerAssessmentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ code: 'STAR_PERFORMER_INPUT_INVALID' }, { status: 400 })
    }
    return NextResponse.json({ data: await saveStarPerformerAssessment(parsed.data) }, { status: 201 })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const employeeId = searchParams.get('employeeId')
    if (employeeId) {
      if (!employeeIdPattern.test(employeeId)) return NextResponse.json({ code: 'STAR_PERFORMER_INPUT_INVALID' }, { status: 400 })
      return NextResponse.json({ data: await getStarPerformersDetail(employeeId) })
    }
    const parsed = starPerformerWorkspaceQuerySchema.safeParse({
      perspective: searchParams.get('perspective') ?? undefined,
      area: searchParams.get('area') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      jobId: searchParams.get('jobId') ?? undefined,
      jobGroupId: searchParams.get('jobGroupId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ code: 'STAR_PERFORMER_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listStarPerformersWorkspacePage(parsed.data) })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
