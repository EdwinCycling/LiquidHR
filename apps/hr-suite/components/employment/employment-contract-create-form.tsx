'use client'

import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { employmentContractMutationSchema, isEmploymentContractStartDateValid, type EmploymentContractMutationInput } from '@/lib/employment/contract-schemas'
import { addContractPeriodEnd, validateProbation } from '@/lib/employment/probation-rules'
import type { EmploymentCreateFormProps, EmploymentWizardEmployeeSummary } from './employment-create-form'

export type EmploymentContractWizardWorkerType = 'EMPLOYEE' | 'STUDENT_INTERN' | 'TEMPORARY_AGENCY' | 'EXTERNAL_NO_PAYROLL'
export type EmploymentContractWizardDurationType = 'INDEFINITE' | 'DEFINITE' | 'TEMPORARY_NO_END'

export interface EmploymentContractWizardDraft {
  workerType: EmploymentContractWizardWorkerType
  flexPhaseId: string
  laborConditionSetId: string
  durationType: EmploymentContractWizardDurationType
  startsOn: string
  endsOn: string
  probationApplies: boolean
  probationEndsOn: string
}

export interface EmploymentContractWizardOptions {
  laborConditionSets: Array<{ id: string; name: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }>
  flexPhases: Array<{ id: string; name: string }>
}

interface Props {
  employmentId: string
  options: EmploymentContractWizardOptions
  initialDraft: EmploymentContractWizardDraft
  employmentStartsOn: string
  isFirstContract: boolean
  labels: EmploymentCreateFormProps['labels']
  submitLabel: string
  employeeSummary?: EmploymentWizardEmployeeSummary
  onStepChange?: (step: number) => void
  onSaved?: () => void
}

type State = 'idle' | 'saving' | 'saved' | 'failed'

export function EmploymentContractCreateForm({ employmentId, options, initialDraft, employmentStartsOn, isFirstContract, labels, submitLabel, employeeSummary, onStepChange, onSaved }: Props) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => ({ ...initialDraft, startsOn: isFirstContract ? employmentStartsOn : initialDraft.startsOn }))
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  useEffect(() => { onStepChange?.(step) }, [onStepChange, step])

  function update<K extends keyof EmploymentContractWizardDraft>(key: K, value: EmploymentContractWizardDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    setState('idle')
    setError('')
  }

  function payload(): EmploymentContractMutationInput {
    return {
      ...draft,
      startsOn: isFirstContract ? employmentStartsOn : draft.startsOn,
      flexPhaseId: draft.workerType === 'TEMPORARY_AGENCY' ? draft.flexPhaseId || null : null,
      endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn || null : null,
      probationEndsOn: draft.probationApplies ? draft.probationEndsOn || null : null,
      caoAllowsTwoMonths: options.laborConditionSets.find((item) => item.id === draft.laborConditionSetId)?.probationMaximumMonths === 2,
    }
  }

  function valid(): boolean {
    return isEmploymentContractStartDateValid(draft.startsOn, employmentStartsOn, isFirstContract)
      && employmentContractMutationSchema.safeParse(payload()).success
  }

  function next(): void {
    if (!valid()) {
      setError(labels.requiredFields)
      setState('failed')
      return
    }
    setStep(1)
    setState('idle')
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!valid()) {
      setError(labels.requiredFields)
      setState('failed')
      return
    }
    setState('saving')
    const response = await fetch(`/api/employments/${employmentId}/contracts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload()),
    })
    const result = await response.json().catch(() => ({})) as { code?: string }
    if (!response.ok) {
      setError(result.code ?? labels.failed)
      setState('failed')
      return
    }
    setState('saved')
    onSaved?.()
  }

  const selectedLaborConditionSet = options.laborConditionSets.find((item) => item.id === draft.laborConditionSetId)
  const probationError = validateProbation({ durationType: draft.durationType, startsOn: draft.startsOn, endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : null, probationApplies: draft.probationApplies, probationEndsOn: draft.probationEndsOn, caoAllowsTwoMonths: selectedLaborConditionSet?.probationMaximumMonths === 2 })

  return <form onSubmit={(event) => void submit(event)} className="flex min-h-full min-w-0 flex-col rounded-2xl border bg-surface p-5 shadow-sm">
    {step === 0 && <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-xl font-semibold">{labels.stepContract}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.laborConditions}</span><select className="form-field" value={draft.laborConditionSetId} onChange={(event) => update('laborConditionSetId', event.target.value)}>{options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{selectedLaborConditionSet?.probationMaximumMonths === 2 && <span className="text-xs font-normal text-muted-foreground">{labels.probationCaoMaximum}</span>}</label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.fulltimeReference}</span><input className="form-field bg-muted/40" type="number" value={selectedLaborConditionSet?.standardHoursPerWeek ?? 40} readOnly /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.duration}</span><select className="form-field" value={draft.durationType} onChange={(event) => { const durationType = event.target.value as EmploymentContractWizardDurationType; update('durationType', durationType); if (durationType !== 'DEFINITE') update('endsOn', '') }}><option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option><option value="TEMPORARY_NO_END">{labels.temporaryWithoutEnd}</option></select></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.startDate}</span><input type="date" min={employmentStartsOn} readOnly={isFirstContract} className={`form-field${isFirstContract ? ' bg-muted/40' : ''}`} value={draft.startsOn} onChange={(event) => update('startsOn', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{isFirstContract ? labels.firstContractStartDateHelp : labels.contractStartDateMinimumHelp}</span></label>
        {draft.durationType === 'DEFINITE' && <label className="grid gap-1.5 text-sm font-medium"><span>{labels.endDate}</span><input type="date" min={draft.startsOn} className="form-field" value={draft.endsOn} onChange={(event) => update('endsOn', event.target.value)} /><span className="flex flex-wrap gap-2"><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 1))}>{labels.addOneMonth}</SmallButton><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 3))}>{labels.addThreeMonths}</SmallButton><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 6))}>{labels.addSixMonths}</SmallButton><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 12))}>{labels.addTwelveMonths}</SmallButton></span></label>}
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.probation}</span><select className="form-field" value={String(draft.probationApplies)} onChange={(event) => { const applies = event.target.value === 'true'; update('probationApplies', applies); if (!applies) update('probationEndsOn', '') }}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></label>
        {draft.probationApplies && <label className="grid gap-1.5 text-sm font-medium"><span>{labels.probationEnd}</span><input type="date" min={draft.startsOn} className="form-field" value={draft.probationEndsOn} onChange={(event) => update('probationEndsOn', event.target.value)} />{probationError === 'PROBATION_NOT_ALLOWED' && <span role="status" className="text-xs font-normal text-warning">{labels.probationNotAllowed}</span>}{probationError === 'PROBATION_MAXIMUM_EXCEEDED' && <span role="status" className="text-xs font-normal text-warning">{labels.probationMaximumExceeded}</span>}{probationError === 'PROBATION_DATE_OUTSIDE_CONTRACT' && <span role="status" className="text-xs font-normal text-warning">{labels.probationOutsideContract}</span>}</label>}
        {draft.workerType === 'TEMPORARY_AGENCY' && <label className="grid gap-1.5 text-sm font-medium"><span>{labels.flexPhase}</span><select className="form-field" value={draft.flexPhaseId} onChange={(event) => update('flexPhaseId', event.target.value)}>{options.flexPhases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </div>
    </section>}

    {step === 1 && <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-xl font-semibold">{labels.completeSummary}</h2>
      {employeeSummary && <EmployeeSummaryCard summary={employeeSummary} labels={labels} />}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.createHint}</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <Summary label={labels.laborConditions} value={selectedLaborConditionSet?.name ?? ''} />
        <Summary label={labels.duration} value={draft.durationType === 'INDEFINITE' ? labels.indefinite : draft.durationType === 'DEFINITE' ? labels.definite : labels.temporaryWithoutEnd} />
        <Summary label={labels.startDate} value={draft.startsOn} />
        <Summary label={labels.endDate} value={draft.endsOn || labels.indefinite} />
        <Summary label={labels.probation} value={draft.probationApplies ? labels.yes : labels.no} />
        {draft.probationApplies && <Summary label={labels.probationEnd} value={draft.probationEndsOn} />}
      </dl>
    </section>}

    {error && <p role="alert" className="mt-4 text-sm text-destructive">{state === 'failed' && error === labels.requiredFields ? labels.requiredFields : error}</p>}
    {state === 'saved' && <p className="mt-4 text-sm text-success">{labels.saved}</p>}
    <div className="sticky bottom-0 z-10 mt-8 flex items-center justify-between gap-3 border-t border-border/70 bg-surface/95 py-3 backdrop-blur-sm">
      <button type="button" className="button-secondary" disabled={step === 0 || state === 'saving'} onClick={() => { setStep(0); setState('idle') }}>{labels.previous}</button>
      {step === 0 ? <button type="button" className="button-primary" disabled={state === 'saving'} onClick={next}>{labels.next}</button> : <button type="submit" className="button-primary" disabled={state === 'saving'}>{state === 'saving' ? labels.optionsLoading : submitLabel}</button>}
    </div>
  </form>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
}

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-muted" onClick={onClick}>{children}</button>
}

function EmployeeSummaryCard({ summary, labels }: { summary: EmploymentWizardEmployeeSummary; labels: EmploymentCreateFormProps['labels'] }) {
  const gender = summary.gender === 'MALE' ? labels.genderMale : summary.gender === 'FEMALE' ? labels.genderFemale : summary.gender === 'OTHER' ? labels.genderOther : labels.genderUndisclosed
  return <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.employeeSummaryTitle}</p><dl className="mt-3 grid gap-3 sm:grid-cols-3"><Summary label={labels.employeeSummaryName} value={summary.name} /><Summary label={labels.employeeSummaryBirthDate} value={summary.birthDate ?? ''} /><Summary label={labels.employeeSummaryGender} value={gender} /></dl></div>
}
