import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { laborConditionSalaryStructuresSchema } from '@/lib/salary-structures/schemas'
import { replaceLaborConditionSalaryStructures, SalaryStructureError } from '@/lib/salary-structures/service'

interface RouteContext { params: Promise<{ laborConditionSetId: string }> }

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { laborConditionSetId } = await context.params
    const parsed = laborConditionSalaryStructuresSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { count: await replaceLaborConditionSalaryStructures(laborConditionSetId, parsed.data.salaryStructureIds) } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof SalaryStructureError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
