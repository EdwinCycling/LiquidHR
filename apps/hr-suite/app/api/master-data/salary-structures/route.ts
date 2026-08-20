import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryStructureCreateSchema } from '@/lib/salary-structures/schemas'
import { createSalaryStructure, listSalaryStructureCatalog, SalaryStructureError } from '@/lib/salary-structures/service'

function failure(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof SalaryStructureError) return NextResponse.json({ code: error.code }, { status: error.status })
  return null
}

export async function GET() {
  try {
    return NextResponse.json({ data: await listSalaryStructureCatalog() })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const parsed = salaryStructureCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await createSalaryStructure(parsed.data) } }, { status: 201 })
  } catch (error) {
    const response = failure(error)
    if (response) return response
    throw error
  }
}
