import { NextResponse } from 'next/server'
import { journeyRuntime } from '@/lib/journeys'
import { journeyHttpError } from '@/lib/journeys/api'

export async function GET() {
  try { return NextResponse.json({ data: await journeyRuntime.startOptions() }) }
  catch (error) { return journeyHttpError(error) }
}
