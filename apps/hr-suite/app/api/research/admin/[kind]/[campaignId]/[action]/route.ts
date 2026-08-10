import { NextResponse } from 'next/server'
import { activateResearchCampaign, closeResearchCampaign, remindResearchParticipants, type ResearchKind } from '@/lib/research/admin-service'
import { researchErrorResponse } from '@/lib/research/errors'
import { researchReminderSchema } from '@/lib/research/schemas'

interface RouteContext {
  params: Promise<{ kind: string; campaignId: string; action: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { kind, campaignId, action } = await params
    if (kind !== 'survey' && kind !== 'enps') return NextResponse.json({ error: 'RESEARCH_KIND_INVALID' }, { status: 400 })
    const researchKind: ResearchKind = kind
    if (action === 'activate') return NextResponse.json({ invited: await activateResearchCampaign(researchKind, campaignId) })
    if (action === 'close') {
      await closeResearchCampaign(researchKind, campaignId)
      return NextResponse.json({ closed: true })
    }
    if (action === 'remind') {
      const input = researchReminderSchema.parse(await request.json().catch(() => ({})))
      return NextResponse.json({ reminded: await remindResearchParticipants(researchKind, campaignId, input.employeeId) })
    }
    return NextResponse.json({ error: 'RESEARCH_ACTION_INVALID' }, { status: 400 })
  } catch (error) {
    return researchErrorResponse(error)
  }
}
