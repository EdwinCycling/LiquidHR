import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  CustomFieldServiceError,
  getEmployeeCustomFieldValues,
  setEmployeeCustomFieldValues,
} from '@/lib/custom-fields/service'
import { customFieldValuesSchema } from '@/lib/custom-fields/schemas'

function handleError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof CustomFieldServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'CUSTOM_FIELD_VALUES_FAILED' }, { status: 500 })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> },
): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await getEmployeeCustomFieldValues((await params).employeeId) })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> },
): Promise<NextResponse> {
  try {
    const parsed = customFieldValuesSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'CUSTOM_FIELD_VALUES_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await setEmployeeCustomFieldValues((await params).employeeId, parsed.data) })
  } catch (error) {
    return handleError(error)
  }
}
