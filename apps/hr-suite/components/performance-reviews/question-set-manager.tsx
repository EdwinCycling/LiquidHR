'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import type { Locale } from '@/lib/i18n/config'
import {
  performanceReviewQuestionSetSchema,
  validatePerformanceReviewAnswers,
  type PerformanceReviewQuestion,
  type PerformanceReviewQuestionSet,
  type QuestionAnswers,
} from '@/lib/performance-reviews/question-set-schema'
import { PerformanceReviewQuestionFields } from './performance-review-question-fields'
import messagesNl from '@/messages/nl/performanceReviewQuestionSets.json'
import messagesEn from '@/messages/en/performanceReviewQuestionSets.json'

type QuestionSetItem = Omit<PerformanceReviewQuestionSet, 'status'> & {
  id: string
  tenant_id: string
  hr_group_id: string
  status: 'DRAFT' | 'AVAILABLE' | 'ARCHIVED'
  version: number
  created_at: string
  updated_at: string
}
type MessageSet = typeof messagesNl
type QuestionType = PerformanceReviewQuestion['type']
type PreviewRole = 'EMPLOYEE' | 'GV' | 'AB'
const typeOrder: QuestionType[] = ['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'YES_NO', 'SCALE', 'MATRIX']
const localizedEmpty = { nl: '', en: '' }

export function QuestionSetManager({ initialItems, locale }: { initialItems: QuestionSetItem[]; locale: Locale }) {
  const m: MessageSet = locale === 'nl' ? messagesNl : messagesEn
  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<QuestionSetItem | PerformanceReviewQuestionSet | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewRole, setPreviewRole] = useState<PreviewRole>('EMPLOYEE')
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [previewBody, setPreviewBody] = useState('')
  const [previewAnswers, setPreviewAnswers] = useState<QuestionAnswers>({})
  const [previewMessage, setPreviewMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [archiveTarget, setArchiveTarget] = useState<QuestionSetItem | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/performance-reviews/question-sets')
      .then((response) => response.ok ? response.json() as Promise<{ items?: QuestionSetItem[] }> : Promise.reject(new Error('list')))
      .then((result) => { if (active && Array.isArray(result.items)) setItems(result.items) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const visibleItems = useMemo(() => items.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [items, search])

  function newSet() {
    setStatusMessage('')
    setPreviewOpen(false)
    setEditor({ name: '', description: '', status: 'DRAFT', questions: [newQuestion('SHORT_TEXT')] })
  }

  function openSet(item: QuestionSetItem) {
    setStatusMessage('')
    setPreviewOpen(false)
    setEditor(structuredClone({ id: item.id, version: item.version, name: item.name, description: item.description, status: item.status === 'AVAILABLE' ? 'AVAILABLE' : 'DRAFT', questions: item.questions }))
  }

  async function refreshItems(): Promise<QuestionSetItem[]> {
    const response = await fetch('/api/performance-reviews/question-sets')
    if (!response.ok) throw new Error('list')
    const result = await response.json() as { items?: QuestionSetItem[] }
    const next = result.items ?? []
    setItems(next)
    return next
  }

  async function saveSet(status: 'DRAFT' | 'AVAILABLE') {
    if (!editor) return
    setBusy(true)
    setStatusMessage('')
    try {
      const editorId = 'id' in editor ? editor.id : undefined
      const editorVersion = 'version' in editor ? editor.version : undefined
      const isUpdate = typeof editorId === 'string'
      const payload = performanceReviewQuestionSetSchema.parse({
        ...(isUpdate ? { id: editorId, version: editorVersion } : {}),
        name: editor.name,
        description: editor.description,
        status,
        questions: editor.questions,
      })
      const response = await fetch(isUpdate ? `/api/performance-reviews/question-sets/${encodeURIComponent(editor.id as string)}` : '/api/performance-reviews/question-sets', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('save')
      const saved = await response.json() as QuestionSetItem
      const nextItems = await refreshItems()
      setEditor(structuredClone(saved))
      setStatusMessage(m.saved)
      if (!nextItems.some((item) => item.id === saved.id)) setItems((current) => [saved, ...current])
    } catch {
      setStatusMessage(m.saveFailed)
    } finally { setBusy(false) }
  }

  async function duplicate(item: QuestionSetItem) {
    setBusy(true)
    setStatusMessage('')
    try {
      const prefix = locale === 'nl' ? 'Kopie van ' : 'Copy of '
      const response = await fetch('/api/performance-reviews/question-sets', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id: item.id, name: `${prefix}${item.name}` }),
      })
      if (!response.ok) throw new Error('duplicate')
      const created = await response.json() as QuestionSetItem
      await refreshItems()
      openSet(created)
      setStatusMessage(m.saved)
    } catch { setStatusMessage(m.saveFailed) } finally { setBusy(false) }
  }

  async function archive() {
    if (!archiveTarget) return
    setBusy(true)
    setStatusMessage('')
    try {
      const response = await fetch(`/api/performance-reviews/question-sets/${encodeURIComponent(archiveTarget.id)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'archive', version: archiveTarget.version }),
      })
      if (!response.ok) throw new Error('archive')
      await refreshItems()
      if (editor && 'id' in editor && editor.id === archiveTarget.id) setEditor(null)
      setArchiveTarget(null)
      setStatusMessage(m.saved)
    } catch { setStatusMessage(m.saveFailed) } finally { setBusy(false) }
  }

  function closePreview() {
    setPreviewOpen(false)
    setPreviewAnswers({})
    setPreviewBody('')
    setPreviewMessage('')
  }

  function updateQuestion(questionId: string, updater: (question: PerformanceReviewQuestion) => PerformanceReviewQuestion) {
    setEditor((current) => current ? { ...current, questions: current.questions.map((question) => question.id === questionId ? updater(question) : question) } : current)
  }

  function removeQuestion(questionId: string) {
    setEditor((current) => current && current.questions.length > 1 ? { ...current, questions: current.questions.filter((question) => question.id !== questionId) } : current)
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setEditor((current) => {
      if (!current) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.questions.length) return current
      const questions = [...current.questions]
      const [question] = questions.splice(index, 1)
      if (question) questions.splice(nextIndex, 0, question)
      return { ...current, questions }
    })
  }

  function updatePreviewAnswer(questionId: string, value: unknown) {
    setPreviewAnswers((current) => ({ ...current, [questionId]: value }))
    setPreviewMessage('')
  }

  function validatePreview(submit: boolean) {
    if (!editor) return
    const validation = validatePerformanceReviewAnswers(editor.questions, previewAnswers, submit)
    const baseValid = previewBody.trim().length > 0
    if (!validation.valid || submit && !baseValid) {
      setPreviewMessage(m.requiredQuestions)
      return
    }
    setPreviewMessage(submit ? m.testSubmitted : m.testSaved)
  }

  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader title={m.title} description={m.subtitle} actions={!editor ? <Button onClick={newSet}><Plus aria-hidden="true" />{m.newSet}</Button> : <Button onClick={() => { setEditor(null); closePreview() }} variant="secondary"><ArrowLeft aria-hidden="true" />{m.back}</Button>} />
    {!editor ? <div className="space-y-4">
      <Surface className="p-4">
        <label className="flex items-center gap-2 text-sm"><Search aria-hidden="true" className="size-4 text-muted-foreground" /><span className="sr-only">{m.search}</span><input aria-label={m.search} className="min-h-10 min-w-0 flex-1 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-focus" placeholder={m.search} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </Surface>
      <Surface className="overflow-hidden">
        <div className="border-b border-border-subtle px-4 py-3"><SectionHeader title={m.title} description={String(visibleItems.length)} /></div>
        {visibleItems.length ? <ul className="divide-y divide-border-subtle">{visibleItems.map((item) => <li className="flex flex-wrap items-center justify-between gap-4 px-4 py-4" key={item.id}>
          <button className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default" disabled={item.status === 'ARCHIVED'} onClick={() => openSet(item)} type="button">
            <span className="block break-words font-medium">{item.name}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{item.description || '—'} · {item.questions.length} {m.questionCount.toLocaleLowerCase()}</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2.5 py-1 text-xs">{item.status === 'AVAILABLE' ? m.available : item.status === 'ARCHIVED' ? m.archived : m.draft}</span>
            {item.status !== 'ARCHIVED' ? <Button onClick={() => openSet(item)} size="sm" variant="secondary">{m.open}</Button> : null}
            {item.status !== 'ARCHIVED' ? <Button aria-label={`${m.duplicate}: ${item.name}`} onClick={() => void duplicate(item)} size="sm" variant="ghost"><Copy aria-hidden="true" />{m.duplicate}</Button> : null}
            {item.status !== 'ARCHIVED' ? <Button onClick={() => setArchiveTarget(item)} size="sm" variant="ghost"><Trash2 aria-hidden="true" />{m.archive}</Button> : null}
          </div>
        </li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">{search ? m.noMatches : m.empty}</p>}
      </Surface>
      {statusMessage ? <p className="text-sm text-muted-foreground" role="status">{statusMessage}</p> : null}
    </div> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.75fr)]">
      <section className="space-y-5">
        <Surface className="space-y-4 p-5">
          <SectionHeader title={editor.name || m.newSet} description={editor.questions.length ? `${editor.questions.length} ${m.questionCount.toLocaleLowerCase()}` : ''} />
          <label className="block text-sm font-medium">{m.questionSetName}<input className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" maxLength={120} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
          <label className="block text-sm font-medium">{m.description}<textarea className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" maxLength={1000} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label>
          <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void saveSet(editor.status === 'AVAILABLE' ? 'AVAILABLE' : 'DRAFT')} variant="secondary">{m.save}</Button>{editor.status !== 'AVAILABLE' ? <Button disabled={busy} onClick={() => void saveSet('AVAILABLE')}>{m.publishSet}</Button> : null}<Button disabled={busy} onClick={() => { setPreviewOpen((open) => !open); setPreviewAnswers({}); setPreviewBody(''); setPreviewMessage('') }} variant="secondary"><Eye aria-hidden="true" />{m.preview}</Button></div>
          {statusMessage ? <p className="text-sm text-muted-foreground" role="status">{statusMessage}</p> : null}
        </Surface>
        {editor.questions.map((question, index) => <QuestionEditor key={question.id} index={index} question={question} labels={m} total={editor.questions.length} onChange={(updater) => updateQuestion(question.id, updater)} onMove={(direction) => moveQuestion(index, direction)} onRemove={() => removeQuestion(question.id)} />)}
        <Button onClick={() => setEditor((current) => current ? { ...current, questions: [...current.questions, newQuestion('SHORT_TEXT')] } : current)} variant="secondary"><Plus aria-hidden="true" />{m.addQuestion}</Button>
      </section>
      {previewOpen ? <section aria-label={m.preview} className="space-y-4">
        <Surface className={`space-y-4 p-4 sm:p-5 ${previewMobile ? 'mx-auto w-full max-w-[24.375rem]' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{m.tryIt}</h2><Button onClick={closePreview} size="sm" variant="ghost">{m.closePreview}</Button></div>
          <p className="text-xs text-muted-foreground">{m.previewHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label={m.respondentRole} value={previewRole} options={[['EMPLOYEE', m.employeeRole], ['GV', m.gvRole], ['AB', m.abRole]]} onChange={(value) => { setPreviewRole(value as PreviewRole); setPreviewAnswers({}); setPreviewMessage('') }} />
            <SelectField label={m.language} value={previewLocale} options={[["nl", m.nl], ["en", m.en]]} onChange={(value) => { setPreviewLocale(value as Locale); setPreviewMessage('') }} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={m.preview}>
            <Button aria-pressed={!previewMobile} onClick={() => setPreviewMobile(false)} size="sm" variant={!previewMobile ? 'primary' : 'secondary'}>{m.desktop}</Button>
            <Button aria-pressed={previewMobile} onClick={() => setPreviewMobile(true)} size="sm" variant={previewMobile ? 'primary' : 'secondary'}>{m.mobile}</Button>
          </div>
          <div className="space-y-4 border-t border-border-subtle pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.standardFields}</p>
            <label className="block text-sm font-medium">{previewRole === 'EMPLOYEE' ? m.employeeReflection : previewRole === 'GV' ? m.managerResponse : m.additionalResponse}<textarea className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={previewBody} onChange={(event) => { setPreviewBody(event.target.value); setPreviewMessage('') }} /></label>
            {previewRole === 'GV' ? <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{previewLocale === 'nl' ? 'Gespreksdatum' : 'Meeting date'}<input className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" type="date" /></label><label className="block text-sm">{previewLocale === 'nl' ? 'Formele beoordeling' : 'Formal rating'}<select className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3"><option>—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></div> : null}
            {previewRole === 'EMPLOYEE' ? <p className="text-xs text-muted-foreground">{previewLocale === 'nl' ? 'Mijn actiepunten verschijnen hier.' : 'My action points appear here.'}</p> : null}
            {previewRole === 'AB' ? <p className="text-xs text-muted-foreground">{previewLocale === 'nl' ? 'De aanvullende beoordelaar vult geen formele managerbeoordeling in.' : 'The additional reviewer does not enter the formal manager rating.'}</p> : null}
            <PerformanceReviewQuestionFields questions={editor.questions} answers={previewAnswers} onChange={updatePreviewAnswer} locale={previewLocale} labels={m} invalidQuestionIds={previewMessage === m.requiredQuestions ? validatePerformanceReviewAnswers(editor.questions, previewAnswers, true).missingQuestionIds : []} />
            <div className="flex flex-wrap gap-2"><Button onClick={() => validatePreview(false)} variant="secondary">{m.testDraft}</Button><Button onClick={() => validatePreview(true)}>{m.testSubmit}</Button><Button onClick={() => { setPreviewAnswers({}); setPreviewBody(''); setPreviewMessage('') }} variant="ghost">{m.testReset}</Button></div>
            {previewMessage ? <p className="text-sm text-muted-foreground" role="status">{previewMessage}</p> : null}
          </div>
        </Surface>
      </section> : null}
    </div>}
    <ConfirmDialog cancelLabel={m.cancel} confirmLabel={m.archive} description={m.archiveDescription} onConfirm={archive} onOpenChange={(open) => { if (!open) setArchiveTarget(null) }} open={archiveTarget !== null} pending={busy} title={m.archiveTitle} />
  </PageShell>
}

function QuestionEditor({ index, question, labels, total, onChange, onMove, onRemove }: {
  index: number
  question: PerformanceReviewQuestion
  labels: MessageSet
  total: number
  onChange: (updater: (question: PerformanceReviewQuestion) => PerformanceReviewQuestion) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  function updateLocalized(field: 'prompt' | 'help', language: Locale, value: string) {
    onChange((current) => {
      if (field === 'help') return { ...current, help: { ...(current.help ?? localizedEmpty), [language]: value } } as PerformanceReviewQuestion
      return { ...current, prompt: { ...current.prompt, [language]: value } } as PerformanceReviewQuestion
    })
  }

  function changeType(type: QuestionType) {
    onChange((current) => createQuestion(type, { id: current.id, prompt: current.prompt, help: current.help, required: current.required }))
  }

  return <Surface className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">{labels.question} {index + 1}</h2>
      <div className="flex flex-wrap gap-1">
        <Button aria-label={labels.moveUp} disabled={index === 0} onClick={() => onMove(-1)} size="sm" variant="ghost"><ArrowUp aria-hidden="true" /></Button>
        <Button aria-label={labels.moveDown} disabled={index === total - 1} onClick={() => onMove(1)} size="sm" variant="ghost"><ArrowDown aria-hidden="true" /></Button>
        <Button aria-label={labels.removeQuestion} disabled={total <= 1} onClick={onRemove} size="sm" variant="ghost"><Trash2 aria-hidden="true" /></Button>
      </div>
    </div>
    <label className="block text-sm font-medium">{labels.questionTypes[question.type]}<select className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={question.type} onChange={(event) => changeType(event.target.value as QuestionType)}>{typeOrder.map((type) => <option key={type} value={type}>{labels.questionTypes[type]}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><TextAreaField label={labels.promptNl} value={question.prompt.nl} onChange={(value) => updateLocalized('prompt', 'nl', value)} maxLength={1000} /><TextAreaField label={labels.promptEn} value={question.prompt.en} onChange={(value) => updateLocalized('prompt', 'en', value)} maxLength={1000} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><TextAreaField label={labels.helpNl} value={question.help?.nl ?? ''} onChange={(value) => updateLocalized('help', 'nl', value)} maxLength={1000} /><TextAreaField label={labels.helpEn} value={question.help?.en ?? ''} onChange={(value) => updateLocalized('help', 'en', value)} maxLength={1000} /></div>
    {question.type === 'YES_NO' ? <label className="block text-sm font-medium">{labels.questionTypes.YES_NO}<select className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={question.variant} onChange={(event) => onChange((current) => ({ ...current, variant: event.target.value as 'YES_NO' | 'AGREE_DISAGREE' }))}><option value="YES_NO">{labels.binaryYesNo}</option><option value="AGREE_DISAGREE">{labels.binaryAgree}</option></select></label> : null}
    {question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE' ? <OptionsEditor labels={labels} options={question.options} onChange={(options) => onChange((current) => ({ ...current, options }))} /> : null}
    {question.type === 'SCALE' ? <ScaleEditor labels={labels} scale={question.scale} scaleLabels={question.labels} onChange={(scale, scaleLabels) => onChange((current) => ({ ...current, scale, labels: scaleLabels }))} /> : null}
    {question.type === 'MATRIX' ? <MatrixEditor labels={labels} question={question} onChange={(next) => onChange(() => next)} /> : null}
    <label className="flex min-h-10 items-center gap-2 text-sm"><input className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-focus" type="checkbox" checked={question.required} onChange={(event) => onChange((current) => ({ ...current, required: event.target.checked }))} />{labels.required}</label>
  </Surface>
}

function OptionsEditor({ labels, options, onChange }: { labels: MessageSet; options: Array<{ id: string; label: { nl: string; en: string } }>; onChange: (options: Array<{ id: string; label: { nl: string; en: string } }>) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2"><TextAreaField label={labels.optionsNl} value={options.map((item) => item.label.nl).join('\n')} onChange={(value) => onChange(localizedOptions(value, options.map((item) => item.label.en).join('\n'), options))} /><TextAreaField label={labels.optionsEn} value={options.map((item) => item.label.en).join('\n')} onChange={(value) => onChange(localizedOptions(options.map((item) => item.label.nl).join('\n'), value, options))} /></div>
}

function MatrixEditor({ labels, question, onChange }: { labels: MessageSet; question: Extract<PerformanceReviewQuestion, { type: 'MATRIX' }>; onChange: (question: Extract<PerformanceReviewQuestion, { type: 'MATRIX' }>) => void }) {
  return <div className="space-y-3">
    <label className="block text-sm font-medium">{labels.questionTypes.MATRIX}<select className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={question.matrixMode} onChange={(event) => {
      const common = { id: question.id, type: 'MATRIX' as const, prompt: question.prompt, help: question.help, required: question.required, rows: question.rows }
      onChange(event.target.value === 'SCALE' ? { ...common, matrixMode: 'SCALE', scale: 5, labels: [] } : { ...common, matrixMode: 'CHOICE', options: defaultOptions() })
    }}><option value="CHOICE">{labels.choiceMode}</option><option value="SCALE">{labels.scaleMode}</option></select></label>
    <div className="grid gap-3 sm:grid-cols-2"><TextAreaField label={labels.rowsNl} value={question.rows.map((item) => item.label.nl).join('\n')} onChange={(value) => onChange({ ...question, rows: localizedOptions(value, question.rows.map((item) => item.label.en).join('\n'), question.rows) })} /><TextAreaField label={labels.rowsEn} value={question.rows.map((item) => item.label.en).join('\n')} onChange={(value) => onChange({ ...question, rows: localizedOptions(question.rows.map((item) => item.label.nl).join('\n'), value, question.rows) })} /></div>
    {question.matrixMode === 'CHOICE' ? <OptionsEditor labels={labels} options={question.options} onChange={(options) => onChange({ ...question, options })} /> : <ScaleEditor labels={labels} scale={question.scale} scaleLabels={question.labels} onChange={(scale, scaleLabels) => onChange({ ...question, scale, labels: scaleLabels })} />}
  </div>
}

function ScaleEditor({ labels, scale, scaleLabels, onChange }: { labels: MessageSet; scale: 4 | 5 | 10; scaleLabels: Array<{ value: number; label: { nl: string; en: string } }>; onChange: (scale: 4 | 5 | 10, labels: Array<{ value: number; label: { nl: string; en: string } }>) => void }) {
  const availableScales = [4, 5, 10] as const
  return <div className="space-y-3">
    <label className="block text-sm font-medium">{labels.scaleSize}<select className="mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={scale} onChange={(event) => {
      const nextScale = Number(event.target.value) as 4 | 5 | 10
      onChange(nextScale, scaleLabels.filter((item) => item.value <= nextScale))
    }}>{availableScales.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><TextAreaField label={labels.scaleLabelsNl} value={scaleLabelsText(scaleLabels, 'nl')} onChange={(value) => onChange(scale, localizedScaleLabels(value, scaleLabelsText(scaleLabels, 'en')))} /><TextAreaField label={labels.scaleLabelsEn} value={scaleLabelsText(scaleLabels, 'en')} onChange={(value) => onChange(scale, localizedScaleLabels(scaleLabelsText(scaleLabels, 'nl'), value))} /></div>
  </div>
}

function TextAreaField({ label, value, onChange, maxLength = 2000 }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  return <label className="block text-sm font-medium">{label}<textarea className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<select className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}

function newQuestion(type: QuestionType): PerformanceReviewQuestion {
  return createQuestion(type, { id: crypto.randomUUID(), prompt: { ...localizedEmpty }, required: false })
}

function createQuestion(type: QuestionType, common: { id: string; prompt: { nl: string; en: string }; help?: { nl: string; en: string }; required: boolean }): PerformanceReviewQuestion {
  if (type === 'SHORT_TEXT' || type === 'LONG_TEXT') return { ...common, type }
  if (type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE') return { ...common, type, options: defaultOptions() }
  if (type === 'YES_NO') return { ...common, type, variant: 'YES_NO' }
  if (type === 'SCALE') return { ...common, type, scale: 5, labels: [] }
  return { ...common, type: 'MATRIX', matrixMode: 'CHOICE', rows: defaultRows(), options: defaultOptions() }
}

function defaultOptions() {
  return [
    { id: crypto.randomUUID(), label: { nl: '', en: '' } },
    { id: crypto.randomUUID(), label: { nl: '', en: '' } },
  ]
}

function defaultRows() {
  return [{ id: crypto.randomUUID(), label: { nl: '', en: '' } }]
}

function localizedOptions(nlText: string, enText: string, existing: Array<{ id: string; label: { nl: string; en: string } }>) {
  const nl = nlText.split(/\r?\n/u).map((value) => value.trim())
  const en = enText.split(/\r?\n/u).map((value) => value.trim())
  const count = Math.max(nl.length, en.length)
  return Array.from({ length: count }, (_, index) => ({ id: existing[index]?.id ?? crypto.randomUUID(), label: { nl: nl[index] ?? '', en: en[index] ?? '' } })).filter((item, index) => index < 30 && (item.label.nl || item.label.en))
}

function localizedScaleLabels(nlText: string, enText: string) {
  const nl = nlText.split(/\r?\n/u).map((value) => value.trim())
  const en = enText.split(/\r?\n/u).map((value) => value.trim())
  return Array.from({ length: Math.max(nl.length, en.length) }, (_, index) => ({ value: index + 1, label: { nl: nl[index] ?? '', en: en[index] ?? '' } })).filter((item) => item.label.nl || item.label.en)
}

function scaleLabelsText(labels: Array<{ value: number; label: { nl: string; en: string } }>, language: Locale) {
  return Array.from({ length: Math.max(0, ...labels.map((item) => item.value)) }, (_, index) => labels.find((item) => item.value === index + 1)?.label[language] ?? '').join('\n')
}
