import { NextResponse } from 'next/server'
import { studioDefinitionIdSchema, studioPublishSchema, publishStudioDefinition } from '@/lib/process-automation/studio-service'
import { studioHttpError } from '@/lib/process-automation/studio-http'

export async function POST(request: Request, { params }: { params: Promise<{ definitionId: string }> }) {
  try {
    const id = studioDefinitionIdSchema.safeParse((await params).definitionId)
    if (!id.success) return NextResponse.json({ code: 'INVALID_PROCESS_DEFINITION_ID' }, { status: 400 })
    const body = studioPublishSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ code: 'INVALID_PROCESS_DEFINITION_PUBLISH', issues: body.error.issues }, { status: 400 })
    return NextResponse.json({ data: await publishStudioDefinition(id.data, body.data.expectedRevision, body.data.changelog) })
  } catch (error) {
    return studioHttpError(error)
  }
}
