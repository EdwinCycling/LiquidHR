'use client'

import { ArrowDown, ArrowUp, Check, Plus, Save, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { EnpsBankQuestionRow, EnpsCategoryRow } from '@/lib/research/database'
import type { EnpsDraftData } from '@/lib/research/admin-service'
import type { ResearchTargetOptions } from '@/lib/research/target-service'
import type { EnpsQuestionType, ResearchTargetMode } from '@/lib/research/schemas'
import { ResearchTargetPicker } from './research-target-picker'

interface EnpsLabels { campaign: string; title: string; startsAt: string; endsAt: string; target: string; targetMode: string; targetAll: string; targetDepartments: string; targetLocations: string; targetEntities: string; targetEmployees: string; targetSearch: string; targetEmpty: string; selected: string; questions: string; scale: string; scale10: string; likert5: string; likert4: string; openText: string; yesNo: string; reminderInterval: string; mandatoryEnps: string; mandatoryDescription: string; questionBank: string; questionBankSearch: string; categoryAll: string; addBankQuestion: string; added: string; selectedQuestions: string; remove: string; moveUp: string; moveDown: string; enabled: string; disabled: string; customQuestion: string; customQuestionPlaceholder: string; addCustomQuestion: string; addingCustomQuestion: string; saveDraft: string; saving: string; saveFailed: string }

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EnpsBuilder({ labels, targets, categories, bank, draft }: { labels: EnpsLabels; targets: ResearchTargetOptions; categories: EnpsCategoryRow[]; bank: EnpsBankQuestionRow[]; draft?: EnpsDraftData }) {
  const router = useRouter()
  const mandatory = bank.find((question) => question.is_mandatory_enps)
  const [availableQuestions, setAvailableQuestions] = useState(bank)
  const [title, setTitle] = useState(draft?.title ?? '')
  const [startsAt, setStartsAt] = useState(draft ? toDateTimeLocal(draft.startsAt) : '')
  const [endsAt, setEndsAt] = useState(draft ? toDateTimeLocal(draft.endsAt) : '')
  const [scale, setScale] = useState<'LIKERT_5' | 'LIKERT_4' | 'SCALE_10'>(draft?.scaleType ?? 'LIKERT_5')
  const [reminderInterval, setReminderInterval] = useState(draft?.reminderIntervalDays ?? 7)
  const [mode, setMode] = useState<ResearchTargetMode>(draft?.targetMode ?? 'ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>(draft?.targetIds ?? [])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(draft ? [...draft.questions].sort((left, right) => left.order - right.order).map((question) => question.bankQuestionId) : (mandatory ? [mandatory.id] : []))
  const [disabledQuestions, setDisabledQuestions] = useState<string[]>(draft?.questions.filter((question) => !question.enabled).map((question) => question.bankQuestionId) ?? [])
  const [customQuestion, setCustomQuestion] = useState('')
  const [customCategoryId, setCustomCategoryId] = useState(categories[0]?.id ?? '')
  const [customType, setCustomType] = useState<EnpsQuestionType>('LIKERT_5')
  const [addingCustom, setAddingCustom] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('ALL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  const filteredBank = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return availableQuestions.filter((question) => !question.is_mandatory_enps && (categoryId === 'ALL' || question.category_id === categoryId) && (!query || question.question_text.toLocaleLowerCase().includes(query))) }, [availableQuestions, categoryId, search])
  const selectedRows = selectedQuestions.flatMap((id) => { const question = availableQuestions.find((item) => item.id === id); return question ? [question] : [] })
  const inputClass = 'mt-2 w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20'
  function moveQuestion(index: number, direction: -1 | 1) { setSelectedQuestions((current) => { const target = index + direction; if (index === 0 || target < 1 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target]!, next[index]!]; return next }) }
  function removeQuestion(id: string) { setSelectedQuestions((current) => current.filter((questionId) => questionId !== id)); setDisabledQuestions((current) => current.filter((questionId) => questionId !== id)) }

  async function addCustomQuestion() {
    if (!customQuestion.trim() || !customCategoryId) return
    setAddingCustom(true); setError(null)
    try {
      const response = await fetch('/api/research/question-bank/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId: customCategoryId, text: customQuestion, type: customType }) })
      if (!response.ok) throw new Error('custom-question')
      const result = await response.json() as { id: string }
      const question: EnpsBankQuestionRow = { id: result.id, tenant_id: '', hr_group_id: '', category_id: customCategoryId, question_number: null, question_text: customQuestion.trim(), default_type: customType, is_mandatory_enps: false, is_system: false }
      setAvailableQuestions((current) => [...current, question]); setSelectedQuestions((current) => [...current, question.id]); setCustomQuestion('')
    } catch { setError(labels.saveFailed) } finally { setAddingCustom(false) }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaving(true)
    try {
      const questions = selectedRows.map((question, index) => ({ bankQuestionId: question.id, order: index + 1, type: (question.is_mandatory_enps ? 'SCALE_10' : question.default_type === 'OPEN_TEXT' || question.default_type === 'YES_NO' ? question.default_type : scale) as EnpsQuestionType, mandatory: question.is_mandatory_enps, enabled: !disabledQuestions.includes(question.id) }))
      const response = await fetch(draft ? `/api/research/enps/${draft.id}` : '/api/research/enps', { method: draft ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), scaleType: scale, reminderIntervalDays: reminderInterval, target: { mode, ids: mode === 'ALL' ? [] : selectedIds }, questions }) })
      if (!response.ok) throw new Error('save')
      router.push('/settings/research'); router.refresh()
    } catch { setError(labels.saveFailed) } finally { setSaving(false) }
  }

  return <form className="space-y-6" onSubmit={save}>
    <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">{labels.campaign}</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">{labels.title}<input className={inputClass} maxLength={255} minLength={3} onChange={(event) => setTitle(event.target.value)} required value={title} /></label><label className="text-sm font-semibold">{labels.startsAt}<input className={inputClass} onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label><label className="text-sm font-semibold">{labels.endsAt}<input className={inputClass} onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label><div><label className="mb-2 block text-sm font-semibold" htmlFor="enps-scale">{labels.scale}</label><DropdownSelect id="enps-scale" onChange={(event) => setScale(event.target.value as typeof scale)} searchable value={scale}><option value="LIKERT_5">{labels.likert5}</option><option value="LIKERT_4">{labels.likert4}</option><option value="SCALE_10">{labels.scale10}</option></DropdownSelect></div><label className="text-sm font-semibold">{labels.reminderInterval}<input className={inputClass} max={30} min={1} onChange={(event) => setReminderInterval(Number(event.target.value))} required type="number" value={reminderInterval} /></label></div></section>
    <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">{labels.target}</h2><div className="mt-5"><ResearchTargetPicker labels={{ targetMode: labels.targetMode, targetAll: labels.targetAll, targetDepartments: labels.targetDepartments, targetLocations: labels.targetLocations, targetEntities: labels.targetEntities, targetEmployees: labels.targetEmployees, targetSearch: labels.targetSearch, targetEmpty: labels.targetEmpty, selected: labels.selected }} mode={mode} onModeChange={setMode} onSelectedIdsChange={setSelectedIds} options={targets} selectedIds={selectedIds} /></div></section>
    <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-semibold">{labels.questions}</h2>
      {mandatory ? <div className="mt-5 flex items-start gap-4 rounded-2xl border border-primary/30 bg-accent p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Check aria-hidden="true" size={17} /></span><div><p className="text-sm font-semibold">{labels.mandatoryEnps}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{mandatory.question_text || labels.mandatoryDescription}</p></div></div> : null}
      <div className="mt-5 rounded-2xl border bg-muted/35 p-4">
        <h3 className="font-semibold">{labels.customQuestion}</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_11rem_auto]">
          <input aria-label={labels.customQuestion} className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" maxLength={2000} minLength={2} onChange={(event) => setCustomQuestion(event.target.value)} placeholder={labels.customQuestionPlaceholder} value={customQuestion} />
          <DropdownSelect aria-label={labels.categoryAll} onChange={(event) => setCustomCategoryId(event.target.value)} searchable value={customCategoryId}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</DropdownSelect>
          <DropdownSelect aria-label={labels.scale} onChange={(event) => setCustomType(event.target.value as EnpsQuestionType)} searchable value={customType}><option value="LIKERT_5">{labels.likert5}</option><option value="LIKERT_4">{labels.likert4}</option><option value="SCALE_10">{labels.scale10}</option><option value="OPEN_TEXT">{labels.openText}</option><option value="YES_NO">{labels.yesNo}</option></DropdownSelect>
          <button className="button-secondary justify-center" disabled={addingCustom || !customQuestion.trim() || !customCategoryId} onClick={() => void addCustomQuestion()} type="button"><Plus aria-hidden="true" size={15} />{addingCustom ? labels.addingCustomQuestion : labels.addCustomQuestion}</button>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div><h3 className="font-semibold">{labels.questionBank}</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_14rem]"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input aria-label={labels.questionBankSearch} className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => setSearch(event.target.value)} placeholder={labels.questionBankSearch} value={search} /></div><DropdownSelect aria-label={labels.categoryAll} onChange={(event) => setCategoryId(event.target.value)} searchable value={categoryId}><option value="ALL">{labels.categoryAll}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</DropdownSelect></div><div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">{filteredBank.map((question) => { const selected = selectedQuestions.includes(question.id); return <div className="flex items-start justify-between gap-3 rounded-2xl border bg-background p-4" key={question.id}><div><p className="text-xs font-semibold text-primary">{categoryById.get(question.category_id)}</p><p className="mt-1 text-sm leading-6">{question.question_text}</p></div><button className={selected ? 'button-secondary shrink-0' : 'button-primary shrink-0'} disabled={selected} onClick={() => setSelectedQuestions((current) => [...current, question.id])} type="button">{selected ? <Check aria-hidden="true" size={15} /> : <Plus aria-hidden="true" size={15} />}{selected ? labels.added : labels.addBankQuestion}</button></div> })}</div></div>
        <aside><h3 className="font-semibold">{labels.selectedQuestions}</h3><div className="mt-3 space-y-2">{selectedRows.map((question, index) => <div className="rounded-2xl border bg-background p-4" key={question.id}><div className="flex items-start gap-3"><span className="text-xs font-semibold text-primary">{index + 1}</span><p className="flex-1 text-sm leading-6">{question.question_text}</p>{!question.is_mandatory_enps ? <button aria-label={labels.remove} className="grid size-8 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10" onClick={() => removeQuestion(question.id)} type="button"><X aria-hidden="true" size={15} /></button> : null}</div></div>)}</div></aside>
      </div>
    </section>
    <div className="rounded-2xl border bg-surface p-4"><p className="text-sm font-semibold">{labels.selectedQuestions}</p><div className="mt-3 space-y-2">{selectedRows.map((question, index) => { const disabled = disabledQuestions.includes(question.id); return <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${disabled ? 'bg-muted/25 text-muted-foreground' : 'bg-muted/45'}`} key={question.id}><span className="min-w-0 flex-1 truncate text-sm">{index + 1}. {question.question_text}</span>{!question.is_mandatory_enps ? <><button aria-pressed={!disabled} className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold ${disabled ? 'bg-background text-muted-foreground' : 'bg-accent text-accent-foreground'}`} onClick={() => setDisabledQuestions((current) => disabled ? current.filter((id) => id !== question.id) : [...current, question.id])} type="button">{disabled ? labels.disabled : labels.enabled}</button><button aria-label={labels.moveUp} className="grid size-9 place-items-center rounded-lg border bg-surface hover:bg-muted" disabled={index <= 1} onClick={() => moveQuestion(index, -1)} type="button"><ArrowUp aria-hidden="true" size={14} /></button><button aria-label={labels.moveDown} className="grid size-9 place-items-center rounded-lg border bg-surface hover:bg-muted" disabled={index === selectedRows.length - 1} onClick={() => moveQuestion(index, 1)} type="button"><ArrowDown aria-hidden="true" size={14} /></button></> : null}</div> })}</div></div>
    {error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive" role="alert">{error}</p> : null}<div className="flex justify-end"><button className="button-primary" disabled={saving || !mandatory} type="submit"><Save aria-hidden="true" size={16} />{saving ? labels.saving : labels.saveDraft}</button></div>
  </form>
}
