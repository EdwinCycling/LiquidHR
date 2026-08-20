import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryStructurePublishSchema } from '@/lib/salary-structures/schemas'
import { publishSalaryStructureRevision, SalaryStructureError } from '@/lib/salary-structures/service'

interface RouteContext { params: Promise<{ revisionId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const { revisionId } = await context.params
    const parsed = salaryStructurePublishSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await publishSalaryStructureRevision(revisionId, parsed.data.expectedLockVersion) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof SalaryStructureError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
