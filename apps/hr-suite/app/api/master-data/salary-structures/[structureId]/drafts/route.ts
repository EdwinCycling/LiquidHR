import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { salaryStructureDraftSaveSchema } from '@/lib/salary-structures/schemas'
import { createSalaryStructureDraft, SalaryStructureError, saveSalaryStructureDraft } from '@/lib/salary-structures/service'

interface RouteContext { params: Promise<{ structureId: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const { structureId } = await context.params
    const parsed = salaryStructureDraftSaveSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SALARY_STRUCTURE_INPUT_INVALID' }, { status: 400 })
    const result = parsed.data.draftId === null
      ? await createSalaryStructureDraft(structureId, parsed.data.draft)
      : await saveSalaryStructureDraft(structureId, parsed.data.draftId, parsed.data.expectedLockVersion ?? 0, parsed.data.draft)
    return NextResponse.json({ data: result }, { status: parsed.data.draftId === null ? 201 : 200 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof SalaryStructureError) return NextResponse.json({ code: error.code }, { status: error.status })
    throw error
  }
}
