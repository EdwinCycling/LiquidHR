'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Save, ShieldCheck } from 'lucide-react'
import type { getTeamCompassAssessment } from '@/lib/team-compass/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Surface } from '@/components/ui/surface'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'

type Assessment = Awaited<ReturnType<typeof getTeamCompassAssessment>>

export type TeamCompassAssessmentLabels = Record<
  'assessmentTitle' | 'assessmentIntro' | 'questionProgress' | 'innerPrompt' | 'outerPrompt' | 'scoreRarely' |
  'scoreSometimes' | 'scoreOften' | 'previous' | 'next' | 'saveProgress' | 'review' | 'reviewTitle' |
  'reviewComplete' | 'shareOuter' | 'shareOuterHelp' | 'shareInner' | 'shareInnerHelp' | 'submit' |
  'responseSaved' | 'responseCompleted' | 'failed' | 'disclaimer' | 'privacyTitle', string
>

type ScorePair = { innerScore?: number; outerScore?: number }

export function TeamCompassAssessment({ initial, labels, locale }: { initial: Assessment; labels: TeamCompassAssessmentLabels; locale: 'nl' | 'en' }) {
  const router = useRouter()
  const initialScores = Object.fromEntries(initial.answers.map((answer) => [answer.question_id, { innerScore: answer.inner_score, outerScore: answer.outer_score }])) as Record<string, ScorePair>
  const [scores, setScores] = useState<Record<string, ScorePair>>(initialScores)
  const firstIncomplete = initial.questions.findIndex((question) => !initialScores[question.id]?.innerScore || !initialScores[question.id]?.outerScore)
  const [index, setIndex] = useState(firstIncomplete < 0 ? 0 : firstIncomplete)
  const [review, setReview] = useState(initial.questions.length > 0 && firstIncomplete < 0)
  const [version, setVersion] = useState(initial.participation.version)
  const [shareOuter, setShareOuter] = useState(initial.participation.share_outer_profile)
  const [shareInner, setShareInner] = useState(initial.participation.share_inner_profile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const question = initial.questions[index]
  const answeredCount = useMemo(() => initial.questions.filter((item) => scores[item.id]?.innerScore && scores[item.id]?.outerScore).length, [initial.questions, scores])
  const current = question ? scores[question.id] ?? {} : {}

  function choose(layer: 'innerScore' | 'outerScore', value: number): void {
    if (!question) return
    setScores((previous) => ({ ...previous, [question.id]: { ...previous[question.id], [layer]: value } }))
  }

  function payload(submit: boolean) {
    return { expectedVersion: version, answers: initial.questions.flatMap((item) => { const answer = scores[item.id]; return answer?.innerScore && answer.outerScore ? [{ questionId: item.id, innerScore: answer.innerScore, outerScore: answer.outerScore }] : [] }), submit, shareOuter, shareInner }
  }

  async function save(submit: boolean): Promise<void> {
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/team-compass/participations/${initial.participation.id}/response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(submit)) })
      const result = await response.json() as { data?: { version?: number }; error?: string }
      if (!response.ok) { setMessage(labels.failed); return }
      setVersion(result.data?.version ?? version + 1)
      setMessage(submit ? labels.responseCompleted : labels.responseSaved)
      if (submit) router.push(`/team-compass/results/${initial.participation.id}`)
    } finally { setSaving(false) }
  }

  if (!question) return null
  return <PageShell className="min-h-full space-y-5 py-6 sm:py-10" width="reading">
    <PageHeader description={initial.campaign.name} title={labels.assessmentTitle} />
    <div className="flex items-center justify-between gap-3"><Badge>{answeredCount}/40</Badge><div aria-hidden="true" className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(answeredCount / 40) * 100}%` }} /></div></div>
    <Surface className="flex gap-3 p-4 text-sm" variant="subtle"><ShieldCheck aria-hidden="true" className="shrink-0 text-primary" size={19} /><p><strong>{labels.privacyTitle}.</strong> {labels.disclaimer}</p></Surface>
    {message ? <p aria-live="polite" className="border border-border-subtle bg-surface-subtle p-3 text-sm">{message}</p> : null}
    {!review ? <Surface className="p-5 sm:p-8"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.questionProgress.replace('{current}', String(index + 1)).replace('{total}', String(initial.questions.length))}</p><h2 className="mx-auto mt-6 max-w-xl text-center text-xl font-semibold leading-8 sm:text-2xl">“{locale === 'nl' ? question.prompt_nl : question.prompt_en}”</h2><div className="mt-8 space-y-8"><ScoreChoice label={labels.innerPrompt} value={current.innerScore} labels={labels} onChange={(value) => choose('innerScore', value)} /><ScoreChoice label={labels.outerPrompt} value={current.outerScore} labels={labels} onChange={(value) => choose('outerScore', value)} /></div></Surface> : <Surface className="p-6 sm:p-8"><div className="flex items-center gap-3"><Badge tone="success"><Check aria-hidden="true" /></Badge><div><h2 className="text-xl font-semibold">{labels.reviewTitle}</h2><p className="text-sm text-muted-foreground">{labels.reviewComplete}</p></div></div><div className="mt-6 grid gap-3"><Checkbox checked={shareOuter} description={labels.shareOuterHelp} label={labels.shareOuter} onChange={(event) => { setShareOuter(event.target.checked); if (!event.target.checked) setShareInner(false) }} /><Checkbox checked={shareInner} description={labels.shareInnerHelp} disabled={!shareOuter} label={labels.shareInner} onChange={(event) => setShareInner(event.target.checked)} /></div></Surface>}
    <footer className="flex flex-wrap items-center justify-between gap-3"><Button disabled={saving || (!review && index === 0)} onClick={() => review ? setReview(false) : setIndex((value) => value - 1)} type="button" variant="secondary"><ArrowLeft aria-hidden="true" size={16} />{labels.previous}</Button><div className="flex flex-wrap justify-end gap-2"><Button disabled={saving || answeredCount === 0} onClick={() => void save(false)} type="button" variant="secondary"><Save aria-hidden="true" size={16} />{labels.saveProgress}</Button>{review ? <Button disabled={saving || answeredCount !== 40} loading={saving} onClick={() => void save(true)} type="button">{labels.submit}<Check aria-hidden="true" size={16} /></Button> : <Button disabled={!current.innerScore || !current.outerScore} onClick={() => index === initial.questions.length - 1 ? setReview(true) : setIndex((value) => value + 1)} type="button">{index === initial.questions.length - 1 ? labels.review : labels.next}<ArrowRight aria-hidden="true" size={16} /></Button>}</div></footer>
  </PageShell>
}

function ScoreChoice({ label, value, labels, onChange }: { label: string; value?: number; labels: TeamCompassAssessmentLabels; onChange(value: number): void }) {
  return <fieldset><legend className="mb-3 text-sm font-semibold">{label}</legend><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((score) => <Button aria-pressed={value === score} className="min-h-12 w-full" key={score} onClick={() => onChange(score)} type="button" variant={value === score ? 'primary' : 'secondary'}>{score}</Button>)}</div><div className="mt-2 flex justify-between text-[0.68rem] text-muted-foreground"><span>{labels.scoreRarely}</span><span>{labels.scoreSometimes}</span><span>{labels.scoreOften}</span></div></fieldset>
}
