import { NextResponse } from 'next/server'
import { journeyRuntime } from '@/lib/journeys'
import { journeyHttpError, journeyIdSchema, journeyParticipantReplacementSchema } from '@/lib/journeys/api'

export async function POST(request: Request, { params }: { params: Promise<{ journeyId: string; participantId: string }> }) {
  try {
    const route = await params
    const journeyId = journeyIdSchema.safeParse(route.journeyId)
    const participantId = journeyIdSchema.safeParse(route.participantId)
    const input = journeyParticipantReplacementSchema.safeParse(await request.json())
    if (!journeyId.success || !participantId.success || !input.success) return NextResponse.json({ error: 'JOURNEY_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await journeyRuntime.replaceParticipant(journeyId.data, participantId.data, input.data.replacementEmployeeId, input.data.expectedVersion, input.data.reason) })
  } catch (error) { return journeyHttpError(error) }
}
