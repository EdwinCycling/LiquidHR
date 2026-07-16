import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmploymentServiceError, terminateEmployment } from '@/lib/employment/employment-service'
import { terminationSchema } from '@/lib/employment/schemas'

interface RouteContext {
  params: Promise<{ employmentId: string }>
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employmentId } = await context.params
    const parsed = terminationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ code: 'TERMINATION_INPUT_INVALID' }, { status: 400 })
    }
    const terminationId = await terminateEmployment(employmentId, parsed.data)
    return NextResponse.json({ data: { terminationId } }, { status: 201 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}
