import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createEmployeeProfileLink } from '@/lib/employees/employee-profile-links-service'
import { profileLinkSchema } from '@/lib/employment/detail-schemas'

interface RouteContext { params: Promise<{ employeeId: string }> }

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = profileLinkSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'PROFILE_LINK_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createEmployeeProfileLink((await context.params).employeeId, parsed.data) }, { status: 201 })
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return permission
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PROFILE_LINK_CREATE_FAILED' }, { status: 500 })
  }
}
