import { NextResponse } from 'next/server'
import { researchErrorResponse } from '@/lib/research/errors'
import { researchSubmissionSchema } from '@/lib/research/schemas'
import { submitResearchResponse } from '@/lib/research/respondent-service'

interface RouteContext {
  params: Promise<{ kind: string; invitationId: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { kind, invitationId } = await params
    if (kind !== 'survey' && kind !== 'enps') return NextResponse.json({ error: 'RESEARCH_KIND_INVALID' }, { status: 400 })
    const parsed = researchSubmissionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'RESEARCH_ANSWERS_INVALID', issues: parsed.error.issues }, { status: 400 })
    return NextResponse.json({ responseId: await submitResearchResponse(kind, invitationId, parsed.data) }, { status: 201 })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
