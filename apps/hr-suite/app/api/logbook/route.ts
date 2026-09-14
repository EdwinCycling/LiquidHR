import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { createAiTeamSummaryLogbookEntry, createManualPersonalLogbookEntry, listPersonalLogbookEntries, LogbookServiceError } from '@/lib/logbook/service'
import { aiTeamSummaryLogbookEntryCreateSchema, personalLogbookEntryCreateSchema } from '@/lib/logbook/schemas'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const requestedLimit = new URL(request.url).searchParams.get('limit')
    const parsedLimit = requestedLimit && /^\d+$/.test(requestedLimit) ? Number(requestedLimit) : 200
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 200
    return NextResponse.json({ data: await listPersonalLogbookEntries(limit) })
  } catch (error) {
    return logbookError(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null) as unknown
    if (typeof body === 'object' && body !== null && 'sessionId' in body) {
      const parsed = aiTeamSummaryLogbookEntryCreateSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'LOGBOOK_INPUT_INVALID' }, { status: 400 })
      return NextResponse.json({ data: await createAiTeamSummaryLogbookEntry(parsed.data) }, { status: 201 })
    }
    const parsed = personalLogbookEntryCreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'LOGBOOK_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await createManualPersonalLogbookEntry(parsed.data) }, { status: 201 })
  } catch (error) {
    return logbookError(error)
  }
}

function logbookError(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof LogbookServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'LOGBOOK_OPERATION_FAILED' }, { status: 500 })
}
