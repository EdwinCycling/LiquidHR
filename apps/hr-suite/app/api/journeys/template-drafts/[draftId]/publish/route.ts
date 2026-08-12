import { NextResponse } from 'next/server'
import { journeyHttpError, journeyIdSchema, publishJourneyTemplateSchema } from '@/lib/journeys/api'
import { journeyTemplates } from '@/lib/journeys'

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const id = journeyIdSchema.safeParse((await params).draftId)
    const input = publishJourneyTemplateSchema.safeParse(await request.json())
    if (!id.success || !input.success) return NextResponse.json({ error: 'JOURNEY_TEMPLATE_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await journeyTemplates.publishJourneyTemplate(id.data, input.data.expectedRevision) })
  } catch (error) { return journeyHttpError(error) }
}
