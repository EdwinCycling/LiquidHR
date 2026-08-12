import { NextResponse } from 'next/server'
import { createJourneyTemplateSchema, journeyHttpError } from '@/lib/journeys/api'
import { journeyTemplates } from '@/lib/journeys'

export async function GET() {
  try { return NextResponse.json({ data: await journeyTemplates.listTemplates() }) }
  catch (error) { return journeyHttpError(error) }
}

export async function POST(request: Request) {
  try {
    const input = createJourneyTemplateSchema.safeParse(await request.json())
    if (!input.success) return NextResponse.json({ error: 'JOURNEY_TEMPLATE_INPUT_INVALID', issues: input.error.issues }, { status: 400 })
    return NextResponse.json({ data: await journeyTemplates.createTemplate(input.data) }, { status: 201 })
  } catch (error) { return journeyHttpError(error) }
}
