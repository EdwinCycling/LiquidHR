import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  createEmployment,
  EmploymentServiceError,
  listEmployeeEmployments,
} from '@/lib/employment/employment-service'
import { createEmploymentRequestSchema } from '@/lib/employment/schemas'

interface RouteContext {
  params: Promise<{ employeeId: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const data = await listEmployeeEmployments(employeeId)
    return NextResponse.json({ data })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const parsed = createEmploymentRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    }
    const result = await createEmployment({ ...parsed.data, employeeId })
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}
