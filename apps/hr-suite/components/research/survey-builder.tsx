'use client'

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { ResearchTargetOptions } from '@/lib/research/target-service'
import type { ResearchTargetMode, SurveyQuestionType } from '@/lib/research/schemas'
import { ResearchTargetPicker } from './research-target-picker'

type SurveyQuestionDraft = { key: string; text: string; type: SurveyQuestionType; required: boolean; options: string; rows: string }

interface BuilderLabels {
  campaign: string; title: string; description: string; startsAt: string; endsAt: string; anonymous: string; target: string; targetMode: string; targetAll: string; targetDepartments: string; targetLocations: string; targetEntities: string; targetEmployees: string; targetSearch: string; targetEmpty: string; selected: string; questions: string; addQuestion: string; question: string; questionText: string; questionType: string; required: string; remove: string; moveUp: string; moveDown: string; options: string; optionPlaceholder: string; matrixRows: string; matrixPlaceholder: string; typeTextSingle: string; typeTextMulti: string; typeSingleChoice: string; typeMultiChoice: string; typeNumber: string; typeDate: string; typeDatetime: string; typeMatrix: string; saveDraft: string; saving: string; saveFailed: string
}

function questionLabel(template: string, number: number) {
  return template.replace('{number}', String(number))
}

const initialQuestion: SurveyQuestionDraft = { key: '1', text: '', type: 'TEXT_MULTI', required: true, options: '', rows: '' }

export function SurveyBuilder({ labels, targets }: { labels: BuilderLabels; targets: ResearchTargetOptions }) {
  const router = useRouter()
  const nextKey = useRef(2)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [mode, setMode] = useState<ResearchTargetMode>('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [questions, setQuestions] = useState<SurveyQuestionDraft[]>([initialQuestion])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateQuestion(key: string, patch: Partial<SurveyQuestionDraft>) { setQuestions((current) => current.map((question) => question.key === key ? { ...question, ...patch } : question)) }
  function addQuestion() { setQuestions((current) => [...current, { ...initialQuestion, key: String(nextKey.current++), required: false }]) }
  function moveQuestion(index: number, direction: -1 | 1) { setQuestions((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target]!, next[index]!]; return next }) }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaving(true)
    try {
      const response = await fetch('/api/research/surveys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), isAnonymous: anonymous, target: { mode, ids: mode === 'ALL' ? [] : selectedIds }, questions: questions.map((question) => ({ text: question.text, type: question.type, required: question.required, options: question.options.split('\n').map((value) => value.trim()).filter(Boolean), rows: question.rows.split('\n').map((value) => value.trim()).filter(Boolean).map((label) => ({ label, required: question.required })) })) }) })
      if (!response.ok) throw new Error('save')
      router.push('/settings/research')
      router.refresh()
    } catch { setError(labels.saveFailed) } finally { setSaving(false) }
  }

  const questionTypes: Array<{ value: SurveyQuestionType; label: string }> = [{ value: 'TEXT_SINGLE', label: labels.typeTextSingle }, { value: 'TEXT_MULTI', label: labels.typeTextMulti }, { value: 'SINGLE_CHOICE', label: labels.typeSingleChoice }, { value: 'MULTI_CHOICE', label: labels.typeMultiChoice }, { value: 'NUMBER', label: labels.typeNumber }, { value: 'DATE', label: labels.typeDate }, { value: 'DATETIME', label: labels.typeDatetime }, { value: 'MATRIX', label: labels.typeMatrix }]
  const inputClass = 'mt-2 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20'

  return <form className="space-y-6" onSubmit={save}>
    <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">{labels.campaign}</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">{labels.title}<input className={inputClass} maxLength={255} minLength={3} onChange={(event) => setTitle(event.target.value)} required value={title} /></label><label className="text-sm font-semibold sm:col-span-2">{labels.description}<textarea className={`${inputClass} min-h-28 resize-y`} maxLength={5000} onChange={(event) => setDescription(event.target.value)} value={description} /></label><label className="text-sm font-semibold">{labels.startsAt}<input className={inputClass} onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label><label className="text-sm font-semibold">{labels.endsAt}<input className={inputClass} onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label></div><label className="mt-5 flex items-center gap-3 rounded-2xl bg-accent/60 p-4 text-sm font-semibold"><input checked={anonymous} className="size-4 accent-[var(--primary)]" onChange={(event) => setAnonymous(event.target.checked)} type="checkbox" />{labels.anonymous}</label></section>
    <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">{labels.target}</h2><div className="mt-5"><ResearchTargetPicker labels={{ targetMode: labels.targetMode, targetAll: labels.targetAll, targetDepartments: labels.targetDepartments, targetLocations: labels.targetLocations, targetEntities: labels.targetEntities, targetEmployees: labels.targetEmployees, targetSearch: labels.targetSearch, targetEmpty: labels.targetEmpty, selected: labels.selected }} mode={mode} onModeChange={setMode} onSelectedIdsChange={setSelectedIds} options={targets} selectedIds={selectedIds} /></div></section>
    <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{labels.questions}</h2><button className="button-secondary" onClick={addQuestion} type="button"><Plus aria-hidden="true" size={16} />{labels.addQuestion}</button></div><div className="mt-5 space-y-4">{questions.map((question, index) => { const needsOptions = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'MATRIX'].includes(question.type); return <fieldset className="rounded-2xl border bg-background p-4 sm:p-5" key={question.key}><legend className="px-2 text-sm font-semibold text-primary">{questionLabel(labels.question, index + 1)}</legend><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">{labels.questionText}<textarea className={`${inputClass} min-h-20 resize-y`} maxLength={2000} minLength={2} onChange={(event) => updateQuestion(question.key, { text: event.target.value })} required value={question.text} /></label><div><label className="mb-2 block text-sm font-semibold" htmlFor={`question-type-${question.key}`}>{labels.questionType}</label><DropdownSelect id={`question-type-${question.key}`} onChange={(event) => updateQuestion(question.key, { type: event.target.value as SurveyQuestionType })} searchable value={question.type}>{questionTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></div><div className="flex items-end justify-between gap-3 pb-1"><label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input checked={question.required} className="size-4 accent-[var(--primary)]" onChange={(event) => updateQuestion(question.key, { required: event.target.checked })} type="checkbox" />{labels.required}</label>{questions.length > 1 ? <button className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-destructive" onClick={() => setQuestions((current) => current.filter((item) => item.key !== question.key))} type="button"><Trash2 aria-hidden="true" size={15} />{labels.remove}</button> : null}</div>{needsOptions ? <label className="text-sm font-semibold sm:col-span-2">{labels.options}<textarea className={`${inputClass} min-h-24 resize-y`} onChange={(event) => updateQuestion(question.key, { options: event.target.value })} placeholder={labels.optionPlaceholder} required value={question.options} /></label> : null}{question.type === 'MATRIX' ? <label className="text-sm font-semibold sm:col-span-2">{labels.matrixRows}<textarea className={`${inputClass} min-h-24 resize-y`} onChange={(event) => updateQuestion(question.key, { rows: event.target.value })} placeholder={labels.matrixPlaceholder} required value={question.rows} /></label> : null}</div></fieldset> })}</div></section>
    <div className="rounded-2xl border bg-surface p-4"><p className="text-sm font-semibold">{labels.questions}</p><div className="mt-3 space-y-2">{questions.map((question, index) => <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2" key={question.key}><span className="min-w-0 flex-1 truncate text-sm">{index + 1}. {question.text || questionLabel(labels.question, index + 1)}</span><button aria-label={`${labels.moveUp} ${questionLabel(labels.question, index + 1)}`} className="grid size-9 place-items-center rounded-lg border bg-surface hover:bg-muted" disabled={index === 0} onClick={() => moveQuestion(index, -1)} type="button"><ArrowUp aria-hidden="true" size={14} /></button><button aria-label={`${labels.moveDown} ${questionLabel(labels.question, index + 1)}`} className="grid size-9 place-items-center rounded-lg border bg-surface hover:bg-muted" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} type="button"><ArrowDown aria-hidden="true" size={14} /></button></div>)}</div></div>
    {error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive" role="alert">{error}</p> : null}<div className="flex justify-end"><button className="button-primary" disabled={saving} type="submit"><Save aria-hidden="true" size={16} />{saving ? labels.saving : labels.saveDraft}</button></div>
  </form>
}
