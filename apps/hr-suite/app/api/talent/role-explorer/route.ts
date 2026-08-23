import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireAnyPermission } from '@/lib/auth/permissions'
import { talentRoleExplorerListQuerySchema } from '@/lib/talent/role-explorer-schemas'
import { TalentRoleExplorerError, listTalentRoleExplorerWorkspace } from '@/lib/talent/role-explorer-service'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = talentRoleExplorerListQuerySchema.safeParse({ employeeId: url.searchParams.get('employeeId') ?? undefined, profileVersionId: url.searchParams.get('profileVersionId') ?? undefined })
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const context = await requireAnyPermission(['talent:manage', 'talent-comparison:read'])
    const workspace = await listTalentRoleExplorerWorkspace(context.permissions.includes('talent:manage') ? 'admin' : 'manager', parsed.data)
    return NextResponse.json({ data: workspace })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    if (error instanceof TalentRoleExplorerError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'TALENT_ROLE_EXPLORER_READ_FAILED' }, { status: 500 })
  }
}
