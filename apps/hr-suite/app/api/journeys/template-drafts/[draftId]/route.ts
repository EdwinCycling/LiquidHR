import { NextResponse } from 'next/server'
import { journeyHttpError, journeyIdSchema, saveJourneyTemplateSchema } from '@/lib/journeys/api'
import { journeyTemplates } from '@/lib/journeys'

export async function PUT(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const id = journeyIdSchema.safeParse((await params).draftId)
    const input = saveJourneyTemplateSchema.safeParse(await request.json())
    if (!id.success || !input.success) return NextResponse.json({ error: 'JOURNEY_TEMPLATE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await journeyTemplates.saveTemplate(id.data, input.data.expectedRevision, input.data.draft) })
  } catch (error) { return journeyHttpError(error) }
}
