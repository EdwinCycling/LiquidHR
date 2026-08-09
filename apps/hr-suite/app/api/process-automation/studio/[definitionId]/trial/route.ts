import { NextResponse } from 'next/server'
import { runStudioTrial, studioDefinitionIdSchema, studioTrialSchema } from '@/lib/process-automation/studio-service'
import { studioHttpError } from '@/lib/process-automation/studio-http'

export async function POST(request: Request, { params }: { params: Promise<{ definitionId: string }> }) {
  try {
    const id = studioDefinitionIdSchema.safeParse((await params).definitionId)
    if (!id.success) return NextResponse.json({ code: 'INVALID_PROCESS_DEFINITION_ID' }, { status: 400 })
    const body = studioTrialSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ code: 'INVALID_PROCESS_TRIAL', issues: body.error.issues }, { status: 400 })
    return NextResponse.json({ data: await runStudioTrial(id.data, body.data) })
  } catch (error) {
    return studioHttpError(error, 'PROCESS_TRIAL_FAILED')
  }
}
