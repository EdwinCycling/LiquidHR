import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { rollbackTimelineSchema, timelineMutationSchema } from '@/lib/employment/detail-schemas'
import { applyTimelineMutation, EmploymentDetailError, rollbackTimeline } from '@/lib/employment/employment-detail-service'

interface RouteContext { params: Promise<{ employmentId: string; timeline: string }> }
const timelines = ['LABOR_CONDITIONS', 'SCHEDULE', 'SALARY', 'COST_ALLOCATION'] as const

function timelineValue(value: string): (typeof timelines)[number] | null {
  return timelines.find((timeline) => timeline === value) ?? null
}

function errorResponse(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmploymentDetailError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employmentId, timeline } = await context.params
    const parsed = timelineMutationSchema.safeParse({ ...(await request.json()), timeline })
    if (!parsed.success) return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { changeSetId: await applyTimelineMutation(employmentId, parsed.data) } }, { status: 201 })
  } catch (error) {
    const response = errorResponse(error)
    if (response) return response
    throw error
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employmentId, timeline } = await context.params
    const resolvedTimeline = timelineValue(timeline)
    const parsed = rollbackTimelineSchema.safeParse(await request.json())
    if (!resolvedTimeline || !parsed.success) return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { changeSetId: await rollbackTimeline(employmentId, resolvedTimeline, parsed.data) } })
  } catch (error) {
    const response = errorResponse(error)
    if (response) return response
    throw error
  }
}
