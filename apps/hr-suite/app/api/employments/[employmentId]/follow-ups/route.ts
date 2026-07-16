import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { followUpSchema } from '@/lib/employment/detail-schemas'
import { createFollowUp, EmploymentDetailError } from '@/lib/employment/employment-detail-service'

interface RouteContext { params: Promise<{ employmentId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = followUpSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    const { employmentId } = await context.params
    return NextResponse.json({ data: await createFollowUp(employmentId, parsed.data) }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmploymentDetailError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
