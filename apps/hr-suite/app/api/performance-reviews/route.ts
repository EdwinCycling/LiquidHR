import { NextResponse } from 'next/server'
import {
  acknowledgePerformanceReview,
  addPerformanceReviewDossier,
  createPerformanceReviewRound,
  publishPerformanceReviewRound,
  saveManagerResponse,
  saveAdditionalReviewerContribution,
  savePrivateNote,
  saveSelfReflection,
  listPerformanceReviewWorkspace,
  listPerformanceReviewHistory,
} from '@/lib/performance-reviews/service'
import { performanceReviewErrorResponse } from '@/lib/performance-reviews/route'

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const employeeId = params.get('employeeId')
    if (employeeId) return NextResponse.json({ items: await listPerformanceReviewHistory(employeeId) })
    const role = params.get('role')
    const workspaceRole = role === 'employee' || role === 'manager' || role === 'additional-reviewer' ? role : 'hr'
    return NextResponse.json({ items: await listPerformanceReviewWorkspace(workspaceRole) })
  } catch (error) { return performanceReviewErrorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { action?: string; dossierId?: string; version?: number; body?: string; reason?: string; decision?: 'AGREE' | 'DISAGREE'; privateNote?: string; title?: string; introduction?: string; roundType?: string; periodStart?: string; periodEnd?: string; startDate?: string; dueDate?: string | null; rating?: { scale?: number; options?: Array<{ score: number; label: string; description: string }> } | null; additionalReviewerEnabled?: boolean; questionSets?: { enabled: boolean; defaults: { EMPLOYEE: string | null; GV: string | null; AB: string | null }; overrides?: Record<string, unknown> }; participants?: Array<{ employeeId: string; reviewerEmployeeId?: string; additionalReviewerEmployeeId?: string | null; administrationId?: string; questionSetOverrides?: unknown }>; employeeIds?: string[]; reviewerEmployeeId?: string; administrationId?: string; meetingDate?: string | null; score?: number; ratingExplanation?: string; questionAnswers?: unknown }
    if (input.action === 'save-draft' || input.action === 'publish') {
      const scale = input.rating?.scale
      const rating = input.rating?.options?.length ? { options: input.rating.options } : scale === 4 || scale === 5 || scale === 10 ? { options: Array.from({ length: scale }, (_, index) => ({ score: index + 1, label: `Niveau ${index + 1}`, description: `Niveau ${index + 1}` })) } : null
      const requestKey = request.headers.get('Idempotency-Key')
      if (!requestKey) return NextResponse.json({ error: 'PERFORMANCE_IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 })
      const round = await createPerformanceReviewRound({ title: input.title, introduction: input.introduction, roundType: input.roundType, periodStart: input.periodStart, periodEnd: input.periodEnd, startDate: input.startDate, dueDate: input.dueDate ?? null, rating, additionalReviewerEnabled: input.additionalReviewerEnabled === true, questionSets: input.questionSets }, `${requestKey}:round`) as { id?: string; version?: number }
      if (input.action === 'publish' && round.id) {
        const participants: Array<{ employeeId: string; reviewerEmployeeId?: string; additionalReviewerEmployeeId?: string | null; administrationId?: string; questionSetOverrides?: unknown }> = input.participants ?? (input.employeeIds ?? []).map((employeeId) => ({ employeeId, reviewerEmployeeId: input.reviewerEmployeeId, administrationId: input.administrationId }))
        if (participants.length === 0) return NextResponse.json({ error: 'PERFORMANCE_PARTICIPANTS_REQUIRED' }, { status: 400 })
        for (const participant of participants) await addPerformanceReviewDossier(round.id, participant.employeeId, participant.reviewerEmployeeId, participant.administrationId, `${requestKey}:dossier:${participant.employeeId}`, participant.additionalReviewerEmployeeId, participant.questionSetOverrides)
        return NextResponse.json(await publishPerformanceReviewRound(round.id, round.version ?? 1, `${requestKey}:publish`), { status: 201 })
      }
      return NextResponse.json(round, { status: 201 })
    }
    if (!input.dossierId || typeof input.version !== 'number') return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_INPUT' }, { status: 400 })
    if (input.action === 'save-self' || input.action === 'submit-self') return NextResponse.json(await saveSelfReflection(input.dossierId, input.version, input.body ?? '', input.action === 'submit-self', input.questionAnswers))
    if (input.action === 'save-manager' || input.action === 'submit-manager') return NextResponse.json(await saveManagerResponse(input.dossierId, { version: input.version, body: input.body ?? '', meetingDate: input.meetingDate ?? null, score: input.score, ratingExplanation: input.ratingExplanation }, input.action === 'submit-manager', input.questionAnswers))
    if (input.action === 'save-additional-reviewer' || input.action === 'submit-additional-reviewer') return NextResponse.json(await saveAdditionalReviewerContribution(input.dossierId, { version: input.version, body: input.body ?? '' }, input.action === 'submit-additional-reviewer', input.questionAnswers))
    if (input.action === 'save-private-note') return NextResponse.json(await savePrivateNote(input.dossierId, input.privateNote ?? '', input.version))
    if (input.action === 'acknowledge') return NextResponse.json(await acknowledgePerformanceReview(input.dossierId, input.decision === 'DISAGREE' ? { version: input.version, decision: 'DISAGREE', reason: input.reason ?? '' } : { version: input.version, decision: 'AGREE' }))
    return NextResponse.json({ error: 'PERFORMANCE_REVIEW_INVALID_ACTION' }, { status: 400 })
  } catch (error) { return performanceReviewErrorResponse(error) }
}
