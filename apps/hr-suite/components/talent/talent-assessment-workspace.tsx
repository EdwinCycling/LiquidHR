'use client'

import { useMemo, useState } from 'react'
import type { TalentAssessmentWorkspace } from '@/lib/talent/assessment-service'

type Mode = 'admin' | 'manager' | 'self'

type Labels = {
  title: string
  subtitle: string
  cycles: string
  noCycles: string
  selectCycle: string
  createCycle: string
  code: string
  name: string
  description: string
  opensOn: string
  closesOn: string
  itemTitle: string
  prompt: string
  maxScore: string
  create: string
  save: string
  submit: string
  status: string
  open: string
  close: string
  archive: string
  draft: string
  opened: string
  closed: string
  archived: string
  response: string
  self: string
  manager: string
  participant: string
  chooseParticipant: string
  answer: string
  privateNote: string
  privateNoteHint: string
  noItems: string
  noResponses: string
  responseStatus: string
  lock: string
  finalize: string
  reopen: string
  saved: string
  failed: string
  readOnly: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function inThirtyDays(): string {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString().slice(0, 10)
}

function responseKey(cycleId: string, responseType: string, subjectId: string | null): string {
  return `${cycleId}:${responseType}:${subjectId ?? 'self'}`
}

export function TalentAssessmentWorkspace({ mode, initial, labels }: { mode: Mode; initial: TalentAssessmentWorkspace; labels: Labels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(initial.cycles[0]?.id ?? null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initial.participants[0]?.id ?? null)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, Record<string, { score: string; answerText: string }>>>({})
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [cycleDraft, setCycleDraft] = useState({ code: '', name: '', description: '', opensOn: today(), closesOn: inThirtyDays(), itemTitle: '', prompt: '', maxScore: '5' })

  const selectedCycle = workspace.cycles.find((cycle) => cycle.id === selectedCycleId) ?? null
  const items = useMemo(() => workspace.items.filter((item) => item.cycle_id === selectedCycleId).sort((a, b) => a.sort_order - b.sort_order), [selectedCycleId, workspace.items])
  const responseType = mode === 'self' ? 'SELF' : 'MANAGER'
  const selectedResponse = workspace.responses.find((response) => responseKey(response.cycle_id, response.response_type, responseType === 'SELF' ? response.subject_employee_id : selectedSubjectId) === responseKey(selectedCycleId ?? '', responseType, responseType === 'SELF' ? response.subject_employee_id : selectedSubjectId)) ?? null
  const selectionKey = responseKey(selectedCycleId ?? '', responseType, responseType === 'SELF' ? selectedResponse?.subject_employee_id ?? null : selectedSubjectId)
  const defaultAnswers = useMemo(() => {
    const nextAnswers: Record<string, { score: string; answerText: string }> = {}
    for (const item of items) {
      const answer = selectedResponse?.answers.find((candidate) => candidate.item_id === item.id)
      nextAnswers[item.id] = { score: answer?.score === null || answer?.score === undefined ? '' : String(answer.score), answerText: answer?.answer_text ?? '' }
    }
    return nextAnswers
  }, [items, selectedResponse])
  const answers = answerDrafts[selectionKey] ?? defaultAnswers
  const privateNote = privateNotes[selectionKey] ?? selectedResponse?.privateNote ?? ''

  async function refresh() {
    const query = mode === 'self' ? '?responseType=SELF' : ''
    const response = await fetch(`/api/talent/assessments${query}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('read')
    const payload = await response.json() as { data: TalentAssessmentWorkspace }
    setWorkspace(payload.data)
    if (!selectedCycleId && payload.data.cycles[0]) setSelectedCycleId(payload.data.cycles[0].id)
    if (!selectedSubjectId && payload.data.participants[0]) setSelectedSubjectId(payload.data.participants[0].id)
  }

  async function createCycle() {
    setError(false); setMessage(null)
    const response = await fetch('/api/talent/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      code: cycleDraft.code,
      name: cycleDraft.name,
      description: cycleDraft.description || null,
      opensOn: cycleDraft.opensOn,
      closesOn: cycleDraft.closesOn,
      items: [{ title: cycleDraft.itemTitle, prompt: cycleDraft.prompt, sortOrder: 1, maxScore: Number(cycleDraft.maxScore), isRequired: true }],
    }) })
    if (!response.ok) { setError(true); setMessage(labels.failed); return }
    setCycleDraft({ code: '', name: '', description: '', opensOn: today(), closesOn: inThirtyDays(), itemTitle: '', prompt: '', maxScore: '5' })
    await refresh(); setMessage(labels.saved)
  }

  async function updateCycle(status: 'OPEN' | 'CLOSED' | 'ARCHIVED') {
    if (!selectedCycle) return
    setError(false); setMessage(null)
    const response = await fetch(`/api/talent/assessments/${selectedCycle.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: selectedCycle.version, status }) })
    if (!response.ok) { setError(true); setMessage(labels.failed); return }
    await refresh(); setMessage(labels.saved)
  }

  async function saveResponse(status: 'DRAFT' | 'SUBMITTED') {
    if (!selectedCycle || (mode === 'manager' && !selectedSubjectId)) return
    setError(false); setMessage(null)
    const response = await fetch('/api/talent/assessments/responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      cycleId: selectedCycle.id,
      responseId: selectedResponse?.id,
      responseType,
      subjectEmployeeId: mode === 'manager' ? selectedSubjectId : undefined,
      status,
      version: selectedResponse?.version,
      answers: items.map((item) => ({ itemId: item.id, score: answers[item.id]?.score ? Number(answers[item.id].score) : null, answerText: answers[item.id]?.answerText || null })),
      privateNote: mode === 'manager' ? privateNote || null : undefined,
    }) })
    if (!response.ok) { setError(true); setMessage(labels.failed); return }
    await refresh(); setMessage(labels.saved)
  }

  async function commandResponse(responseId: string, status: 'DRAFT' | 'LOCKED' | 'FINALIZED') {
    const response = workspace.responses.find((candidate) => candidate.id === responseId)
    if (!response) return
    setError(false); setMessage(null)
    const result = await fetch(`/api/talent/assessments/responses/${responseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, version: response.version }) })
    if (!result.ok) { setError(true); setMessage(labels.failed); return }
    await refresh(); setMessage(labels.saved)
  }

  return <section className="mt-6 space-y-5">
    <header className="rounded-2xl border bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
      {message ? <p className={`mt-3 text-sm ${error ? 'text-destructive' : 'text-primary'}`} role="status">{message}</p> : null}
    </header>

    {mode === 'admin' ? <div className="rounded-2xl border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">{labels.createCycle}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block">{labels.code}</span><input className="form-field" value={cycleDraft.code} onChange={(event) => setCycleDraft({ ...cycleDraft, code: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.name}</span><input className="form-field" value={cycleDraft.name} onChange={(event) => setCycleDraft({ ...cycleDraft, name: event.target.value })} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block">{labels.description}</span><textarea className="form-field min-h-20" value={cycleDraft.description} onChange={(event) => setCycleDraft({ ...cycleDraft, description: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.opensOn}</span><input className="form-field" type="date" value={cycleDraft.opensOn} onChange={(event) => setCycleDraft({ ...cycleDraft, opensOn: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.closesOn}</span><input className="form-field" type="date" value={cycleDraft.closesOn} onChange={(event) => setCycleDraft({ ...cycleDraft, closesOn: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.itemTitle}</span><input className="form-field" value={cycleDraft.itemTitle} onChange={(event) => setCycleDraft({ ...cycleDraft, itemTitle: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.maxScore}</span><input className="form-field" min="1" max="10" type="number" value={cycleDraft.maxScore} onChange={(event) => setCycleDraft({ ...cycleDraft, maxScore: event.target.value })} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block">{labels.prompt}</span><textarea className="form-field min-h-20" value={cycleDraft.prompt} onChange={(event) => setCycleDraft({ ...cycleDraft, prompt: event.target.value })} /></label>
      </div>
      <button className="button-primary mt-4" onClick={() => void createCycle()} type="button">{labels.create}</button>
    </div> : null}

    <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.65fr)_minmax(0,1.35fr)]">
      <nav aria-label={labels.cycles} className="space-y-2 rounded-2xl border bg-surface p-3 shadow-sm">
        <p className="px-2 pb-2 text-sm font-semibold">{labels.cycles}</p>
        {workspace.cycles.length === 0 ? <p className="p-2 text-sm text-muted-foreground">{labels.noCycles}</p> : workspace.cycles.map((cycle) => <button aria-pressed={cycle.id === selectedCycleId} className={`w-full rounded-xl border p-3 text-left ${cycle.id === selectedCycleId ? 'border-primary/40 bg-primary/5' : 'bg-background hover:border-primary/30'}`} key={cycle.id} onClick={() => setSelectedCycleId(cycle.id)} type="button"><span className="block text-sm font-semibold">{cycle.name}</span><span className="mt-1 block text-xs text-muted-foreground">{cycle.code} · {cycle.status}</span></button>)}
      </nav>

      {!selectedCycle ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.selectCycle}</p> : <div className="space-y-5 rounded-2xl border bg-surface p-5 shadow-sm">
        <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{selectedCycle.code}</p><h3 className="mt-1 text-xl font-semibold">{selectedCycle.name}</h3><p className="mt-1 text-sm text-muted-foreground">{selectedCycle.opens_on} – {selectedCycle.closes_on}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{selectedCycle.status}</span></header>
        {mode === 'admin' ? <div className="flex flex-wrap gap-2">{selectedCycle.status === 'DRAFT' ? <button className="button-secondary" onClick={() => void updateCycle('OPEN')} type="button">{labels.open}</button> : null}{selectedCycle.status === 'OPEN' ? <button className="button-secondary" onClick={() => void updateCycle('CLOSED')} type="button">{labels.close}</button> : null}{selectedCycle.status !== 'ARCHIVED' ? <button className="button-secondary" onClick={() => void updateCycle('ARCHIVED')} type="button">{labels.archive}</button> : null}</div> : null}
        {mode === 'manager' ? <label className="block text-sm"><span className="mb-1 block">{labels.participant}</span><select className="form-field" value={selectedSubjectId ?? ''} onChange={(event) => setSelectedSubjectId(event.target.value || null)}><option value="">{labels.chooseParticipant}</option>{workspace.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.label}</option>)}</select></label> : null}
        {mode !== 'admin' ? <div className="space-y-4">{items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noItems}</p> : items.map((item) => <div className="rounded-xl border bg-background p-4" key={item.id}><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.prompt}</p><div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]"><label className="text-sm"><span className="mb-1 block">{labels.answer} ({item.max_score})</span><input aria-label={`${labels.answer}: ${item.title}`} className="form-field" max={item.max_score} min="0" type="number" value={answers[item.id]?.score ?? ''} onChange={(event) => setAnswerDrafts({ ...answerDrafts, [selectionKey]: { ...answers, [item.id]: { score: event.target.value, answerText: answers[item.id]?.answerText ?? '' } } })} /></label><textarea aria-label={item.title} className="form-field min-h-20" placeholder={labels.answer} value={answers[item.id]?.answerText ?? ''} onChange={(event) => setAnswerDrafts({ ...answerDrafts, [selectionKey]: { ...answers, [item.id]: { score: answers[item.id]?.score ?? '', answerText: event.target.value } } })} /></div></div>)}
          {mode === 'manager' ? <label className="block text-sm"><span className="mb-1 block">{labels.privateNote}</span><textarea className="form-field min-h-24" placeholder={labels.privateNoteHint} value={privateNote} onChange={(event) => setPrivateNotes({ ...privateNotes, [selectionKey]: event.target.value })} /></label> : null}
          <div className="flex flex-wrap gap-2"><button className="button-secondary" onClick={() => void saveResponse('DRAFT')} type="button">{labels.save}</button><button className="button-primary" onClick={() => void saveResponse('SUBMITTED')} type="button">{labels.submit}</button></div>
          {selectedResponse ? <p className="text-xs text-muted-foreground">{labels.responseStatus}: {selectedResponse.status}</p> : null}
        </div> : <div className="space-y-3">{workspace.responses.filter((response) => response.cycle_id === selectedCycle.id).length === 0 ? <p className="text-sm text-muted-foreground">{labels.noResponses}</p> : workspace.responses.filter((response) => response.cycle_id === selectedCycle.id).map((response) => <div className="rounded-xl border bg-background p-4" key={response.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{response.subjectLabel ?? response.subject_employee_id}</p><p className="mt-1 text-xs text-muted-foreground">{response.response_type} · {response.status}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs">v{response.version}</span></div><div className="mt-3 flex flex-wrap gap-2">{response.status === 'SUBMITTED' ? <button className="button-secondary" onClick={() => void commandResponse(response.id, 'LOCKED')} type="button">{labels.lock}</button> : null}{response.status === 'LOCKED' ? <button className="button-primary" onClick={() => void commandResponse(response.id, 'FINALIZED')} type="button">{labels.finalize}</button> : null}{response.status === 'SUBMITTED' ? <button className="button-secondary" onClick={() => void commandResponse(response.id, 'DRAFT')} type="button">{labels.reopen}</button> : null}</div></div>)}</div>}
      </div>}
    </div>
    <p className="text-xs text-muted-foreground">{labels.readOnly}</p>
  </section>
}
