import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { getAbsenceSettingsPageData, updateAbsenceSettings } from '@/lib/absence/settings-service'

function errorResponse(error: unknown): NextResponse {
  const permissionResponse = permissionErrorResponse(error)
  if (permissionResponse) return permissionResponse
  if (error instanceof ZodError) return NextResponse.json({ error: 'ABSENCE_SETTINGS_INPUT_INVALID' }, { status: 400 })
  if (error instanceof Error && (error.message === 'ABSENCE_SETTINGS_ADMINISTRATION_REQUIRED' || error.message === 'ABSENCE_SETTINGS_CASE_MANAGER_INVALID')) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ error: 'ABSENCE_SETTINGS_WRITE_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getAbsenceSettingsPageData())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const rawBody: unknown = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json()
    await updateAbsenceSettings(rawBody)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return PATCH(request)
}
