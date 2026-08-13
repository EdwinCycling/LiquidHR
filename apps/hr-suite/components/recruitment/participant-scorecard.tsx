'use client'

import { useState } from 'react'

export interface ScorecardCriterion { readonly characteristicId: string; readonly title: string; readonly anchorText: string }
export interface ScorecardInterview { readonly id: string; readonly title: string; readonly scheduledAt: string | null; readonly criteria: readonly ScorecardCriterion[]; readonly ownAssessment: { readonly id: string; readonly status: string; readonly version: number; readonly scores: readonly { readonly characteristicId: string; readonly score: number; readonly note: string | null }[] } | null }

interface Props { readonly interviews: readonly ScorecardInterview[]; readonly labels: { readonly title: string; readonly description: string; readonly saveDraft: string; readonly submit: string; readonly submitted: string; readonly score: string; readonly note: string; readonly scheduledAt: string } }

async function getPayload(response: Response): Promise<{ readonly id: string; readonly status?: string; readonly version?: number }> {
  const payload = await response.json() as { readonly data?: { readonly id: string; readonly status?: string; readonly version?: number } }
  if (!response.ok || !payload.data) throw new Error('RECRUITMENT_ASSESSMENT_FAILED')
  return payload.data
}

export function ParticipantScorecard({ interviews, labels }: Props) {
  const [activeInterview, setActiveInterview] = useState(interviews[0]?.id ?? null)
  const [scores, setScores] = useState<Record<string, { score: number; note: string }>>(() => Object.fromEntries((interviews[0]?.ownAssessment?.scores ?? []).map((score) => [score.characteristicId, { score: score.score, note: score.note ?? '' }])))
  const [feedback, setFeedback] = useState<string | null>(null)
  const interview = interviews.find((item) => item.id === activeInterview) ?? null
  if (!interview) return null
  const selectedInterview = interview

  function selectInterview(id: string) {
    const next = interviews.find((item) => item.id === id)
    setActiveInterview(id)
    setScores(Object.fromEntries((next?.ownAssessment?.scores ?? []).map((score) => [score.characteristicId, { score: score.score, note: score.note ?? '' }])))
    setFeedback(null)
  }

  async function save(submit: boolean) {
    setFeedback(null)
    const payload = { interviewId: selectedInterview.id, scores: Object.entries(scores).map(([characteristicId, value]) => ({ characteristicId, score: value.score, note: value.note || null })) }
    try {
      const draft = await getPayload(await fetch('/api/recruitment/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
      if (submit && draft.id) await getPayload(await fetch(`/api/recruitment/assessments/${draft.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: draft.version ?? 1 }) }))
      setFeedback(submit ? labels.submitted : labels.saveDraft)
    } catch { setFeedback('') }
  }

  return <section className="rounded-2xl border bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div>{interviews.length > 1 ? <label className="text-sm"><span className="sr-only">{labels.title}</span><select className="input" onChange={(event) => selectInterview(event.target.value)} value={activeInterview ?? ''}>{interviews.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label> : null}</div><div className="mt-5 space-y-4">{selectedInterview.criteria.map((criterion) => <div className="rounded-xl border p-4" key={criterion.characteristicId}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{criterion.title}</p><p className="mt-1 text-xs text-muted-foreground">{criterion.anchorText}</p></div><label className="text-sm"><span className="sr-only">{labels.score}</span><select className="input" onChange={(event) => setScores((current) => ({ ...current, [criterion.characteristicId]: { score: Number(event.target.value), note: current[criterion.characteristicId]?.note ?? '' } }))} value={scores[criterion.characteristicId]?.score ?? ''}><option value="">—</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label className="mt-3 block text-sm"><span className="text-muted-foreground">{labels.note}</span><textarea className="input mt-1 min-h-20 w-full" onChange={(event) => setScores((current) => ({ ...current, [criterion.characteristicId]: { score: current[criterion.characteristicId]?.score ?? 1, note: event.target.value } }))} value={scores[criterion.characteristicId]?.note ?? ''} /></label></div>)}</div><div className="mt-5 flex flex-wrap items-center gap-3"><button className="button-secondary" onClick={() => save(false)} type="button">{labels.saveDraft}</button><button className="button-primary" onClick={() => save(true)} type="button">{labels.submit}</button>{feedback ? <span aria-live="polite" className="text-sm text-muted-foreground">{feedback}</span> : null}</div></section>
}
