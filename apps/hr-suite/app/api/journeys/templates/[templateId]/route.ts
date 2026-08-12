import { NextResponse } from 'next/server'
import { journeyHttpError, journeyIdSchema } from '@/lib/journeys/api'
import { journeyTemplates } from '@/lib/journeys'

export async function GET(_request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const id = journeyIdSchema.safeParse((await params).templateId)
    if (!id.success) return NextResponse.json({ error: 'JOURNEY_TEMPLATE_ID_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await journeyTemplates.getTemplate(id.data) })
  } catch (error) { return journeyHttpError(error) }
}
