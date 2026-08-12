import { NextResponse } from 'next/server'
import { journeyRuntime } from '@/lib/journeys'
import { journeyActivateSchema, journeyHttpError } from '@/lib/journeys/api'

export async function POST(request: Request) {
  try {
    const input = journeyActivateSchema.safeParse(await request.json())
    if (!input.success) return NextResponse.json({ error: 'JOURNEY_INPUT_INVALID', issues: input.error.issues }, { status: 400 })
    return NextResponse.json({ data: await journeyRuntime.activate(input.data) }, { status: 201 })
  } catch (error) { return journeyHttpError(error) }
}
