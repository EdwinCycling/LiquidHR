import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { jobFamilyUpdateSchema } from '@/lib/talent/schemas'
import { deleteJobFamily, TalentServiceError, updateJobFamily } from '@/lib/talent/service'

function failure(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof TalentServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'JOB_FAMILY_FAILED' }, { status: 500 })
}

export async function PATCH(request: Request, context: { params: Promise<{ familyId: string }> }) {
  try {
    const parsed = jobFamilyUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await updateJobFamily((await context.params).familyId, parsed.data) } })
  } catch (error) { return failure(error) }
}

export async function DELETE(_request: Request, context: { params: Promise<{ familyId: string }> }) {
  try {
    return NextResponse.json({ data: { id: await deleteJobFamily((await context.params).familyId) } })
  } catch (error) { return failure(error) }
}
