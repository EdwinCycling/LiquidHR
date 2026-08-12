import { NextResponse } from 'next/server'
import { journeyRuntime } from '@/lib/journeys'
import { journeyHttpError, journeyIdSchema, journeyTransitionSchema } from '@/lib/journeys/api'

export async function POST(request: Request, { params }: { params: Promise<{ journeyId: string }> }) {
  try {
    const id = journeyIdSchema.safeParse((await params).journeyId)
    const input = journeyTransitionSchema.safeParse(await request.json())
    if (!id.success || !input.success) return NextResponse.json({ error: 'JOURNEY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await journeyRuntime.transition(id.data, input.data.expectedVersion, input.data.action) })
  } catch (error) { return journeyHttpError(error) }
}
