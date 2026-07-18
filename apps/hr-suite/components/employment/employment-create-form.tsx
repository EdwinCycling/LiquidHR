'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'

interface EmploymentCreateFormProps {
  employeeId: string
  options: EmploymentCreationOptions
  labels: {
    title: string; number: string; contractType: string; indefinite: string; definite: string
    startDate: string; seniorityDate: string; endDate: string; submit: string; saved: string
    failed: string; chainAdvice: string; chainChecking: string; chainClear: string
    chainAttention: string; chainIndefinite: string; chainInsufficient: string
    chainOverrideReason: string; historyComplete: string; knownContracts: string; review: string
    previous: string; next: string; stepContract: string; stepIkvOrganization: string
    stepConditions: string; stepSalaryCosts: string; stepReview: string; payrollTaxSubnumber: string
    ikvNumber: string; department: string; jobTitle: string; conditionGroup: string
    averageDays: string; averageHours: string; partTimeFactor: string; salary: string
    includeSalary: string; salaryScaleStep: string; manualSalary: string; fulltimeAmount: string
    costCenter: string; completeSummary: string; requiredFields: string
  }
}

interface ChainAssessment {
  outcome: 'CLEAR' | 'ATTENTION' | 'LIKELY_INDEFINITE' | 'INSUFFICIENT_DATA'
  chainContractCount: number
  ruleVersion: 'NL_CHAIN_2020' | 'NL_CHAIN_2028'
}

interface Draft {
  employmentNumber: string; contractType: 'INDEFINITE' | 'DEFINITE'; startsOn: string
  endsOn: string; seniorityDate: string; payrollTaxSubnumber: string; ikvNumber: string
  departmentId: string; jobTitle: string; conditionGroup: string; averageDaysPerWeek: string
  averageHoursPerWeek: string; partTimeFactor: string; includeSalary: boolean
  salaryScaleStepId: string; fulltimeAmount: string; costCenterId: string
  historyComplete: boolean; chainOverrideReason: string
}

const steps = ['contract', 'ikv', 'conditions', 'salary', 'review'] as const

export function EmploymentCreateForm({ employeeId, options, labels }: EmploymentCreateFormProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [assessment, setAssessment] = useState<ChainAssessment | null>(null)
  const [draft, setDraft] = useState<Draft>({
    employmentNumber: '', contractType: 'INDEFINITE', startsOn: '', endsOn: '', seniorityDate: '',
    payrollTaxSubnumber: '0001', ikvNumber: String(options.nextIkvNumber),
    departmentId: options.departments[0]?.id ?? '', jobTitle: '', conditionGroup: '',
    averageDaysPerWeek: '5', averageHoursPerWeek: '36', partTimeFactor: '1',
    includeSalary: options.canWriteSalary, salaryScaleStepId: '', fulltimeAmount: '',
    costCenterId: options.costCenters[0]?.id ?? '', historyComplete: true, chainOverrideReason: '',
  })

  const stepLabels = [labels.stepContract, labels.stepIkvOrganization, labels.stepConditions, labels.stepSalaryCosts, labels.stepReview]
  const selectedStep = useMemo(
    () => options.salaryScaleSteps.find((item) => item.id === draft.salaryScaleStepId),
    [draft.salaryScaleStepId, options.salaryScaleSteps],
  )

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    setAssessment(null)
    setState('idle')
  }

  function stepValid(index: number): boolean {
    if (index === 0) return Boolean(draft.employmentNumber && draft.startsOn)
    if (index === 1) return Boolean(draft.payrollTaxSubnumber && draft.ikvNumber && draft.departmentId && draft.jobTitle)
    if (index === 2) return Boolean(draft.conditionGroup && draft.averageDaysPerWeek && draft.averageHoursPerWeek && draft.partTimeFactor)
    if (index === 3) return Boolean(draft.costCenterId && (!draft.includeSalary || selectedStep || draft.fulltimeAmount))
    return true
  }

  function next(): void {
    if (!stepValid(step)) { setState('failed'); return }
    setStep((current) => Math.min(current + 1, steps.length - 1))
    setState('idle')
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!steps.every((_item, index) => stepValid(index))) { setState('failed'); return }
    setState('saving')
    if (!assessment) {
      const assessmentResponse = await fetch(`/api/employees/${employeeId}/employment-chain-assessment`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proposed: { startsOn: draft.startsOn, endsOn: draft.endsOn || null, contractType: draft.contractType },
          historyComplete: draft.historyComplete, exceptionCode: null,
        }),
      })
      if (!assessmentResponse.ok) { setState('failed'); return }
      const result = await assessmentResponse.json() as { data: ChainAssessment }
      setAssessment(result.data); setState('idle'); return
    }

    const salaryAmount = selectedStep?.fulltimeAmount ?? Number(draft.fulltimeAmount)
    const response = await fetch(`/api/employees/${employeeId}/employments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        employment: {
          employmentNumber: draft.employmentNumber, employmentType: 'EMPLOYEE', contractType: draft.contractType,
          startsOn: draft.startsOn, endsOn: draft.endsOn || null, seniorityDate: draft.seniorityDate || draft.startsOn,
          originalHireDate: draft.startsOn, isPrimary: false, reasonStarted: draft.chainOverrideReason || null,
        },
        incomeRelationship: {
          payrollTaxSubnumber: draft.payrollTaxSubnumber, ikvNumber: Number(draft.ikvNumber), validFrom: draft.startsOn,
        },
        organization: { departmentId: draft.departmentId, jobTitle: draft.jobTitle, effectiveFrom: draft.startsOn },
        laborCondition: { conditionGroup: draft.conditionGroup, validFrom: draft.startsOn },
        schedule: {
          scheduleType: 'HOURS_AND_AVG_DAYS', startWeek: 1,
          averageDaysPerWeek: Number(draft.averageDaysPerWeek), averageHoursPerWeek: Number(draft.averageHoursPerWeek),
          partTimeFactor: Number(draft.partTimeFactor), timeForTimeAccrual: 0, validFrom: draft.startsOn,
        },
        salary: draft.includeSalary ? {
          paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
          salaryBasis: selectedStep ? 'CUSTOM_SCALE' : 'MANUAL', fulltimeAmount: salaryAmount,
          currencyCode: 'EUR', salaryScaleStepId: selectedStep?.id ?? null, validFrom: draft.startsOn,
        } : undefined,
        costAllocation: {
          validFrom: draft.startsOn,
          allocations: [{ costCenterId: draft.costCenterId, percentage: 100 }],
        },
      }),
    })
    if (!response.ok) { setState('failed'); return }
    const result = await response.json() as { data: { employmentId: string } }
    setState('saved')
    router.push(`/employees/${employeeId}/employments/${result.data.employmentId}`)
    router.refresh()
  }

  const inputClass = 'form-field'
  return <form onSubmit={submit} className="rounded-2xl border bg-surface p-5 shadow-sm">
    <h2 className="text-lg font-semibold">{labels.title}</h2>
    <ol className="mt-4 grid grid-cols-5 gap-1" aria-label={labels.title}>
      {stepLabels.map((label, index) => <li key={label} className={`h-2 rounded-full ${index <= step ? 'bg-primary' : 'bg-muted'}`} title={label} />)}
    </ol>
    <p className="mt-3 text-sm font-semibold text-primary">{step + 1}. {stepLabels[step]}</p>

    {step === 0 && <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label={labels.number}><input className={inputClass} value={draft.employmentNumber} onChange={(e) => update('employmentNumber', e.target.value)} /></Field>
      <Field label={labels.contractType}><select className={inputClass} value={draft.contractType} onChange={(e) => update('contractType', e.target.value as Draft['contractType'])}><option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option></select></Field>
      <Field label={labels.startDate}><input type="date" className={inputClass} value={draft.startsOn} onChange={(e) => update('startsOn', e.target.value)} /></Field>
      <Field label={labels.endDate}><input type="date" className={inputClass} value={draft.endsOn} onChange={(e) => update('endsOn', e.target.value)} /></Field>
      <Field label={labels.seniorityDate}><input type="date" className={inputClass} value={draft.seniorityDate} onChange={(e) => update('seniorityDate', e.target.value)} /></Field>
    </div>}

    {step === 1 && <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label={labels.payrollTaxSubnumber}><input className={inputClass} value={draft.payrollTaxSubnumber} onChange={(e) => update('payrollTaxSubnumber', e.target.value)} /></Field>
      <Field label={labels.ikvNumber}><input type="number" min="1" className={inputClass} value={draft.ikvNumber} onChange={(e) => update('ikvNumber', e.target.value)} /></Field>
      <Field label={labels.department}><select className={inputClass} value={draft.departmentId} onChange={(e) => update('departmentId', e.target.value)}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
      <Field label={labels.jobTitle}><input className={inputClass} value={draft.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} /></Field>
    </div>}

    {step === 2 && <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label={labels.conditionGroup}><input className={inputClass} value={draft.conditionGroup} onChange={(e) => update('conditionGroup', e.target.value)} /></Field>
      <Field label={labels.averageDays}><input type="number" min="0" max="7" step="0.1" className={inputClass} value={draft.averageDaysPerWeek} onChange={(e) => update('averageDaysPerWeek', e.target.value)} /></Field>
      <Field label={labels.averageHours}><input type="number" min="0" max="168" step="0.01" className={inputClass} value={draft.averageHoursPerWeek} onChange={(e) => update('averageHoursPerWeek', e.target.value)} /></Field>
      <Field label={labels.partTimeFactor}><input type="number" min="0" max="2" step="0.0001" className={inputClass} value={draft.partTimeFactor} onChange={(e) => update('partTimeFactor', e.target.value)} /></Field>
    </div>}

    {step === 3 && <div className="mt-4 grid gap-4">
      {options.canWriteSalary && <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.includeSalary} onChange={(e) => update('includeSalary', e.target.checked)} />{labels.includeSalary}</label>}
      {draft.includeSalary && <div className="grid gap-4 sm:grid-cols-2"><Field label={labels.salaryScaleStep}><select className={inputClass} value={draft.salaryScaleStepId} onChange={(e) => update('salaryScaleStepId', e.target.value)}><option value="">{labels.manualSalary}</option>{options.salaryScaleSteps.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>{!selectedStep && <Field label={labels.fulltimeAmount}><input type="number" min="0" step="0.01" className={inputClass} value={draft.fulltimeAmount} onChange={(e) => update('fulltimeAmount', e.target.value)} /></Field>}</div>}
      <Field label={labels.costCenter}><select className={inputClass} value={draft.costCenterId} onChange={(e) => update('costCenterId', e.target.value)}>{options.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
    </div>}

    {step === 4 && <div className="mt-4 space-y-4">
      <section className="rounded-xl bg-muted p-4"><h3 className="font-semibold">{labels.completeSummary}</h3><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><Summary label={labels.number} value={draft.employmentNumber} /><Summary label={labels.startDate} value={draft.startsOn} /><Summary label={labels.jobTitle} value={draft.jobTitle} /><Summary label={labels.averageHours} value={draft.averageHoursPerWeek} /></dl></section>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.historyComplete} onChange={(e) => update('historyComplete', e.target.checked)} />{labels.historyComplete}</label>
      {assessment && <section className={`rounded-xl border p-4 ${assessment.outcome === 'CLEAR' ? 'bg-success/10' : 'bg-warning/10'}`}><h3 className="font-semibold">{labels.chainAdvice}</h3><p className="mt-1 text-sm">{{ CLEAR: labels.chainClear, ATTENTION: labels.chainAttention, LIKELY_INDEFINITE: labels.chainIndefinite, INSUFFICIENT_DATA: labels.chainInsufficient }[assessment.outcome]}</p><p className="mt-2 text-xs text-muted-foreground">{labels.knownContracts.replace('{count}', String(assessment.chainContractCount))}</p>{assessment.outcome !== 'CLEAR' && <Field label={labels.chainOverrideReason}><textarea className={`${inputClass} min-h-20`} value={draft.chainOverrideReason} onChange={(e) => update('chainOverrideReason', e.target.value)} /></Field>}</section>}
    </div>}

    {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{labels.requiredFields}</p>}
    {state === 'saved' && <p className="mt-4 text-sm text-success">{labels.saved}</p>}
    <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
      <button type="button" className="button-secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>{labels.previous}</button>
      {step < steps.length - 1 ? <button type="button" className="button-primary" onClick={next}>{labels.next}</button> : <button type="submit" className="button-primary" disabled={state === 'saving'}>{assessment ? labels.submit : labels.review}</button>}
    </div>
  </form>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value || '—'}</dd></div>
}
