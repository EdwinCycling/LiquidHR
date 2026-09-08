'use client'

import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useState, type FormEvent, type ReactElement } from 'react'
import { AiResultSurface } from '@/components/patterns/ai-result-surface'

export interface VacancyFormSection {
  readonly sectionType: string
  readonly title: string
  readonly content: string
  readonly sortOrder: number
  readonly isVisible: boolean
}

export interface VacancyFormInitial {
  readonly id?: string
  readonly version?: number
  readonly title?: string
  readonly locationLabel?: string | null
  readonly workMode?: 'ON_SITE' | 'HYBRID' | 'REMOTE' | null
  readonly minHours?: number | null
  readonly maxHours?: number | null
  readonly salaryMin?: number | null
  readonly salaryMax?: number | null
  readonly salaryVisible?: boolean
  readonly sections?: readonly VacancyFormSection[]
}

export interface VacancyFormLabels {
  readonly title: string
  readonly location: string
  readonly workMode: string
  readonly onSite: string
  readonly hybrid: string
  readonly remote: string
  readonly hours: string
  readonly salary: string
  readonly salaryVisible: string
  readonly sections: string
  readonly sectionHint: string
  readonly save: string
  readonly saving: string
  readonly cancel: string
  readonly saved: string
  readonly invalid: string
  readonly aiTitle: string
  readonly aiDescription: string
  readonly aiTarget: string
  readonly aiInstruction: string
  readonly aiInstructionPlaceholder: string
  readonly aiGenerate: string
  readonly aiWorking: string
  readonly aiReviewTitle: string
  readonly aiApply: string
  readonly aiCancel: string
  readonly aiCopy: string
  readonly aiCopied: string
  readonly aiRetry: string
  readonly aiFailed: string
  readonly aiTargets: Record<VacancyAiTarget, string>
}

type VacancyAiTarget = 'ALL' | 'INTRODUCTION' | 'ROLE' | 'PROFILE' | 'OFFER' | 'PROCESS' | 'CONTACT'

const defaultSections: VacancyFormSection[] = [
  { sectionType: 'INTRODUCTION', title: 'Over de functie', content: '', sortOrder: 0, isVisible: true },
  { sectionType: 'ROLE', title: 'Jouw rol', content: '', sortOrder: 1, isVisible: true },
  { sectionType: 'PROFILE', title: 'Wat breng je mee?', content: '', sortOrder: 2, isVisible: true },
  { sectionType: 'OFFER', title: 'Wat bieden wij?', content: '', sortOrder: 3, isVisible: true },
  { sectionType: 'PROCESS', title: 'Sollicitatieprocedure', content: '', sortOrder: 4, isVisible: true },
  { sectionType: 'CONTACT', title: 'Aanvullende informatie', content: '', sortOrder: 5, isVisible: true },
]

export function VacancyForm({ aiAvailable, initial, labels, locale }: { readonly aiAvailable: boolean; readonly initial?: VacancyFormInitial; readonly labels: VacancyFormLabels; readonly locale: 'nl' | 'en' }): ReactElement {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [locationLabel, setLocationLabel] = useState(initial?.locationLabel ?? '')
  const [workMode, setWorkMode] = useState(initial?.workMode ?? '')
  const [minHours, setMinHours] = useState(initial?.minHours?.toString() ?? '')
  const [maxHours, setMaxHours] = useState(initial?.maxHours?.toString() ?? '')
  const [salaryMin, setSalaryMin] = useState(initial?.salaryMin?.toString() ?? '')
  const [salaryMax, setSalaryMax] = useState(initial?.salaryMax?.toString() ?? '')
  const [salaryVisible, setSalaryVisible] = useState(initial?.salaryVisible ?? false)
  const [sections, setSections] = useState<VacancyFormSection[]>([...(initial?.sections ?? defaultSections)])
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'ERROR' | 'SAVED'>('IDLE')
  const [aiTarget, setAiTarget] = useState<VacancyAiTarget>('INTRODUCTION')
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiState, setAiState] = useState<'IDLE' | 'LOADING' | 'ERROR' | 'SUCCESS'>('IDLE')
  const [aiProposal, setAiProposal] = useState<string | null>(null)

  async function generateAiText(): Promise<void> {
    if (aiState === 'LOADING') return
    setAiState('LOADING')
    setAiProposal(null)
    const vacancy = { title, locationLabel, workMode: workMode || null, minHours: minHours ? Number(minHours) : null, maxHours: maxHours ? Number(maxHours) : null, sections: sections.map(({ sectionType, title: sectionTitle, content, isVisible }) => ({ sectionType, title: sectionTitle, content, isVisible })) }
    const body = { ...(initial?.id ? { vacancyId: initial.id } : { vacancy }), targetSection: aiTarget, instruction: aiInstruction.trim() || undefined, locale }
    const response = await fetch('/api/recruitment/vacancies/draft', { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `vacancy-ai-${Date.now()}` }, body: JSON.stringify(body) }).catch(() => null)
    const payload: unknown = await response?.json().catch(() => null)
    const data = typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? (payload as { data?: unknown }).data : null
    if (!response?.ok || typeof data !== 'object' || data === null || Array.isArray(data) || typeof (data as { proposedText?: unknown }).proposedText !== 'string') { setAiState('ERROR'); return }
    setAiProposal((data as { proposedText: string }).proposedText)
    setAiState('SUCCESS')
  }

  function closeAi(): void {
    setAiState('IDLE')
    setAiProposal(null)
  }

  function applyAiText(): void {
    if (!aiProposal || aiTarget === 'ALL') return
    setSections((current) => current.map((section) => section.sectionType === aiTarget ? { ...section, content: aiProposal } : section))
    closeAi()
  }

  function updateSection(index: number, patch: Partial<VacancyFormSection>): void {
    setSections((current) => current.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section))
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setState('SAVING')
    const input = {
      title,
      jobId: null,
      locationLabel,
      workMode: workMode || null,
      minHours: minHours ? Number(minHours) : null,
      maxHours: maxHours ? Number(maxHours) : null,
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      salaryVisible,
      sections,
    }
    const response = await fetch(initial?.id ? `/api/recruitment/vacancies/${initial.id}` : '/api/recruitment/vacancies', {
      method: initial?.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initial?.id ? { expectedVersion: initial.version, input } : input),
    }).catch(() => null)
    if (!response?.ok) { setState('ERROR'); return }
    setState('SAVED')
    const body: unknown = await response.json().catch(() => null)
    const data = typeof body === 'object' && body !== null && 'data' in body ? body.data : null
    const id = typeof data === 'object' && data !== null && 'id' in data && typeof data.id === 'string' ? data.id : initial?.id
    if (id) router.push(`/recruitment/vacancies/${id}`)
    router.refresh()
  }

  return (
    <form className="space-y-8" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2 block text-sm font-medium">{labels.title}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
        <label className="block text-sm font-medium">{labels.location}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setLocationLabel(event.target.value)} value={locationLabel} /></label>
        <label className="block text-sm font-medium">{labels.workMode}<select className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setWorkMode(event.target.value)} value={workMode}><option value="">—</option><option value="ON_SITE">{labels.onSite}</option><option value="HYBRID">{labels.hybrid}</option><option value="REMOTE">{labels.remote}</option></select></label>
        <label className="block text-sm font-medium">{labels.hours}<span className="mt-2 grid grid-cols-2 gap-2"><input aria-label={`${labels.hours} min`} className="h-11 rounded-lg border bg-background px-3 text-sm" min="0" max="168" onChange={(event) => setMinHours(event.target.value)} placeholder="min" type="number" value={minHours} /><input aria-label={`${labels.hours} max`} className="h-11 rounded-lg border bg-background px-3 text-sm" min="0" max="168" onChange={(event) => setMaxHours(event.target.value)} placeholder="max" type="number" value={maxHours} /></span></label>
        <label className="block text-sm font-medium">{labels.salary}<span className="mt-2 grid grid-cols-2 gap-2"><input aria-label={`${labels.salary} min`} className="h-11 rounded-lg border bg-background px-3 text-sm" min="0" onChange={(event) => setSalaryMin(event.target.value)} placeholder="min" type="number" value={salaryMin} /><input aria-label={`${labels.salary} max`} className="h-11 rounded-lg border bg-background px-3 text-sm" min="0" onChange={(event) => setSalaryMax(event.target.value)} placeholder="max" type="number" value={salaryMax} /></span></label>
      </div>
      <label className="flex items-center gap-3 text-sm"><input checked={salaryVisible} className="size-4 accent-primary" onChange={(event) => setSalaryVisible(event.target.checked)} type="checkbox" />{labels.salaryVisible}</label>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.sections}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.sectionHint}</p></div></div>
        {aiAvailable ? <div className="mt-5 rounded-xl border bg-surface p-4"><div className="flex items-start gap-3"><Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div><h3 className="font-medium">{labels.aiTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.aiDescription}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">{labels.aiTarget}<select className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" onChange={(event) => setAiTarget(event.target.value as VacancyAiTarget)} value={aiTarget}>{(['ALL', 'INTRODUCTION', 'ROLE', 'PROFILE', 'OFFER', 'PROCESS', 'CONTACT'] as const).map((target) => <option key={target} value={target}>{labels.aiTargets[target]}</option>)}</select></label><label className="text-sm font-medium">{labels.aiInstruction}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" maxLength={1000} onChange={(event) => setAiInstruction(event.target.value)} placeholder={labels.aiInstructionPlaceholder} value={aiInstruction} /></label></div><div className="mt-4"><button className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold" disabled={aiState === 'LOADING' || !title.trim()} onClick={() => void generateAiText()} type="button"><Sparkles aria-hidden="true" />{labels.aiGenerate}</button></div>{aiState !== 'IDLE' ? <div className="mt-4"><AiResultSurface labels={{ reviewTitle: labels.aiReviewTitle, working: labels.aiWorking, apply: aiTarget === 'ALL' ? undefined : labels.aiApply, cancel: labels.aiCancel, copy: labels.aiCopy, copied: labels.aiCopied, retry: labels.aiRetry }} onApply={aiTarget === 'ALL' ? undefined : applyAiText} onCancel={closeAi} onRetry={() => void generateAiText()} state={aiState === 'LOADING' ? 'loading' : aiState === 'ERROR' ? 'error' : 'success'} text={aiProposal ?? undefined} error={labels.aiFailed} /></div> : null}</div> : null}
        <div className="mt-5 space-y-4">{sections.map((section, index) => <fieldset className="rounded-xl border bg-surface p-5" key={section.sectionType}><legend className="sr-only">{section.title}</legend><div className="flex items-center justify-between gap-3"><label className="min-w-0 flex-1 text-sm font-medium"><span className="sr-only">{labels.title}</span><input className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-semibold" onChange={(event) => updateSection(index, { title: event.target.value })} value={section.title} /></label><label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><input checked={section.isVisible} className="size-4 accent-primary" onChange={(event) => updateSection(index, { isVisible: event.target.checked })} type="checkbox" />{labels.salaryVisible}</label></div><textarea className="mt-3 min-h-28 w-full rounded-lg border bg-background px-3 py-3 text-sm leading-6" onChange={(event) => updateSection(index, { content: event.target.value })} value={section.content} /></fieldset>)}</div>
      </section>
      {state === 'ERROR' ? <p aria-live="polite" className="text-sm text-destructive">{labels.invalid}</p> : null}
      {state === 'SAVED' ? <p aria-live="polite" className="text-sm text-emerald-700">{labels.saved}</p> : null}
      <div className="flex flex-wrap justify-end gap-3 border-t pt-5"><button className="h-11 rounded-lg border px-5 text-sm font-semibold" onClick={() => router.back()} type="button">{labels.cancel}</button><button className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={state === 'SAVING'} type="submit">{state === 'SAVING' ? labels.saving : labels.save}</button></div>
    </form>
  )
}
