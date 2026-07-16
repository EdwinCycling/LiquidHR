import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { chainAssessmentRequestSchema } from '@/lib/employment/detail-schemas'
import { assessProposedEmploymentChain, EmploymentDetailError } from '@/lib/employment/employment-detail-service'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = chainAssessmentRequestSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    const { employeeId } = await context.params
    return NextResponse.json({ data: await assessProposedEmploymentChain(employeeId, parsed.data) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmploymentDetailError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
