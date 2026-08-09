'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Check,
  ChevronRight,
  Copy,
  FlaskConical,
  FormInput,
  GitCompareArrows,
  Languages,
  LockKeyhole,
  Plus,
  Search,
  Send,
  Workflow,
} from 'lucide-react'
import type { ProcessDefinitionDraft, FieldAccessMode } from '@/lib/process-automation/definition-schemas'
import type {
  StudioCatalogItem,
  StudioDefinition,
  StudioIssue,
  StudioTrialReport,
} from '@/lib/process-automation/studio-service'

type StudioTab = 'processes' | 'forms'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface StudioLabels {
  readonly title: string
  readonly description: string
  readonly processCatalog: string
  readonly formCatalog: string
  readonly search: string
  readonly status: string
  readonly allStatuses: string
  readonly draft: string
  readonly published: string
  readonly retired: string
  readonly newProcess: string
  readonly clone: string
  readonly noDefinitions: string
  readonly noValue: string
  readonly chooseDefinition: string
  readonly processStudio: string
  readonly formStudio: string
  readonly stepList: string
  readonly steps: string
  readonly step: string
  readonly stepType: string
  readonly participant: string
  readonly titleNl: string
  readonly titleEn: string
  readonly descriptionNl: string
  readonly descriptionEn: string
  readonly fieldLibrary: string
  readonly addField: string
  readonly fields: string
  readonly accessMatrix: string
  readonly hidden: string
  readonly read: string
  readonly writeOptional: string
  readonly writeRequired: string
  readonly preview: string
  readonly previewParticipant: string
  readonly desktop: string
  readonly mobile: string
  readonly syntheticData: string
  readonly saved: string
  readonly saving: string
  readonly saveError: string
  readonly revisionConflict: string
  readonly startEditing: string
  readonly readOnly: string
  readonly publish: string
  readonly publishConfirmation: string
  readonly changelog: string
  readonly changelogPlaceholder: string
  readonly cancel: string
  readonly confirmPublish: string
  readonly retire: string
  readonly retireReason: string
  readonly confirmRetire: string
  readonly versionDiff: string
  readonly noChanges: string
  readonly compilerFeedback: string
  readonly path: string
  readonly processTrial: string
  readonly trialDate: string
  readonly runTrial: string
  readonly trialNoWrites: string
  readonly trialPath: string
  readonly trialParticipants: string
  readonly trialOutput: string
  readonly success: string
  readonly warning: string
  readonly blocking: string
  readonly compilerBlocked: string
  readonly selected: string
  readonly formSection: string
  readonly noFields: string
  readonly language: string
  readonly viewport: string
  readonly dutch: string
  readonly english: string
  readonly candidates: string
  readonly sla: string
  readonly fieldKey: string
  readonly fieldType: string
  readonly fieldLabel: string
  readonly version: string
  readonly formsCount: string
}

interface StudioWorkspaceProps {
  readonly initialCatalog: readonly StudioCatalogItem[]
  readonly initialSelection: StudioDefinition | null
  readonly initialTab: StudioTab
  readonly canWrite: boolean
  readonly canPublish: boolean
  readonly labels: StudioLabels
}

const fieldLibrary = [
  { key: 'short-text', type: 'SHORT_TEXT' },
  { key: 'long-text', type: 'LONG_TEXT' },
  { key: 'date', type: 'DATE' },
  { key: 'employee', type: 'EMPLOYEE_REFERENCE' },
  { key: 'department', type: 'DEPARTMENT_REFERENCE' },
] as const

const accessModes: readonly FieldAccessMode[] = ['HIDDEN', 'READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED']

function titleFor(value: unknown, language: 'nl' | 'en' = 'nl'): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ''
  const record = value as Record<string, unknown>
  const preferred = record[language]
  if (typeof preferred === 'string' && preferred.trim() !== '') return preferred
  return typeof record.nl === 'string' ? record.nl : ''
}

function statusLabel(status: string, labels: StudioLabels): string {
  if (status === 'PUBLISHED') return labels.published
  if (status === 'RETIRED') return labels.retired
  return labels.draft
}

function statusClasses(status: string): string {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800'
  if (status === 'RETIRED') return 'bg-slate-100 text-slate-700'
  return 'bg-amber-100 text-amber-900'
}

function issuePath(issue: StudioIssue): string {
  return issue.path.map((part) => typeof part === 'number' ? `[${part}]` : part).join('.') || 'proces'
}

function IssueList({ issues, labels }: { issues: readonly StudioIssue[]; labels: StudioLabels }) {
  if (issues.length === 0) return null
  return (
    <section aria-labelledby="studio-compiler-feedback" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <h3 className="font-semibold" id="studio-compiler-feedback">{labels.compilerFeedback}</h3>
      <ul className="mt-3 space-y-2">
        {issues.map((issue, index) => (
          <li className="rounded-xl border border-amber-200 bg-white/70 p-3" key={`${issue.code}-${index}`}>
            <div className="font-mono text-xs font-semibold">{issue.code} · {issuePath(issue)}</div>
            <div className="mt-1">{issue.message}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function statusMessage(state: SaveState, labels: StudioLabels): string {
  if (state === 'saving') return labels.saving
  if (state === 'saved') return labels.saved
  if (state === 'error') return labels.saveError
  return ''
}

export function StudioWorkspace({ initialCatalog, initialSelection, initialTab, canWrite, canPublish, labels }: StudioWorkspaceProps) {
  const router = useRouter()
  const [catalog] = useState(initialCatalog)
  const [selected] = useState(initialSelection)
  const [tab, setTab] = useState<StudioTab>(initialTab)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [editing, setEditing] = useState(initialSelection?.definition.status === 'DRAFT')
  const [draft, setDraft] = useState<ProcessDefinitionDraft | null>(initialSelection?.draft ?? null)
  const [draftRevision, setDraftRevision] = useState(initialSelection?.draftRevision ?? 0)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [issues, setIssues] = useState<readonly StudioIssue[]>([])
  const [activeStepKey, setActiveStepKey] = useState(initialSelection?.draft.startStepKey ?? '')
  const [activeFormKey, setActiveFormKey] = useState(initialSelection?.draft.forms[0]?.key ?? '')
  const [previewParticipant, setPreviewParticipant] = useState(initialSelection?.draft.participants[0]?.key ?? '')
  const [previewLanguage, setPreviewLanguage] = useState<'nl' | 'en'>('nl')
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [showPublish, setShowPublish] = useState(false)
  const [publishChangelog, setPublishChangelog] = useState('')
  const [showRetire, setShowRetire] = useState(false)
  const [retireReason, setRetireReason] = useState('')
  const [trialDate, setTrialDate] = useState(new Date().toISOString().slice(0, 10))
  const [trial, setTrial] = useState<StudioTrialReport | null>(null)
  const [trialLoading, setTrialLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const saveInFlightRef = useRef(false)
  const saveBlockedRef = useRef(false)

  const visibleCatalog = useMemo(() => catalog.filter((item) => {
    const searchValue = `${item.key} ${titleFor(item.title)} ${titleFor(item.title, 'en')}`.toLowerCase()
    return (statusFilter === 'ALL' || item.status === statusFilter) && searchValue.includes(query.toLowerCase().trim())
  }), [catalog, query, statusFilter])

  const selectedForm = draft?.forms.find((form) => form.key === activeFormKey) ?? draft?.forms[0] ?? null
  const selectedStep = draft?.steps.find((step) => step.key === activeStepKey) ?? draft?.steps[0] ?? null
  const previewParticipantDefinition = draft?.participants.find((participant) => participant.key === previewParticipant) ?? draft?.participants[0] ?? null

  useEffect(() => {
    if (!draft || !selected?.definition.id || !dirty || !editing || !canWrite || saveInFlightRef.current || saveBlockedRef.current) return
    const timer = window.setTimeout(() => {
      if (saveInFlightRef.current || saveBlockedRef.current) return
      saveInFlightRef.current = true
      setSaveState('saving')
      void fetch(`/api/process-automation/studio/${selected.definition.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: draftRevision, definition: draft }),
      }).then(async (response) => {
        const payload = await response.json() as { data?: { revision: number; issues?: StudioIssue[] }; code?: string; issues?: StudioIssue[] }
        if (!response.ok || !payload.data) throw new Error(payload.code ?? 'SAVE_FAILED')
        setDraftRevision(payload.data.revision)
        setIssues(payload.data.issues ?? [])
        setDirty(false)
        setSaveState('saved')
      }).catch((error: unknown) => {
        saveBlockedRef.current = true
        setActionError(error instanceof Error && error.message === 'PROCESS_DEFINITION_DRAFT_CONFLICT' ? labels.revisionConflict : labels.saveError)
        setSaveState('error')
      }).finally(() => {
        saveInFlightRef.current = false
      })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [canWrite, dirty, draft, draftRevision, editing, labels.revisionConflict, labels.saveError, selected?.definition.id])

  function updateDraft(updater: (current: ProcessDefinitionDraft) => ProcessDefinitionDraft) {
    if (saveState === 'error') saveBlockedRef.current = false
    setDraft((current) => current ? updater(current) : current)
    setDirty(true)
    setSaveState('idle')
    setActionError('')
  }

  function selectCatalogItem(item: StudioCatalogItem) {
    router.push(`/settings/process-automation?tab=${tab}&definition=${item.id}`)
  }

  async function createDefinition() {
    setActionError('')
    const key = `internal-transfer-${Date.now().toString(36)}`
    const response = await fetch('/api/process-automation/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
    const payload = await response.json() as { data?: { id: string }; code?: string }
    if (!response.ok || !payload.data) { setActionError(payload.code ?? labels.saveError); return }
    router.push(`/settings/process-automation?definition=${payload.data.id}`)
  }

  async function cloneDefinition() {
    if (!selected) return
    setActionError('')
    const key = `${selected.definition.key}-copy-${Date.now().toString(36)}`
    const response = await fetch(`/api/process-automation/studio/${selected.definition.id}/clone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
    const payload = await response.json() as { data?: { id: string }; code?: string }
    if (!response.ok || !payload.data) { setActionError(payload.code ?? labels.saveError); return }
    router.push(`/settings/process-automation?definition=${payload.data.id}`)
  }

  async function publishDefinition() {
    if (!selected || dirty || !publishChangelog.trim()) return
    setActionError('')
    const response = await fetch(`/api/process-automation/studio/${selected.definition.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: draftRevision, changelog: publishChangelog }) })
    const payload = await response.json() as { data?: { versionNumber: number }; code?: string; issues?: StudioIssue[] }
    if (!response.ok || !payload.data) { setIssues(payload.issues ?? []); setActionError(payload.code ?? labels.compilerBlocked); return }
    router.push(`/settings/process-automation?definition=${selected.definition.id}`)
  }

  async function retireDefinition() {
    if (!selected || !retireReason.trim()) return
    setActionError('')
    const response = await fetch(`/api/process-automation/studio/${selected.definition.id}/retire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: retireReason }) })
    const payload = await response.json() as { data?: { activeInstanceCount: number }; code?: string }
    if (!response.ok || !payload.data) { setActionError(payload.code ?? labels.saveError); return }
    router.push(`/settings/process-automation?definition=${selected.definition.id}`)
  }

  async function runTrial() {
    if (!selected) return
    setTrialLoading(true)
    setActionError('')
    try {
      const response = await fetch(`/api/process-automation/studio/${selected.definition.id}/trial`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: trialDate, language: previewLanguage, subjectEmployeeId: null }) })
      const payload = await response.json() as { data?: StudioTrialReport; code?: string }
      if (!response.ok || !payload.data) throw new Error(payload.code ?? 'TRIAL_FAILED')
      setTrial(payload.data)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : labels.saveError)
    } finally {
      setTrialLoading(false)
    }
  }

  function updateStepTitle(language: 'nl' | 'en', value: string) {
    if (!selectedStep) return
    updateDraft((current) => ({ ...current, steps: current.steps.map((step) => step.key === selectedStep.key ? { ...step, title: { ...step.title, [language]: value } } : step) }))
  }

  function updateFieldLabel(formKey: string, sectionKey: string, fieldKey: string, language: 'nl' | 'en', value: string) {
    updateDraft((current) => ({
      ...current,
      forms: current.forms.map((form) => form.key !== formKey ? form : {
        ...form,
        sections: form.sections.map((section) => section.key !== sectionKey ? section : {
          ...section,
          fields: section.fields.map((field) => field.key === fieldKey ? { ...field, label: { ...field.label, [language]: value } } : field),
        }),
      }),
    }))
  }

  function updateFieldAccess(formKey: string, sectionKey: string, fieldKey: string, participantKey: string, mode: FieldAccessMode) {
    updateDraft((current) => ({
      ...current,
      forms: current.forms.map((form) => form.key !== formKey ? form : {
        ...form,
        sections: form.sections.map((section) => section.key !== sectionKey ? section : {
          ...section,
          fields: section.fields.map((field) => field.key !== fieldKey ? field : {
            ...field,
            access: field.access.some((rule) => rule.participantKey === participantKey)
              ? field.access.map((rule) => rule.participantKey === participantKey ? { ...rule, mode } : rule)
              : [...field.access, { participantKey, mode }],
          }),
        }),
      }),
    }))
  }

  function addField(type: (typeof fieldLibrary)[number]['type']) {
    if (!selectedForm || selectedForm.sections.length === 0 || !draft?.participants[0]) return
    const baseKey = fieldLibrary.find((item) => item.type === type)?.key ?? 'field'
    const fieldCount = draft.forms.reduce((total, form) => total + form.sections.reduce((sectionTotal, section) => sectionTotal + section.fields.length, 0), 0)
    const fieldKey = `${baseKey}-${fieldCount + 1}`
    const newField = {
      key: fieldKey,
      label: { nl: 'Nieuw veld', en: 'New field' },
      type,
      binding: { kind: 'PROCESS_ONLY' as const },
      access: [{ participantKey: draft.participants[0].key, mode: 'WRITE_OPTIONAL' as const }],
    }
    const sectionKey = selectedForm.sections[0].key
    updateDraft((current) => ({
      ...current,
      forms: current.forms.map((form) => form.key !== selectedForm.key ? form : {
        ...form,
        sections: form.sections.map((section) => section.key !== sectionKey ? section : { ...section, fields: [...section.fields, newField] }),
      }),
    }))
  }

  const previewFields = selectedForm?.sections.flatMap((section) => section.fields.map((field) => ({ section, field }))).filter(({ field }) => {
    const access = field.access.find((rule) => rule.participantKey === previewParticipantDefinition?.key)
    return access?.mode !== 'HIDDEN'
  }) ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(250px,0.34fr)_minmax(0,1fr)]">
        <aside className="rounded-3xl border bg-surface p-4 shadow-sm" aria-label={labels.processCatalog}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{labels.title}</p>
              <h2 className="mt-1 text-xl font-semibold">{labels.processCatalog}</h2>
            </div>
            {canWrite ? <button className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground" onClick={() => void createDefinition()} title={labels.newProcess} type="button"><Plus aria-hidden="true" size={18} /></button> : null}
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm">
            <button className={`rounded-lg px-3 py-2 font-semibold ${tab === 'processes' ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => setTab('processes')} type="button">{labels.processCatalog}</button>
            <button className={`rounded-lg px-3 py-2 font-semibold ${tab === 'forms' ? 'bg-surface shadow-sm' : 'text-muted-foreground'}`} onClick={() => setTab('forms')} type="button">{labels.formCatalog}</button>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
            <Search aria-hidden="true" className="text-muted-foreground" size={16} />
            <span className="sr-only">{labels.search}</span>
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} value={query} />
          </label>
          <label className="mt-3 block text-xs font-semibold text-muted-foreground">
            {labels.status}
            <select className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="ALL">{labels.allStatuses}</option>
              <option value="DRAFT">{labels.draft}</option>
              <option value="PUBLISHED">{labels.published}</option>
              <option value="RETIRED">{labels.retired}</option>
            </select>
          </label>

          <div className="mt-4 space-y-2" role="list">
            {visibleCatalog.map((item) => {
              const active = selected?.definition.id === item.id
              return (
                <button className={`w-full rounded-2xl border p-3 text-left transition ${active ? 'border-primary bg-accent/50 shadow-sm' : 'bg-background hover:border-primary/40'}`} key={item.id} onClick={() => selectCatalogItem(item)} role="listitem" type="button">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{titleFor(item.title) || item.key}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{item.key}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className={active ? 'text-primary' : 'text-muted-foreground'} size={16} />
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <span className={`rounded-full px-2 py-1 ${statusClasses(item.status)}`}>{statusLabel(item.status, labels)}</span>
                    <span className="text-muted-foreground">{labels.version} {item.publishedVersion ?? '—'} · {item.formCount} {labels.formsCount}</span>
                  </span>
                </button>
              )
            })}
            {visibleCatalog.length === 0 ? <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">{labels.noDefinitions}</p> : null}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selected || !draft ? (
            <section className="grid min-h-96 place-items-center rounded-3xl border border-dashed bg-surface p-8 text-center">
              <div><Workflow className="mx-auto text-muted-foreground" size={40} /><h2 className="mt-4 text-xl font-semibold">{labels.chooseDefinition}</h2><p className="mt-2 text-sm text-muted-foreground">{labels.description}</p></div>
            </section>
          ) : (
            <>
              <header className="rounded-3xl border bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(selected.definition.status)}`}>{statusLabel(selected.definition.status, labels)}</span><span className="text-xs text-muted-foreground">{selected.definition.key}</span></div>
                    {editing && selected.definition.status !== 'RETIRED' ? <input aria-label={labels.titleNl} className="mt-3 w-full rounded-xl border bg-background px-3 py-2 text-2xl font-semibold outline-none focus:border-primary" onChange={(event) => updateDraft((current) => ({ ...current, title: { ...current.title, nl: event.target.value } }))} value={draft.title.nl ?? ''} /> : <h2 className="mt-3 text-2xl font-semibold">{titleFor(draft.title)}</h2>}
                    <p className="mt-2 text-sm text-muted-foreground">{selected.definition.status === 'PUBLISHED' ? labels.readOnly : labels.processStudio}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {saveState !== 'idle' ? <span aria-live="polite" className="text-xs font-semibold text-muted-foreground">{statusMessage(saveState, labels)}</span> : null}
                    {selected.definition.status === 'PUBLISHED' || selected.definition.status === 'RETIRED' ? <span className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"><LockKeyhole size={15} />{labels.readOnly}</span> : null}
                    {canWrite && selected.definition.status !== 'RETIRED' && !editing ? <button className="rounded-xl border px-3 py-2 text-sm font-semibold hover:border-primary" onClick={() => setEditing(true)} type="button">{labels.startEditing}</button> : null}
                    {canWrite ? <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:border-primary" onClick={() => void cloneDefinition()} type="button"><Copy size={15} />{labels.clone}</button> : null}
                    {canPublish && selected.definition.status !== 'RETIRED' ? <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={!editing || dirty || Boolean(issues.length)} onClick={() => setShowPublish(true)} type="button"><Send size={15} />{labels.publish}</button> : null}
                    {canPublish && selected.definition.status === 'PUBLISHED' ? <button className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive" onClick={() => setShowRetire(true)} type="button"><Archive size={15} />{labels.retire}</button> : null}
                  </div>
                </div>
                {actionError ? <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{actionError}</p> : null}
                <IssueList issues={issues} labels={labels} />
              </header>

              <section className="rounded-3xl border bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{labels.processStudio}</p><h3 className="mt-1 text-xl font-semibold">{labels.steps}</h3></div><span className="text-xs text-muted-foreground">{labels.stepList}</span></div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
                  <nav aria-label={labels.stepList} className="space-y-2">
                    {draft.steps.map((step, index) => <button className={`w-full rounded-2xl border p-3 text-left ${selectedStep?.key === step.key ? 'border-primary bg-accent/50' : 'hover:border-primary/40'}`} key={step.key} onClick={() => setActiveStepKey(step.key)} type="button"><span className="text-xs font-semibold text-muted-foreground">{index + 1}. {step.type}</span><span className="mt-1 block font-semibold">{titleFor(step.title)}</span></button>)}
                  </nav>
                  <div className="space-y-4">
                    {selectedStep ? <article className="rounded-2xl border bg-background p-4">
                      <div className="flex items-center justify-between gap-2"><h4 className="font-semibold">{labels.step} · {selectedStep.key}</h4><span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">{selectedStep.type}</span></div>
                      {editing ? <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold">{labels.titleNl}<input className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" onChange={(event) => updateStepTitle('nl', event.target.value)} value={selectedStep.title.nl ?? ''} /></label><label className="text-sm font-semibold">{labels.titleEn}<input className="mt-1 w-full rounded-xl border px-3 py-2 font-normal" onChange={(event) => updateStepTitle('en', event.target.value)} value={selectedStep.title.en ?? ''} /></label></div> : null}
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3"><div><span className="text-xs font-semibold text-muted-foreground">{labels.stepType}</span><p className="mt-1 font-medium">{selectedStep.type}</p></div><div><span className="text-xs font-semibold text-muted-foreground">{labels.participant}</span><p className="mt-1 font-medium">{selectedStep.participantKey ?? labels.noValue}</p></div><div><span className="text-xs font-semibold text-muted-foreground">{labels.sla}</span><p className="mt-1 font-medium">{selectedStep.sla ? `${selectedStep.sla.duration.amount} ${selectedStep.sla.duration.unit}` : labels.noValue}</p></div></div>
                    </article> : null}
                    <div className="grid gap-3 md:grid-cols-2">{draft.transitions.filter((transition) => transition.fromStepKey === selectedStep?.key).map((transition) => <div className="rounded-2xl border border-dashed p-4 text-sm" key={transition.key}><span className="text-xs font-semibold text-muted-foreground">{transition.action}</span><p className="mt-1 font-semibold">{titleFor(transition.label)}</p><p className="mt-1 text-xs text-muted-foreground">→ {transition.toStepKey}</p></div>)}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{labels.formStudio}</p><h3 className="mt-1 text-xl font-semibold">{selectedForm ? titleFor(selectedForm.title) : labels.noValue}</h3></div><FormInput className="text-primary" size={22} /></div>
                {selectedForm ? <>
                  <div className="mt-4 flex flex-wrap gap-2">{draft.forms.map((form) => <button className={`rounded-xl border px-3 py-2 text-sm font-semibold ${form.key === selectedForm.key ? 'border-primary bg-accent/50' : ''}`} key={form.key} onClick={() => setActiveFormKey(form.key)} type="button">{titleFor(form.title)} · {labels.version} {form.version}</button>)}</div>
                  <div className="mt-5 grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
                    <aside className="rounded-2xl border bg-background p-3"><h4 className="text-sm font-semibold">{labels.fieldLibrary}</h4><div className="mt-3 space-y-2">{fieldLibrary.map((field) => <button className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold hover:border-primary" key={field.type} onClick={() => addField(field.type)} type="button"><Plus size={13} />{field.type}</button>)}</div><p className="mt-3 text-xs text-muted-foreground">{labels.addField}</p></aside>
                    <div className="space-y-4">{selectedForm.sections.map((section) => <div className="rounded-2xl border bg-background p-4" key={section.key}><h4 className="font-semibold">{titleFor(section.title)}</h4><div className="mt-3 space-y-3">{section.fields.map((field) => <article className="rounded-xl border p-3" key={field.key}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="font-semibold">{titleFor(field.label)}</span><span className="ml-2 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">{field.type}</span><p className="mt-1 font-mono text-[11px] text-muted-foreground">{field.key}</p></div><span className="text-xs text-muted-foreground">{field.binding.kind}</span></div>{editing ? <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">{labels.titleNl}<input className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm font-normal" onChange={(event) => updateFieldLabel(selectedForm.key, section.key, field.key, 'nl', event.target.value)} value={field.label.nl ?? ''} /></label><label className="text-xs font-semibold">{labels.titleEn}<input className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm font-normal" onChange={(event) => updateFieldLabel(selectedForm.key, section.key, field.key, 'en', event.target.value)} value={field.label.en ?? ''} /></label></div> : null}<div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">{labels.accessMatrix}</caption><thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2">{labels.participant}</th><th className="px-2 py-2">{labels.status}</th></tr></thead><tbody>{draft.participants.map((participant) => { const access = field.access.find((rule) => rule.participantKey === participant.key)?.mode ?? 'HIDDEN'; return <tr className="border-b last:border-0" key={participant.key}><td className="px-2 py-2 font-medium">{titleFor(participant.label)}</td><td className="px-2 py-2">{editing ? <select aria-label={`${labels.accessMatrix} ${participant.key}`} className="rounded-lg border bg-background px-2 py-1" onChange={(event) => updateFieldAccess(selectedForm.key, section.key, field.key, participant.key, event.target.value as FieldAccessMode)} value={access}>{accessModes.map((mode) => <option key={mode} value={mode}>{mode === 'HIDDEN' ? labels.hidden : mode === 'READ' ? labels.read : mode === 'WRITE_OPTIONAL' ? labels.writeOptional : labels.writeRequired}</option>)}</select> : <span>{access}</span>}</td></tr> })}</tbody></table></div></article>)}</div></div>)}</div>
                  </div>
                </> : <p className="mt-4 text-sm text-muted-foreground">{labels.noValue}</p>}
              </section>

              <section className="rounded-3xl border bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{labels.preview}</p><h3 className="mt-1 text-xl font-semibold">{selectedForm ? titleFor(selectedForm.title, previewLanguage) : labels.noValue}</h3></div><Languages className="text-primary" size={22} /></div>
                <div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold">{labels.previewParticipant}<select className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" onChange={(event) => setPreviewParticipant(event.target.value)} value={previewParticipant}>{draft.participants.map((participant) => <option key={participant.key} value={participant.key}>{titleFor(participant.label)}</option>)}</select></label><label className="text-xs font-semibold">{labels.language}<select className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" onChange={(event) => setPreviewLanguage(event.target.value as 'nl' | 'en')} value={previewLanguage}><option value="nl">{labels.dutch}</option><option value="en">{labels.english}</option></select></label><label className="text-xs font-semibold">{labels.viewport}<select className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm" onChange={(event) => setPreviewViewport(event.target.value as 'desktop' | 'mobile')} value={previewViewport}><option value="desktop">{labels.desktop}</option><option value="mobile">{labels.mobile} · 390px</option></select></label></div>
                <div className={`mt-4 rounded-2xl border bg-background p-4 ${previewViewport === 'mobile' ? 'max-w-[390px]' : 'max-w-3xl'}`}><p className="mb-4 rounded-xl bg-accent/50 px-3 py-2 text-xs font-semibold text-primary">{labels.syntheticData}</p>{previewFields.length ? <div className="space-y-4">{previewFields.map(({ section, field }) => <label className="block text-sm font-semibold" key={`${section.key}-${field.key}`}>{titleFor(field.label, previewLanguage)}<input className="mt-1 w-full rounded-xl border bg-surface px-3 py-2 font-normal" placeholder={field.type} readOnly /></label>)}</div> : <p className="text-sm text-muted-foreground">{labels.noFields}</p>}</div>
              </section>

              <section className="rounded-3xl border bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">{labels.processTrial}</p><h3 className="mt-1 text-xl font-semibold">{labels.processTrial}</h3></div><FlaskConical className="text-primary" size={22} /></div>
                <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">{labels.trialDate}<input className="mt-1 rounded-xl border bg-background px-3 py-2 text-sm" onChange={(event) => setTrialDate(event.target.value)} type="date" value={trialDate} /></label><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={trialLoading} onClick={() => void runTrial()} type="button"><FlaskConical size={15} />{trialLoading ? labels.saving : labels.runTrial}</button></div>
                {trial ? <div className="mt-5 space-y-4"><div className={`rounded-2xl border p-4 ${trial.status === 'SUCCESS' ? 'border-emerald-300 bg-emerald-50' : trial.status === 'WARNING' ? 'border-amber-300 bg-amber-50' : 'border-destructive/30 bg-destructive/5'}`}><div className="flex items-center gap-2 font-semibold">{trial.status === 'SUCCESS' ? <Check size={17} /> : null}{trial.status === 'SUCCESS' ? labels.success : trial.status === 'WARNING' ? labels.warning : labels.blocking}</div><p className="mt-2 text-sm">{labels.trialNoWrites}</p></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border p-4"><h4 className="font-semibold">{labels.trialPath}</h4><ol className="mt-3 space-y-2">{trial.path.map((step, index) => <li className="flex gap-3 text-sm" key={step.stepKey}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold">{index + 1}</span><span><span className="font-semibold">{titleFor(step.title, trial.language)}</span><span className="block text-xs text-muted-foreground">{step.stepKey}{step.nextStepKey ? ` → ${step.nextStepKey}` : ''}{step.sla ? ` · ${labels.sla} ${step.sla.duration.amount} ${step.sla.duration.unit}` : ''}</span></span></li>)}</ol></div><div className="rounded-2xl border p-4"><h4 className="font-semibold">{labels.trialParticipants}</h4><div className="mt-3 space-y-2">{trial.participants.map((participant) => <div className="rounded-xl border p-3 text-sm" key={participant.participantKey}><div className="flex justify-between gap-2"><span className="font-semibold">{participant.participantKey}</span><span className="text-xs font-semibold">{participant.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{participant.selectorType} · {participant.permission} · {participant.candidateEmployeeIds.length} {labels.candidates}</p>{participant.message ? <p className="mt-1 text-xs text-destructive">{participant.message}</p> : null}</div>)}</div></div></div>{trial.output ? <div className="rounded-2xl border p-4"><h4 className="font-semibold">{labels.trialOutput}</h4><p className="mt-1 text-sm">{titleFor(trial.output.title, trial.language)} · {trial.output.format}</p></div> : null}{trial.blockers.length || trial.warnings.length ? <IssueList issues={[...trial.blockers, ...trial.warnings]} labels={labels} /> : null}</div> : null}
              </section>

              <section className="rounded-3xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><GitCompareArrows className="text-primary" size={21} /><h3 className="text-xl font-semibold">{labels.versionDiff}</h3></div>{selected.diff.changedPaths.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.noChanges}</p> : <ul className="mt-3 grid gap-2 text-xs md:grid-cols-2">{selected.diff.changedPaths.slice(0, 80).map((path) => <li className="rounded-xl border px-3 py-2 font-mono" key={path}>{path}</li>)}</ul>}</section>
            </>
          )}
        </main>
      </div>

      {showPublish ? <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" role="dialog"><div className="w-full max-w-lg rounded-3xl border bg-surface p-6 shadow-xl"><h2 className="text-xl font-semibold">{labels.publishConfirmation}</h2><label className="mt-5 block text-sm font-semibold">{labels.changelog}<textarea className="mt-1 min-h-32 w-full rounded-xl border bg-background px-3 py-2 font-normal" onChange={(event) => setPublishChangelog(event.target.value)} placeholder={labels.changelogPlaceholder} value={publishChangelog} /></label><div className="mt-5 flex justify-end gap-2"><button className="rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => setShowPublish(false)} type="button">{labels.cancel}</button><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={!publishChangelog.trim()} onClick={() => void publishDefinition()} type="button"><Send size={15} />{labels.confirmPublish}</button></div></div></div> : null}
      {showRetire ? <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" role="dialog"><div className="w-full max-w-lg rounded-3xl border bg-surface p-6 shadow-xl"><h2 className="text-xl font-semibold">{labels.retire}</h2><label className="mt-5 block text-sm font-semibold">{labels.retireReason}<textarea className="mt-1 min-h-28 w-full rounded-xl border bg-background px-3 py-2 font-normal" onChange={(event) => setRetireReason(event.target.value)} value={retireReason} /></label><div className="mt-5 flex justify-end gap-2"><button className="rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => setShowRetire(false)} type="button">{labels.cancel}</button><button className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50" disabled={!retireReason.trim()} onClick={() => void retireDefinition()} type="button">{labels.confirmRetire}</button></div></div></div> : null}
    </div>
  )
}
