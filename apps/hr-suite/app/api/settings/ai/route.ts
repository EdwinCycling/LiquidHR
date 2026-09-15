import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { AiExecutionError } from '@/lib/ai/contracts'
import { aiGroupSettingsInputSchema, getAiAdminSettings, updateAiAdminSettings } from '@/lib/ai/settings-service'

function failure(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof AiExecutionError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'AI_SETTINGS_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await getAiAdminSettings() })
  } catch (error) {
    return failure(error)
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const parsed = aiGroupSettingsInputSchema.safeParse(await request.json().catch(() => null) as unknown)
  if (!parsed.success) return NextResponse.json({ error: 'AI_SETTINGS_INPUT_INVALID' }, { status: 400 })
  try {
    return NextResponse.json({ data: await updateAiAdminSettings(parsed.data) })
  } catch (error) {
    return failure(error)
  }
}
