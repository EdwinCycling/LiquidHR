import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryStructureUpdateSchema } from '@/lib/salary-structures/schemas'
import { SalaryStructureError, updateSalaryStructure } from '@/lib/salary-structures/service'

interface RouteContext { params: Promise<{ structureId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { structureId } = await context.params
    if (!z.guid().safeParse(structureId).success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    const parsed = salaryStructureUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    await updateSalaryStructure(structureId, parsed.data)
    return NextResponse.json({ data: { id: structureId } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof SalaryStructureError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
