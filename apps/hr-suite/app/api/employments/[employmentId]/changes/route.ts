import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { combinedTimelineMutationSchema } from '@/lib/employment/detail-schemas'
import { applyCombinedTimelineMutation, EmploymentDetailError } from '@/lib/employment/employment-detail-service'

interface RouteContext { params: Promise<{ employmentId: string }> }

function errorResponse(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmploymentDetailError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employmentId } = await context.params
    const parsed = combinedTimelineMutationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    const changeSetId = await applyCombinedTimelineMutation(employmentId, parsed.data)
    return NextResponse.json({ data: { changeSetId } }, { status: 201 })
  } catch (error) {
    const response = errorResponse(error)
    if (response) return response
    throw error
  }
}
