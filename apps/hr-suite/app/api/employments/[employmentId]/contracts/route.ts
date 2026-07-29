import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { employmentContractMutationSchema } from '@/lib/employment/contract-schemas'
import {
  EmploymentDetailError,
  manageEmploymentContract,
} from '@/lib/employment/employment-detail-service'

interface RouteContext { params: Promise<{ employmentId: string }> }
const editSchema = z.object({
  contractId: z.string().uuid(),
  input: employmentContractMutationSchema,
}).strict()

function fail(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmploymentDetailError) {
    return NextResponse.json({ code: error.code }, { status: error.status })
  }
  return null
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employmentId } = await context.params
    const parsed = employmentContractMutationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'CONTRACT_INPUT_INVALID' }, { status: 400 })
    const contractId = await manageEmploymentContract(employmentId, null, parsed.data)
    return NextResponse.json({ data: { contractId } }, { status: 201 })
  } catch (error) {
    const response = fail(error)
    if (response) return response
    throw error
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employmentId } = await context.params
    const parsed = editSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'CONTRACT_INPUT_INVALID' }, { status: 400 })
    const { contractId, input } = parsed.data
    await manageEmploymentContract(employmentId, contractId, input)
    return NextResponse.json({ data: { contractId } })
  } catch (error) {
    const response = fail(error)
    if (response) return response
    throw error
  }
}
