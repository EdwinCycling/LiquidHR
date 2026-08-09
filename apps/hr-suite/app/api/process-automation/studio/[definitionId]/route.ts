import { NextResponse } from 'next/server'
import { studioDefinitionIdSchema, getStudioDefinition } from '@/lib/process-automation/studio-service'
import { studioHttpError } from '@/lib/process-automation/studio-http'

export async function GET(_request: Request, { params }: { params: Promise<{ definitionId: string }> }) {
  try {
    const parsed = studioDefinitionIdSchema.safeParse((await params).definitionId)
    if (!parsed.success) return NextResponse.json({ code: 'INVALID_PROCESS_DEFINITION_ID' }, { status: 400 })
    return NextResponse.json({ data: await getStudioDefinition(parsed.data) })
  } catch (error) {
    return studioHttpError(error, 'PROCESS_DEFINITION_READ_FAILED')
  }
}
