import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryStructureMigrationConflictSchema } from '@/lib/salary-structures/schemas'
import {
  resolveSalaryStructureMigrationConflict,
  SalaryStructureError,
} from '@/lib/salary-structures/service'

interface RouteContext { params: Promise<{ conflictId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { conflictId } = await context.params
    const parsed = salaryStructureMigrationConflictSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    await resolveSalaryStructureMigrationConflict(conflictId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof SalaryStructureError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
