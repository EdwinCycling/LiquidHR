'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Save, ShieldCheck } from 'lucide-react'
import type { getTeamCompassAssessment } from '@/lib/team-compass/service'

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

  function choose(layer: 'innerScore' | 'outerScore', value: number) {
    if (!question) return
    setScores((previous) => ({ ...previous, [question.id]: { ...previous[question.id], [layer]: value } }))
  }

  function payload(submit: boolean) {
    return {
      expectedVersion: version,
      answers: initial.questions.flatMap((item) => {
        const answer = scores[item.id]
        return answer?.innerScore && answer.outerScore ? [{ questionId: item.id, innerScore: answer.innerScore, outerScore: answer.outerScore }] : []
      }),
      submit,
      shareOuter,
      shareInner,
    }
  }

  async function save(submit: boolean) {
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/team-compass/participations/${initial.participation.id}/response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(submit)) })
      const result = await response.json() as { data?: { version?: number }; error?: string }
      if (!response.ok) { setMessage(labels.failed); return }
      setVersion(result.data?.version ?? version + 1)
      setMessage(submit ? labels.responseCompleted : labels.responseSaved)
      if (submit) router.push(`/team-compass/results/${initial.participation.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!question) return null
  return <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10"><header className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{initial.campaign.name}</p><h1 className="mt-1 text-2xl font-semibold">{labels.assessmentTitle}</h1></div><div className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">{answeredCount}/40</div></header><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answeredCount / 40) * 100}%` }} /></div><div className="mt-5 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><ShieldCheck className="shrink-0 text-primary" size={19} /><p><strong>{labels.privacyTitle}.</strong> {labels.disclaimer}</p></div>{message ? <p aria-live="polite" className="mt-4 rounded-xl bg-muted p-3 text-sm">{message}</p> : null}
    {!review ? <main className="mt-6 rounded-3xl border bg-surface p-5 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.questionProgress.replace('{current}', String(index + 1)).replace('{total}', String(initial.questions.length))}</p><h2 className="mx-auto mt-6 max-w-xl text-center text-xl font-semibold leading-8 sm:text-2xl">“{locale === 'nl' ? question.prompt_nl : question.prompt_en}”</h2><div className="mt-8 space-y-8"><ScoreChoice label={labels.innerPrompt} value={current.innerScore} labels={labels} onChange={(value) => choose('innerScore', value)} /><ScoreChoice label={labels.outerPrompt} value={current.outerScore} labels={labels} onChange={(value) => choose('outerScore', value)} /></div></main> : <main className="mt-6 rounded-3xl border bg-surface p-6 shadow-sm sm:p-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-success/10 text-success"><Check /></span><div><h2 className="text-xl font-semibold">{labels.reviewTitle}</h2><p className="text-sm text-muted-foreground">{labels.reviewComplete}</p></div></div><div className="mt-6 space-y-4"><label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><input checked={shareOuter} className="mt-1" onChange={(event) => { setShareOuter(event.target.checked); if (!event.target.checked) setShareInner(false) }} type="checkbox" /><span><strong className="block text-sm">{labels.shareOuter}</strong><span className="mt-1 block text-xs text-muted-foreground">{labels.shareOuterHelp}</span></span></label><label className={`flex items-start gap-3 rounded-xl border p-4 ${shareOuter ? 'cursor-pointer' : 'opacity-50'}`}><input checked={shareInner} className="mt-1" disabled={!shareOuter} onChange={(event) => setShareInner(event.target.checked)} type="checkbox" /><span><strong className="block text-sm">{labels.shareInner}</strong><span className="mt-1 block text-xs text-muted-foreground">{labels.shareInnerHelp}</span></span></label></div></main>}
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3"><button className="button-secondary" disabled={saving || (!review && index === 0)} onClick={() => review ? setReview(false) : setIndex((value) => value - 1)} type="button"><ArrowLeft size={16} />{labels.previous}</button><div className="flex flex-wrap justify-end gap-2"><button className="button-secondary" disabled={saving || answeredCount === 0} onClick={() => void save(false)} type="button"><Save size={16} />{labels.saveProgress}</button>{review ? <button className="button-primary" disabled={saving || answeredCount !== 40} onClick={() => void save(true)} type="button">{labels.submit}<Check size={16} /></button> : <button className="button-primary" disabled={!current.innerScore || !current.outerScore} onClick={() => index === initial.questions.length - 1 ? setReview(true) : setIndex((value) => value + 1)} type="button">{index === initial.questions.length - 1 ? labels.review : labels.next}<ArrowRight size={16} /></button>}</div></footer>
  </div>
}

function ScoreChoice({ label, value, labels, onChange }: { label: string; value?: number; labels: TeamCompassAssessmentLabels; onChange(value: number): void }) {
  return <fieldset><legend className="mb-3 text-sm font-semibold">{label}</legend><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((score) => <button aria-pressed={value === score} className={`min-h-12 rounded-xl border text-sm font-semibold transition ${value === score ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background hover:border-primary/50 hover:bg-primary/5'}`} key={score} onClick={() => onChange(score)} type="button">{score}</button>)}</div><div className="mt-2 flex justify-between text-[0.68rem] text-muted-foreground"><span>{labels.scoreRarely}</span><span>{labels.scoreSometimes}</span><span>{labels.scoreOften}</span></div></fieldset>
}
