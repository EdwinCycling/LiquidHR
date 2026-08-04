import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { EmployeeDirectoryError, getEmployeeDirectorySettings, updateEmployeeDirectorySettings } from '@/lib/employee-directory/service'

function errorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ZodError) return NextResponse.json({ error: 'EMPLOYEE_DIRECTORY_SETTINGS_INVALID' }, { status: 400 })
  if (error instanceof EmployeeDirectoryError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'EMPLOYEE_DIRECTORY_SETTINGS_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getEmployeeDirectorySettings())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await updateEmployeeDirectorySettings(await request.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
