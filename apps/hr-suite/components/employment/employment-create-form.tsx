'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'

type WorkerType = 'EMPLOYEE' | 'STUDENT_INTERN' | 'TEMPORARY_AGENCY' | 'EXTERNAL_NO_PAYROLL'
type DurationType = 'INDEFINITE' | 'DEFINITE'
type SalaryBasis = 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE'

export interface EmploymentCreateFormProps {
  employeeId: string
  options: EmploymentCreationOptions
  labels: {
    title: string; submit: string; saved: string; failed: string; previous: string; next: string
    requiredFields: string; employmentNumber: string; primaryEmployment: string; yes: string; no: string
    startDate: string; seniorityDate: string; country: string; ikvNumber: string
    prerequisitesTitle: string; nationality: string; bsn: string; birthDate: string; gender: string
    employeeNumber: string; savePrerequisites: string; prerequisiteSaved: string
    genderMale: string; genderFemale: string; genderOther: string; genderUndisclosed: string
    stepEmployment: string; stepContract: string; stepSchedule: string; stepSalary: string
    stepOther: string; stepReview: string; workerType: string; workerEmployee: string
    workerStudentIntern: string; workerTemporaryAgency: string; workerExternal: string
    flexPhase: string; laborConditions: string; duration: string; indefinite: string; definite: string
    endDate: string; probation: string; probationEnd: string; addFourWeeks: string
    addOneMonth: string; addTwoMonths: string; onCallEmployee: string; onCallObligation: string
    employmentScope: string; fullTime: string; partTime: string; weeklyHours: string
    partTimeFactor: string; roster: string; rosterMismatch: string; monday: string; tuesday: string
    wednesday: string; thursday: string; friday: string; saturday: string; sunday: string
    salaryCalculation: string; salaryManual: string; salaryMinimum: string; salaryTable: string
    frequency: string; fulltimeSalary: string; parttimeSalary: string; salaryScaleStep: string
    minimumHourlyRate: string
    department: string; job: string; costCenter: string; costCarrier: string
    completeSummary: string; createHint: string
  }
}

interface Draft {
  employeeNumber: string; nationality: string; bsn: string; birthDate: string; gender: string
  employmentNumber: string; isPrimary: boolean; startsOn: string; seniorityDate: string
  countryCode: string; ikvNumber: string; workerType: WorkerType; flexPhaseId: string
  laborConditionSetId: string; durationType: DurationType; endsOn: string
  probationApplies: boolean; probationEndsOn: string; isOnCall: boolean
  onCallObligation: boolean; workScope: 'FULL_TIME' | 'PART_TIME'; weeklyHours: string
  partTimeFactor: string; days: Record<DayKey, string>; salaryBasis: SalaryBasis
  salaryFrequencyId: string; fulltimeAmount: string; parttimeAmount: string
  salaryScaleStepId: string; departmentId: string; jobId: string
  costCenterId: string; costCarrierId: string
}

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const dayKeys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function addToDate(value: string, mode: 'FOUR_WEEKS' | 'ONE_MONTH' | 'TWO_MONTHS'): string {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (mode === 'FOUR_WEEKS') date.setUTCDate(date.getUTCDate() + 28)
  else date.setUTCMonth(date.getUTCMonth() + (mode === 'ONE_MONTH' ? 1 : 2))
  return date.toISOString().slice(0, 10)
}

function normalizeNationalityCode(value: string | null): string {
  const normalized = value?.trim().toUpperCase() ?? ''
  if (/^[A-Z]{2}$/.test(normalized)) return normalized
  if (['NEDERLANDS', 'NEDERLANDSE', 'DUTCH', 'NETHERLANDS'].includes(normalized)) return 'NL'
  return ''
}

export function EmploymentCreateForm({ employeeId, options, labels }: EmploymentCreateFormProps) {
  const router = useRouter()
  const missingPrerequisites = !options.prerequisites.nationality
    || !options.prerequisites.birthDate || !options.prerequisites.gender
    || (options.defaultCountryCode === 'NL' && !options.prerequisites.hasBsn)
  const [prerequisitesComplete, setPrerequisitesComplete] = useState(!missingPrerequisites)
  const [step, setStep] = useState(0)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [errorCode, setErrorCode] = useState('')
  const [draft, setDraft] = useState<Draft>({
    employeeNumber: options.prerequisites.employeeNumber,
    nationality: normalizeNationalityCode(options.prerequisites.nationality),
    bsn: '',
    birthDate: options.prerequisites.birthDate ?? '',
    gender: options.prerequisites.gender ?? '',
    employmentNumber: '',
    isPrimary: !options.hasActivePrimaryEmployment,
    startsOn: options.defaultStartDate,
    seniorityDate: options.defaultStartDate,
    countryCode: options.defaultCountryCode,
    ikvNumber: String(options.nextIkvNumber),
    workerType: 'EMPLOYEE',
    flexPhaseId: options.flexPhases[0]?.id ?? '',
    laborConditionSetId: options.laborConditionSets[0]?.id ?? '',
    durationType: 'INDEFINITE',
    endsOn: '',
    probationApplies: false,
    probationEndsOn: '',
    isOnCall: false,
    onCallObligation: true,
    workScope: 'FULL_TIME',
    weeklyHours: String(options.laborConditionSets[0]?.standardHoursPerWeek ?? 40),
    partTimeFactor: '1',
    days: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' },
    salaryBasis: 'MANUAL',
    salaryFrequencyId: options.salaryFrequencies.find((item) => item.code === 'MONTHLY')?.id
      ?? options.salaryFrequencies[0]?.id ?? '',
    fulltimeAmount: '',
    parttimeAmount: '',
    salaryScaleStepId: '',
    departmentId: options.departments[0]?.id ?? '',
    jobId: options.jobs[0]?.id ?? '',
    costCenterId: options.costCenters[0]?.id ?? '',
    costCarrierId: options.costCarriers[0]?.id ?? '',
  })

  const steps = [
    labels.stepEmployment, labels.stepContract, labels.stepSchedule,
    labels.stepSalary, labels.stepOther, labels.stepReview,
  ]
  const selectedLaborSet = useMemo(
    () => options.laborConditionSets.find((item) => item.id === draft.laborConditionSetId),
    [draft.laborConditionSetId, options.laborConditionSets],
  )
  const selectedJob = options.jobs.find((item) => item.id === draft.jobId)
  const selectedScale = options.salaryScaleSteps.find((item) => item.id === draft.salaryScaleStepId)
  const employeeAge = ageOn(draft.birthDate, draft.startsOn)
  const minimumRate = options.minimumWageRates.find((rate) =>
    rate.minimumAge === Math.min(Math.max(employeeAge, 15), 21)
    && rate.validFrom <= draft.startsOn
    && (!rate.validUntil || rate.validUntil > draft.startsOn))
  const rosterTotal = dayKeys.reduce((sum, day) => sum + (Number(draft.days[day]) || 0), 0)
  const rosterMatches = Math.abs(rosterTotal - (Number(draft.weeklyHours) || 0)) < 0.0001

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    setState('idle')
    setErrorCode('')
  }

  function updateDay(day: DayKey, value: string): void {
    setDraft((current) => ({ ...current, days: { ...current.days, [day]: value } }))
    setState('idle')
  }

  function distributeHours(hours: string): void {
    const weekly = Number(hours) || 0
    const daily = weekly / 5
    setDraft((current) => ({
      ...current,
      weeklyHours: hours,
      days: {
        monday: String(daily), tuesday: String(daily), wednesday: String(daily),
        thursday: String(daily), friday: String(daily), saturday: '0', sunday: '0',
      },
      partTimeFactor: current.workScope === 'FULL_TIME'
        ? '1'
        : String(weekly / (selectedLaborSet?.standardHoursPerWeek ?? 40)),
    }))
  }

  async function savePrerequisites(): Promise<void> {
    setState('saving')
    const employeeResponse = await fetch(`/api/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        updatedAt: options.prerequisites.updatedAt,
        employeeNumber: draft.employeeNumber,
        nationality: draft.nationality,
        birthDate: draft.birthDate,
        gender: draft.gender,
      }),
    })
    if (!employeeResponse.ok) {
      const result = await employeeResponse.json().catch(() => ({ error: '' })) as { error?: string }
      setErrorCode(result.error ?? '')
      setState('failed')
      return
    }
    if (draft.countryCode === 'NL' && !options.prerequisites.hasBsn) {
      const bsnResponse = await fetch(`/api/employees/${employeeId}/bsn`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bsn: draft.bsn }),
      })
      if (!bsnResponse.ok) {
        const result = await bsnResponse.json().catch(() => ({ error: '' })) as { error?: string }
        setErrorCode(result.error ?? '')
        setState('failed')
        return
      }
    }
    setPrerequisitesComplete(true)
    setState('idle')
  }

  function valid(index: number): boolean {
    if (index === 0) return Boolean(
      draft.employmentNumber && draft.startsOn && draft.seniorityDate
      && draft.countryCode && Number(draft.ikvNumber) >= 1 && Number(draft.ikvNumber) <= 99,
    )
    if (index === 1) return Boolean(
      draft.laborConditionSetId
      && (draft.workerType !== 'TEMPORARY_AGENCY' || draft.flexPhaseId)
      && (draft.durationType === 'INDEFINITE' || (draft.endsOn && draft.endsOn >= draft.startsOn))
      && (!draft.probationApplies || draft.probationEndsOn),
    )
    if (index === 2) return rosterMatches && Number(draft.weeklyHours) >= 0
      && Number(draft.weeklyHours) <= 50
    if (index === 3) return !options.canWriteSalary || (draft.salaryBasis === 'MINIMUM_WAGE' && Boolean(minimumRate))
      || (draft.salaryBasis === 'CUSTOM_SCALE' ? Boolean(draft.salaryScaleStepId) : Boolean(draft.fulltimeAmount))
    if (index === 4) return Boolean(
      draft.departmentId && draft.jobId && draft.costCenterId && draft.costCarrierId,
    )
    return true
  }

  function next(): void {
    if (!valid(step)) { setState('failed'); return }
    setStep((current) => Math.min(current + 1, steps.length - 1))
    setState('idle')
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!steps.every((_item, index) => valid(index))) { setState('failed'); return }
    setState('saving')
    const fulltimeAmount = selectedScale?.fulltimeAmount ?? Number(draft.fulltimeAmount)
    const standardHours = selectedLaborSet?.standardHoursPerWeek ?? 40
    const factor = draft.isOnCall ? 0 : Number(draft.weeklyHours) / standardHours
    const response = await fetch(`/api/employees/${employeeId}/employments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        employment: {
          employmentNumber: draft.employmentNumber,
          startsOn: draft.startsOn,
          seniorityDate: draft.seniorityDate,
          countryCode: draft.countryCode,
          isPrimary: draft.isPrimary,
        },
        incomeRelationship: {
          payrollTaxSubnumber: '0001',
          ikvNumber: Number(draft.ikvNumber),
          validFrom: draft.startsOn,
        },
        contract: {
          workerType: draft.workerType,
          flexPhaseId: draft.workerType === 'TEMPORARY_AGENCY' ? draft.flexPhaseId : null,
          laborConditionSetId: draft.laborConditionSetId,
          durationType: draft.durationType,
          startsOn: draft.startsOn,
          endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : null,
          probationApplies: draft.probationApplies,
          probationEndsOn: draft.probationApplies ? draft.probationEndsOn : null,
        },
        schedule: {
          scheduleType: 'HOURS_PER_DAY',
          startWeek: 1,
          averageDaysPerWeek: dayKeys.filter((day) => Number(draft.days[day]) > 0).length,
          averageHoursPerWeek: Number(draft.weeklyHours),
          partTimeFactor: draft.workScope === 'FULL_TIME' ? 1 : factor,
          timeForTimeAccrual: 0,
          mondayHours: Number(draft.days.monday), tuesdayHours: Number(draft.days.tuesday),
          wednesdayHours: Number(draft.days.wednesday), thursdayHours: Number(draft.days.thursday),
          fridayHours: Number(draft.days.friday), saturdayHours: Number(draft.days.saturday),
          sundayHours: Number(draft.days.sunday),
          isOnCall: draft.isOnCall,
          onCallObligation: draft.isOnCall ? draft.onCallObligation : null,
          workScope: draft.isOnCall ? null : draft.workScope,
          validFrom: draft.startsOn,
        },
        salary: options.canWriteSalary ? {
          paymentType: draft.salaryBasis === 'MINIMUM_WAGE' ? 'HOURLY_VARIABLE' : 'PERIODIC_FIXED',
          paymentFrequency: options.salaryFrequencies.find(
            (item) => item.id === draft.salaryFrequencyId,
          )?.code ?? 'MONTHLY',
          salaryFrequencyId: draft.salaryFrequencyId,
          salaryBasis: draft.salaryBasis,
          fulltimeAmount: draft.salaryBasis === 'MINIMUM_WAGE' ? null : fulltimeAmount,
          parttimeAmount: draft.salaryBasis === 'MINIMUM_WAGE'
            ? null
            : Number(draft.parttimeAmount || fulltimeAmount * factor),
          hourlyRate: draft.salaryBasis === 'MINIMUM_WAGE' ? minimumRate?.hourlyAmount ?? null : null,
          currencyCode: 'EUR',
          salaryScaleStepId: draft.salaryBasis === 'CUSTOM_SCALE' ? draft.salaryScaleStepId : null,
          validFrom: draft.startsOn,
        } : undefined,
        organization: {
          departmentId: draft.departmentId,
          jobId: draft.jobId,
          jobTitle: selectedJob?.name ?? '',
          effectiveFrom: draft.startsOn,
        },
        costAllocation: {
          validFrom: draft.startsOn,
          allocations: [{
            costCenterId: draft.costCenterId,
            costCarrierId: draft.costCarrierId,
            percentage: 100,
          }],
        },
      }),
    })
    const result = await response.json() as { data?: { employmentId: string }; code?: string }
    if (!response.ok || !result.data) {
      setErrorCode(result.code ?? '')
      setState('failed')
      return
    }
    setState('saved')
    router.push(`/employees/${employeeId}/employments/${result.data.employmentId}`)
    router.refresh()
  }

  const inputClass = 'form-field'
  if (!prerequisitesComplete) {
    return <section className="rounded-2xl border bg-surface p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{labels.prerequisitesTitle}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={labels.employeeNumber}><input className={inputClass} value={draft.employeeNumber} onChange={(event) => update('employeeNumber', event.target.value)} /></Field>
        <Field label={labels.country}><input className={inputClass} maxLength={2} value={draft.countryCode} onChange={(event) => update('countryCode', event.target.value.toUpperCase())} /></Field>
        <Field label={labels.nationality}><input className={inputClass} maxLength={2} value={draft.nationality} onChange={(event) => update('nationality', event.target.value.toUpperCase())} /></Field>
        <Field label={labels.birthDate}><input type="date" className={inputClass} value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></Field>
        <Field label={labels.gender}><select className={inputClass} value={draft.gender} onChange={(event) => update('gender', event.target.value)}><option value="" /><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></select></Field>
        {draft.countryCode === 'NL' && !options.prerequisites.hasBsn && <Field label={labels.bsn}><input inputMode="numeric" className={inputClass} value={draft.bsn} onChange={(event) => update('bsn', event.target.value)} /></Field>}
      </div>
      {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{labels.failed}</p>}
      <div className="mt-5 flex justify-end border-t pt-4"><button type="button" className="button-primary" disabled={state === 'saving'} onClick={savePrerequisites}>{labels.savePrerequisites}</button></div>
    </section>
  }

  return <form onSubmit={submit} className="rounded-2xl border bg-surface p-5 shadow-sm">
    <nav aria-label={labels.title}>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {steps.map((label, index) => <li key={label} className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${index === step ? 'border-primary bg-primary/10 text-primary' : index < step ? 'border-success/40 bg-success/10' : 'text-muted-foreground'}`}>{index + 1}. {label}</li>)}
      </ol>
    </nav>

    {step === 0 && <WizardStep title={labels.stepEmployment}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.employmentNumber}><input autoFocus className={inputClass} value={draft.employmentNumber} onChange={(event) => update('employmentNumber', event.target.value)} /></Field>
        <Field label={labels.country}><input className={inputClass} maxLength={2} value={draft.countryCode} onChange={(event) => update('countryCode', event.target.value.toUpperCase())} /></Field>
        <Field label={labels.primaryEmployment}><select className={inputClass} value={String(draft.isPrimary)} onChange={(event) => update('isPrimary', event.target.value === 'true')}><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select></Field>
        <Field label={labels.ikvNumber}><input type="number" min="1" max="99" className={inputClass} value={draft.ikvNumber} onChange={(event) => update('ikvNumber', event.target.value)} /></Field>
        <Field label={labels.startDate}><input type="date" className={inputClass} value={draft.startsOn} onChange={(event) => { update('startsOn', event.target.value); update('seniorityDate', event.target.value) }} /></Field>
        <Field label={labels.seniorityDate}><input type="date" className={inputClass} value={draft.seniorityDate} onChange={(event) => update('seniorityDate', event.target.value)} /></Field>
      </div>
    </WizardStep>}

    {step === 1 && <WizardStep title={labels.stepContract}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.workerType}><select className={inputClass} value={draft.workerType} onChange={(event) => update('workerType', event.target.value as WorkerType)}><option value="EMPLOYEE">{labels.workerEmployee}</option><option value="STUDENT_INTERN">{labels.workerStudentIntern}</option><option value="TEMPORARY_AGENCY">{labels.workerTemporaryAgency}</option><option value="EXTERNAL_NO_PAYROLL">{labels.workerExternal}</option></select></Field>
        {draft.workerType === 'TEMPORARY_AGENCY' && <Field label={labels.flexPhase}><select className={inputClass} value={draft.flexPhaseId} onChange={(event) => update('flexPhaseId', event.target.value)}>{options.flexPhases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        <Field label={labels.laborConditions}><select className={inputClass} value={draft.laborConditionSetId} onChange={(event) => update('laborConditionSetId', event.target.value)}>{options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label={labels.duration}><select className={inputClass} value={draft.durationType} onChange={(event) => update('durationType', event.target.value as DurationType)}><option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option></select></Field>
        <Field label={labels.startDate}><input type="date" readOnly className={`${inputClass} bg-muted/40`} value={draft.startsOn} /></Field>
        {draft.durationType === 'DEFINITE' && <Field label={labels.endDate}><input type="date" min={draft.startsOn} className={inputClass} value={draft.endsOn} onChange={(event) => update('endsOn', event.target.value)} /></Field>}
        <Field label={labels.probation}><select className={inputClass} value={String(draft.probationApplies)} onChange={(event) => update('probationApplies', event.target.value === 'true')}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></Field>
        {draft.probationApplies && <Field label={labels.probationEnd}><input type="date" min={draft.startsOn} className={inputClass} value={draft.probationEndsOn} onChange={(event) => update('probationEndsOn', event.target.value)} /><span className="flex flex-wrap gap-2"><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'FOUR_WEEKS'))}>{labels.addFourWeeks}</SmallButton><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'ONE_MONTH'))}>{labels.addOneMonth}</SmallButton><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'TWO_MONTHS'))}>{labels.addTwoMonths}</SmallButton></span></Field>}
      </div>
    </WizardStep>}

    {step === 2 && <WizardStep title={labels.stepSchedule}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.onCallEmployee}><select className={inputClass} value={String(draft.isOnCall)} onChange={(event) => update('isOnCall', event.target.value === 'true')}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></Field>
        {draft.isOnCall ? <Field label={labels.onCallObligation}><select className={inputClass} value={String(draft.onCallObligation)} onChange={(event) => update('onCallObligation', event.target.value === 'true')}><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select></Field> : <Field label={labels.employmentScope}><select className={inputClass} value={draft.workScope} onChange={(event) => update('workScope', event.target.value as Draft['workScope'])}><option value="FULL_TIME">{labels.fullTime}</option><option value="PART_TIME">{labels.partTime}</option></select></Field>}
        <Field label={labels.weeklyHours}><input type="number" min="0" max="50" step="0.01" className={inputClass} value={draft.weeklyHours} onChange={(event) => distributeHours(event.target.value)} /></Field>
        {!draft.isOnCall && <Field label={labels.partTimeFactor}><input readOnly className={`${inputClass} bg-muted/40`} value={draft.workScope === 'FULL_TIME' ? '100%' : `${Math.round(Number(draft.partTimeFactor) * 10000) / 100}%`} /></Field>}
      </div>
      <h4 className="mt-6 font-semibold">{labels.roster}</h4>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{dayKeys.map((day) => <Field key={day} label={labels[day]}><input type="number" min="0" max="24" step="0.25" className={inputClass} value={draft.days[day]} onChange={(event) => updateDay(day, event.target.value)} /></Field>)}</div>
      {!rosterMatches && <p role="alert" className="mt-3 text-sm text-destructive">{labels.rosterMismatch}</p>}
    </WizardStep>}

    {step === 3 && <WizardStep title={labels.stepSalary}>
      {!options.canWriteSalary ? <p className="text-sm text-muted-foreground">{labels.failed}</p> : <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.salaryCalculation}><select className={inputClass} value={draft.salaryBasis} onChange={(event) => update('salaryBasis', event.target.value as SalaryBasis)}><option value="MANUAL">{labels.salaryManual}</option><option value="MINIMUM_WAGE">{labels.salaryMinimum}</option><option value="CUSTOM_SCALE">{labels.salaryTable}</option></select></Field>
        <Field label={labels.frequency}><select className={inputClass} value={draft.salaryFrequencyId} onChange={(event) => update('salaryFrequencyId', event.target.value)}>{options.salaryFrequencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {draft.salaryBasis === 'CUSTOM_SCALE' && <Field label={labels.salaryScaleStep}><select className={inputClass} value={draft.salaryScaleStepId} onChange={(event) => update('salaryScaleStepId', event.target.value)}><option value="" />{options.salaryScaleSteps.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>}
        {draft.salaryBasis === 'MINIMUM_WAGE' && <Field label={labels.minimumHourlyRate}><input readOnly className={`${inputClass} bg-muted/40`} value={minimumRate ? `€ ${minimumRate.hourlyAmount.toFixed(2)}` : '—'} /></Field>}
        {draft.salaryBasis === 'MANUAL' && <><Field label={labels.fulltimeSalary}><input type="number" min="0" step="0.01" className={inputClass} value={draft.fulltimeAmount} onChange={(event) => { update('fulltimeAmount', event.target.value); const factor = Number(draft.weeklyHours) / (selectedLaborSet?.standardHoursPerWeek ?? 40); update('parttimeAmount', String(Number(event.target.value) * factor)) }} /></Field>{Number(draft.weeklyHours) !== (selectedLaborSet?.standardHoursPerWeek ?? 40) && <Field label={labels.parttimeSalary}><input type="number" min="0" step="0.01" className={inputClass} value={draft.parttimeAmount} onChange={(event) => { update('parttimeAmount', event.target.value); const factor = Number(draft.weeklyHours) / (selectedLaborSet?.standardHoursPerWeek ?? 40); if (factor > 0) update('fulltimeAmount', String(Number(event.target.value) / factor)) }} /></Field>}</>}
      </div>}
    </WizardStep>}

    {step === 4 && <WizardStep title={labels.stepOther}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.job}><select className={inputClass} value={draft.jobId} onChange={(event) => update('jobId', event.target.value)}>{options.jobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field label={labels.department}><select className={inputClass} value={draft.departmentId} onChange={(event) => update('departmentId', event.target.value)}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field label={labels.costCenter}><select className={inputClass} value={draft.costCenterId} onChange={(event) => update('costCenterId', event.target.value)}>{options.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field label={labels.costCarrier}><select className={inputClass} value={draft.costCarrierId} onChange={(event) => update('costCarrierId', event.target.value)}>{options.costCarriers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
      </div>
    </WizardStep>}

    {step === 5 && <WizardStep title={labels.completeSummary}>
      <p className="text-sm text-muted-foreground">{labels.createHint}</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Summary label={labels.employmentNumber} value={draft.employmentNumber} />
        <Summary label={labels.startDate} value={draft.startsOn} />
        <Summary label={labels.workerType} value={draft.workerType} />
        <Summary label={labels.laborConditions} value={selectedLaborSet?.name ?? ''} />
        <Summary label={labels.weeklyHours} value={draft.weeklyHours} />
        <Summary label={labels.job} value={selectedJob?.name ?? ''} />
      </dl>
    </WizardStep>}

    {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{errorCode || labels.requiredFields}</p>}
    {state === 'saved' && <p className="mt-4 text-sm text-success">{labels.saved}</p>}
    <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
      <button type="button" className="button-secondary" disabled={step === 0 || state === 'saving'} onClick={() => setStep((current) => Math.max(0, current - 1))}>{labels.previous}</button>
      {step < steps.length - 1 ? <button type="button" className="button-primary" onClick={next}>{labels.next}</button> : <button type="submit" className="button-primary" disabled={state === 'saving'}>{labels.submit}</button>}
    </div>
  </form>
}

function WizardStep({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6"><h3 className="mb-5 text-xl font-semibold">{title}</h3>{children}</section>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid content-start gap-1.5 text-sm font-medium">{label}{children}</label>
}

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-muted" onClick={onClick}>{children}</button>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value || '—'}</dd></div>
}

function ageOn(birthDate: string, date: string): number {
  if (!birthDate || !date) return 21
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [year, month, day] = date.split('-').map(Number)
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0)
}
