import { NextResponse } from 'next/server'
import { setupAssistantCompletionSchema } from '@/lib/setup-assistant/schemas'
import {
  setSetupStepCompletion,
  setupAssistantErrorResponse,
} from '@/lib/setup-assistant/service'

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'SETUP_ASSISTANT_INPUT_INVALID' }, { status: 400 })
  }

  const parsed = setupAssistantCompletionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'SETUP_ASSISTANT_INPUT_INVALID' }, { status: 400 })
  }

  try {
    await setSetupStepCompletion(parsed.data.stepKey, parsed.data.isCompleted)
    return NextResponse.json({ data: { saved: true } })
  } catch (error) {
    return setupAssistantErrorResponse(error)
  }
}
