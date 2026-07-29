'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

type WorkerType = 'EMPLOYEE' | 'STUDENT_INTERN' | 'TEMPORARY_AGENCY' | 'EXTERNAL_NO_PAYROLL'
type DurationType = 'INDEFINITE' | 'DEFINITE'

interface Contract {
  id: string
  sequenceNumber: number
  workerType: WorkerType
  flexPhaseId: string | null
  flexPhaseName: string | null
  laborConditionSetId: string
  laborConditionName: string
  durationType: DurationType
  startsOn: string
  endsOn: string | null
  probationApplies: boolean
  probationEndsOn: string | null
}

interface Draft {
  workerType: WorkerType
  flexPhaseId: string
  laborConditionSetId: string
  durationType: DurationType
  startsOn: string
  endsOn: string
  probationApplies: boolean
  probationEndsOn: string
}

interface Props {
  employmentId: string
  contracts: Contract[]
  canWrite: boolean
  options: {
    laborConditionSets: Array<{ id: string; name: string }>
    flexPhases: Array<{ id: string; name: string }>
  }
  labels: {
    title: string; add: string; edit: string; close: string; save: string; cancel: string
    workerType: string; flexPhase: string; laborConditions: string; duration: string
    startDate: string; endDate: string; probation: string; probationEnd: string
    indefinite: string; definite: string; yes: string; no: string
    workerEmployee: string; workerStudentIntern: string; workerTemporaryAgency: string
    workerExternal: string; active: string; failed: string; addBlocked: string
  }
}

function addDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return date.toISOString().slice(0, 10)
}

export function EmploymentContractTimeline({ employmentId, contracts, canWrite, options, labels }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Contract | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ordered = [...contracts].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const latest = ordered.at(-1)

  function draftFrom(contract: Contract): Draft {
    return {
      workerType: contract.workerType,
      flexPhaseId: contract.flexPhaseId ?? '',
      laborConditionSetId: contract.laborConditionSetId,
      durationType: contract.durationType,
      startsOn: contract.startsOn,
      endsOn: contract.endsOn ?? '',
      probationApplies: contract.probationApplies,
      probationEndsOn: contract.probationEndsOn ?? '',
    }
  }

  function open(contract: Contract): void {
    setSelected(contract)
    setDraft(draftFrom(contract))
    setMode('view')
    setError('')
  }

  function add(): void {
    if (!latest?.endsOn) { setError(labels.addBlocked); return }
    setSelected(null)
    setDraft({
      workerType: 'EMPLOYEE',
      flexPhaseId: options.flexPhases[0]?.id ?? '',
      laborConditionSetId: latest.laborConditionSetId,
      durationType: 'INDEFINITE',
      startsOn: addDay(latest.endsOn),
      endsOn: '',
      probationApplies: false,
      probationEndsOn: '',
    })
    setMode('add')
    setError('')
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    const input = {
      ...draft,
      flexPhaseId: draft.workerType === 'TEMPORARY_AGENCY' ? draft.flexPhaseId : null,
      endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : null,
      probationEndsOn: draft.probationApplies ? draft.probationEndsOn : null,
    }
    const response = await fetch(`/api/employments/${employmentId}/contracts`, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mode === 'add' ? input : { contractId: selected?.id, input }),
    })
    const result = await response.json() as { code?: string }
    if (!response.ok) {
      setSaving(false)
      setError(result.code ?? labels.failed)
      return
    }
    setSaving(false)
    setSelected(null)
    setDraft(null)
    router.refresh()
  }

  return <section className="rounded-2xl border bg-surface p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      {canWrite && <button type="button" className="button-primary" onClick={add}>{labels.add}</button>}
    </div>
    {error && !draft && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {ordered.map((contract) => <button type="button" key={contract.id} className="cursor-pointer rounded-2xl border p-4 text-left transition hover:border-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => open(contract)}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{contract.sequenceNumber}. {contract.durationType === 'INDEFINITE' ? labels.indefinite : labels.definite}</p><p className="mt-1 font-semibold">{contract.laborConditionName}</p></div>
          <span className="status-chip bg-accent text-accent-foreground">{contract.endsOn ?? labels.active}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{contract.startsOn} — {contract.endsOn ?? labels.active}</p>
      </button>)}
    </div>

    {draft && <div className="fixed inset-0 z-[70] grid place-items-center bg-sidebar/70 p-4" role="presentation">
      <form onSubmit={save} role="dialog" aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b pb-4">
          <h3 className="text-xl font-semibold">{mode === 'add' ? labels.add : labels.edit}</h3>
          <button type="button" className="button-secondary" onClick={() => { setDraft(null); setSelected(null) }}>{labels.close}</button>
        </div>
        {mode === 'view' ? <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Item label={labels.workerType} value={draft.workerType} />
          <Item label={labels.laborConditions} value={selected?.laborConditionName ?? ''} />
          <Item label={labels.startDate} value={draft.startsOn} />
          <Item label={labels.endDate} value={draft.endsOn || labels.active} />
          <Item label={labels.flexPhase} value={selected?.flexPhaseName ?? '—'} />
          <Item label={labels.probationEnd} value={draft.probationEndsOn || '—'} />
        </dl> : <ContractFields draft={draft} update={update} options={options} labels={labels} />}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          {mode === 'view' && canWrite && <button type="button" className="button-primary" onClick={() => setMode('edit')}>{labels.edit}</button>}
          {mode !== 'view' && <><button type="button" className="button-secondary" onClick={() => setMode(selected ? 'view' : 'add')}>{labels.cancel}</button><button type="submit" className="button-primary" disabled={saving}>{labels.save}</button></>}
        </div>
      </form>
    </div>}
  </section>
}

function ContractFields({ draft, update, options, labels }: {
  draft: Draft
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void
  options: Props['options']
  labels: Props['labels']
}) {
  const inputClass = 'form-field'
  return <div className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="grid gap-1.5 text-sm font-medium">{labels.workerType}<select className={inputClass} value={draft.workerType} onChange={(event) => update('workerType', event.target.value as WorkerType)}><option value="EMPLOYEE">{labels.workerEmployee}</option><option value="STUDENT_INTERN">{labels.workerStudentIntern}</option><option value="TEMPORARY_AGENCY">{labels.workerTemporaryAgency}</option><option value="EXTERNAL_NO_PAYROLL">{labels.workerExternal}</option></select></label>
    {draft.workerType === 'TEMPORARY_AGENCY' && <label className="grid gap-1.5 text-sm font-medium">{labels.flexPhase}<select className={inputClass} value={draft.flexPhaseId} onChange={(event) => update('flexPhaseId', event.target.value)}>{options.flexPhases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <label className="grid gap-1.5 text-sm font-medium">{labels.laborConditions}<select className={inputClass} value={draft.laborConditionSetId} onChange={(event) => update('laborConditionSetId', event.target.value)}>{options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1.5 text-sm font-medium">{labels.duration}<select className={inputClass} value={draft.durationType} onChange={(event) => update('durationType', event.target.value as DurationType)}><option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option></select></label>
    <label className="grid gap-1.5 text-sm font-medium">{labels.startDate}<input type="date" className={inputClass} value={draft.startsOn} onChange={(event) => update('startsOn', event.target.value)} /></label>
    {draft.durationType === 'DEFINITE' && <label className="grid gap-1.5 text-sm font-medium">{labels.endDate}<input type="date" min={draft.startsOn} className={inputClass} value={draft.endsOn} onChange={(event) => update('endsOn', event.target.value)} /></label>}
    <label className="grid gap-1.5 text-sm font-medium">{labels.probation}<select className={inputClass} value={String(draft.probationApplies)} onChange={(event) => update('probationApplies', event.target.value === 'true')}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></label>
    {draft.probationApplies && <label className="grid gap-1.5 text-sm font-medium">{labels.probationEnd}<input type="date" min={draft.startsOn} className={inputClass} value={draft.probationEndsOn} onChange={(event) => update('probationEndsOn', event.target.value)} /></label>}
  </div>
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
}
