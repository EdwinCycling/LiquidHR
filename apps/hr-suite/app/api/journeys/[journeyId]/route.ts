import { NextResponse } from 'next/server'
import { journeyRuntime } from '@/lib/journeys'
import { journeyHttpError, journeyIdSchema } from '@/lib/journeys/api'

export async function GET(_request: Request, { params }: { params: Promise<{ journeyId: string }> }) {
  try {
    const id = journeyIdSchema.safeParse((await params).journeyId)
    if (!id.success) return NextResponse.json({ error: 'JOURNEY_ID_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await journeyRuntime.get(id.data) })
  } catch (error) { return journeyHttpError(error) }
}
