import { NextResponse } from 'next/server'
import { journeyHttpError, journeyIdSchema } from '@/lib/journeys/api'
import { journeyTemplates } from '@/lib/journeys'

export async function POST(_request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const id = journeyIdSchema.safeParse((await params).templateId)
    if (!id.success) return NextResponse.json({ error: 'JOURNEY_TEMPLATE_ID_INVALID' }, { status: 400 })
    await journeyTemplates.retireTemplate(id.data)
    return NextResponse.json({ data: { id: id.data, lifecycle: 'RETIRED' } })
  } catch (error) { return journeyHttpError(error) }
}
