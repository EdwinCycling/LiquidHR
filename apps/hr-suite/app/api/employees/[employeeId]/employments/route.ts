import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  EmploymentServiceError,
  listEmployeeEmployments,
  publishCompleteEmployment,
} from '@/lib/employment/employment-service'
import { completeEmploymentCreateSchema } from '@/lib/employment/schemas'

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
    const body: unknown = await request.json()
    const envelope = z.object({
      administrationId: z.string().uuid().optional(),
      input: completeEmploymentCreateSchema,
    }).strict().safeParse(body)
    const direct = completeEmploymentCreateSchema.safeParse(body)
    const parsed = envelope.success ? envelope.data.input : direct.data
    const administrationId = envelope.success ? envelope.data.administrationId : undefined
    if (!parsed) {
      return NextResponse.json({ code: 'EMPLOYMENT_INPUT_INVALID' }, { status: 400 })
    }
    const employmentId = await publishCompleteEmployment(employeeId, parsed, administrationId)
    return NextResponse.json({ data: { employmentId } }, { status: 201 })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof EmploymentServiceError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}
