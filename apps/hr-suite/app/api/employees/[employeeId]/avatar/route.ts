import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { deleteEmployeeAvatar, EmployeeServiceError, getEmployeeAvatar, uploadEmployeeAvatar } from '@/lib/employees/employee-service'

interface RouteContext { params: Promise<{ employeeId: string }> }

function failure(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmployeeServiceError) return NextResponse.json({ code: error.code }, { status: error.status })
  return NextResponse.json({ code: 'EMPLOYEE_AVATAR_FAILED' }, { status: 500 })
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { employeeId } = await context.params
    const avatar = await getEmployeeAvatar(employeeId)
    if (!avatar) return new NextResponse(null, { status: 404 })
    if ('url' in avatar) return NextResponse.redirect(avatar.url)
    return new NextResponse(avatar.body, { headers: { 'content-type': avatar.contentType, 'cache-control': 'private, max-age=60' } })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return NextResponse.json({ code: 'EMPLOYEE_AVATAR_INPUT_INVALID' }, { status: 400 })
    await uploadEmployeeAvatar(employeeId, file)
    return NextResponse.json({ data: { uploaded: true } })
  } catch (error) {
    return failure(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { employeeId } = await context.params
    await deleteEmployeeAvatar(employeeId)
    return NextResponse.json({ data: { removed: true } })
  } catch (error) {
    return failure(error)
  }
}
