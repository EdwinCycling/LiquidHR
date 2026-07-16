import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { OrganizationServiceError, updateDepartment } from '@/lib/organization/management-service'
import { departmentUpdateSchema } from '@/lib/organization/schemas'

export async function PATCH(request: Request, { params }: { params: Promise<{ departmentId: string }> }): Promise<NextResponse> {
  try {
    const parsed = departmentUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'DEPARTMENT_INPUT_INVALID' }, { status: 400 })
    await updateDepartment((await params).departmentId, parsed.data)
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    const permission = permissionErrorResponse(error); if (permission) return permission
    if (error instanceof OrganizationServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'DEPARTMENT_UPDATE_FAILED' }, { status: 500 })
  }
}
