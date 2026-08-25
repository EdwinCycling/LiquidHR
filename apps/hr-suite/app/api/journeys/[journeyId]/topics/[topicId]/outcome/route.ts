import { NextResponse } from 'next/server'
import { z } from 'zod'
import { JourneyProjectionServiceError } from '@/lib/journeys/projection-service'
import { recordJourneyParticipantProgress } from '@/lib/journeys/participant-service'
import { journeyIdSchema } from '@/lib/journeys/api'

const outcomeSchema = z.object({
  outcomeType: z.enum(['COMPLETE', 'SKIP', 'CHECK_IN']),
  note: z.string().trim().max(500).optional(),
}).strict()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ journeyId: string; topicId: string }> },
) {
  try {
    const routeParams = await params
    const journeyId = journeyIdSchema.safeParse(routeParams.journeyId)
    const topicId = journeyIdSchema.safeParse(routeParams.topicId)
    let payload: unknown
    try { payload = await request.json() } catch { return NextResponse.json({ error: 'JOURNEY_TOPIC_OUTCOME_INPUT_INVALID' }, { status: 400 }) }
    const body = outcomeSchema.safeParse(payload)
    if (!journeyId.success || !topicId.success || !body.success) return NextResponse.json({ error: 'JOURNEY_TOPIC_OUTCOME_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await recordJourneyParticipantProgress({ journeyId: journeyId.data, topicId: topicId.data, outcomeType: body.data.outcomeType, note: body.data.note }) })
  } catch (error) {
    if (error instanceof JourneyProjectionServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
    return NextResponse.json({ error: 'JOURNEY_TOPIC_OUTCOME_FAILED' }, { status: 500 })
  }
}
