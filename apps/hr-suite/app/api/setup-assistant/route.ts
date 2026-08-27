import { NextResponse } from 'next/server'
import { setupAssistantEnabledSchema } from '@/lib/setup-assistant/schemas'
import {
  getSetupAssistantState,
  setSetupAssistantEnabled,
  setupAssistantErrorResponse,
} from '@/lib/setup-assistant/service'

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await getSetupAssistantState() })
  } catch (error) {
    return setupAssistantErrorResponse(error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'SETUP_ASSISTANT_INPUT_INVALID' }, { status: 400 })
  }

  const parsed = setupAssistantEnabledSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'SETUP_ASSISTANT_INPUT_INVALID' }, { status: 400 })
  }

  try {
    await setSetupAssistantEnabled(parsed.data.isEnabled)
    return NextResponse.json({ data: { saved: true } })
  } catch (error) {
    return setupAssistantErrorResponse(error)
  }
}
