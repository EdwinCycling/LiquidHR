import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { databaseUuid } from '@/lib/validation/database-uuid'
import {
  EmploymentDetailError,
  manageEmploymentOrganization,
} from '@/lib/employment/employment-detail-service'

interface RouteContext { params: Promise<{ employmentId: string }> }
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const inputSchema = z.object({
  contractId: databaseUuid.nullish(),
  effectiveOn: dateOnly,
  departmentId: databaseUuid,
  jobId: databaseUuid,
  placementId: databaseUuid.nullish(),
}).strict()

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'ORGANIZATION_INPUT_INVALID' }, { status: 400 })
    const { employmentId } = await context.params
    const { placementId, ...input } = parsed.data
    const id = await manageEmploymentOrganization(employmentId, placementId ?? null, input)
    return NextResponse.json({ data: { id } }, { status: placementId ? 200 : 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof EmploymentDetailError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }
}
