import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getAssignedRecruitmentApplication } from '@/lib/recruitment/guided-service'
import { ParticipantScorecard, type ScorecardInterview } from '@/components/recruitment/participant-scorecard'

const scoreSchema = z.object({ characteristicId: z.string(), score: z.number().int(), note: z.string().nullable() })
const assessmentSchema = z.object({ id: z.string(), status: z.string(), version: z.number().int(), scores: z.array(scoreSchema) }).nullable()
const interviewSchema = z.object({ interviewId: z.string(), title: z.string(), scheduledAt: z.string().nullable(), criteria: z.array(z.object({ title: z.string(), characteristicId: z.string(), content: z.record(z.string(), z.unknown()).optional() })), ownAssessment: assessmentSchema, peerAssessments: z.array(z.record(z.string(), z.unknown())) })

export default async function AssignedRecruitmentDetailPage({ params }: { readonly params: Promise<{ applicationId: string }> }) {
  try { await requireTenantModule('RECRUITMENT'); await requirePermission('recruitment-participation:read') } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const { applicationId } = await params
  const [detail, t] = await Promise.all([getAssignedRecruitmentApplication(applicationId), getTranslator('recruitment')])
  if (!detail) notFound()
  const interviews: ScorecardInterview[] = detail.interviews.flatMap((raw) => {
    const parsed = interviewSchema.safeParse(raw)
    if (!parsed.success) return []
    return [{ id: parsed.data.interviewId, title: parsed.data.title, scheduledAt: parsed.data.scheduledAt, criteria: parsed.data.criteria.map((criterion) => ({ characteristicId: criterion.characteristicId, title: criterion.title, anchorText: typeof criterion.content?.anchors === 'object' && criterion.content.anchors !== null ? Object.values(criterion.content.anchors).join(' · ') : '' })), ownAssessment: parsed.data.ownAssessment }]
  })
  return <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10"><Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/recruitment/assigned">← {t('guided.back')}</Link><header className="mt-6"><p className="eyebrow">{t('guided.eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{detail.candidateName}</h1><p className="mt-2 text-sm text-muted-foreground">{detail.vacancyTitle} · {detail.stageName ?? '—'}</p></header><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-6"><section className="rounded-2xl border bg-surface p-5"><h2 className="font-semibold">{t('guided.motivation')}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{detail.motivation ?? '—'}</p></section><section className="rounded-2xl border bg-surface p-5"><h2 className="font-semibold">{t('guided.interviews')}</h2>{interviews.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t('guided.noInterviews')}</p> : <ul className="mt-3 space-y-3">{interviews.map((interview) => <li className="rounded-xl border p-4" key={interview.id}><p className="font-medium">{interview.title}</p>{interview.scheduledAt ? <p className="mt-1 text-xs text-muted-foreground">{t('guided.scheduledAt')}: {interview.scheduledAt}</p> : null}</li>)}</ul>}</section></div><div><ParticipantScorecard interviews={interviews} labels={{ title: t('guided.scorecard'), description: t('guided.scorecardDescription'), saveDraft: t('guided.saveDraft'), submit: t('guided.submit'), submitted: t('guided.submitted'), score: t('guided.score'), note: t('guided.note'), scheduledAt: t('guided.scheduledAt') }} /></div></div></main>
}
