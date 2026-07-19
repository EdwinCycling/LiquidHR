import { NextResponse } from 'next/server'
import { workPatternPublishSchema } from '@/lib/work-patterns/schemas'
import { listEmploymentWorkPatterns, publishEmploymentWorkPattern, workPatternErrorResponse } from '@/lib/work-patterns/work-pattern-service'

type RouteContext = { params: Promise<{ employmentId: string }> }

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try { return NextResponse.json({ data: await listEmploymentWorkPatterns((await context.params).employmentId) }) }
  catch (error) { return workPatternErrorResponse(error) }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const parsed = workPatternPublishSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'WORK_PATTERN_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: { id: await publishEmploymentWorkPattern((await context.params).employmentId, parsed.data) } }, { status: 201 })
  } catch (error) { return workPatternErrorResponse(error) }
}
