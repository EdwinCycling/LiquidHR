import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { talentComparisonListQuerySchema } from '@/lib/talent/comparison-schemas'
import { TalentComparisonError, listTalentComparisonWorkspace } from '@/lib/talent/comparison-service'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = talentComparisonListQuerySchema.safeParse({
      employeeId: url.searchParams.get('employeeId') ?? undefined,
      profileVersionId: url.searchParams.get('profileVersionId') ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await listTalentComparisonWorkspace(parsed.data) })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentComparisonError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'TALENT_COMPARISON_READ_FAILED' }, { status: 500 })
  }
}
