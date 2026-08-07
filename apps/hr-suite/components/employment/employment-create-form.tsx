'use client'

import { useRouter } from 'next/navigation'
import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { CountryPicker } from '@/components/ui/country-picker'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'
import { calculateCappedPartTimeFactor } from '@/lib/employment/fulltime-reference'

type EmploymentType = 'EMPLOYEE' | 'INTERN' | 'TEMPORARY_AGENCY' | 'FREELANCER' | 'VOLUNTEER' | 'NO_PAYROLL'
type WorkerType = 'EMPLOYEE' | 'STUDENT_INTERN' | 'TEMPORARY_AGENCY' | 'EXTERNAL_NO_PAYROLL'
type DurationType = 'INDEFINITE' | 'DEFINITE'
type SalaryBasis = 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE'
type StepKey = 'administration' | 'employment' | 'payrollChoice' | 'contract' | 'schedule' | 'salary' | 'other' | 'review'

export interface EmploymentCreateFormProps {
  employeeId: string
  options: EmploymentCreationOptions
  showNavigation?: boolean
  showPayrollChoice?: boolean
  onStepChange?: (step: number) => void
  onPayrollChoiceChange?: (include: boolean) => void
  onSaved?: (employmentId: string) => void
  labels: {
    title: string; submit: string; saved: string; failed: string; previous: string; next: string
    requiredFields: string; employmentNumber: string; primaryEmployment: string; yes: string; no: string
    required: string; optional: string
    administration: string; administrationSearch: string; administrationDetails: string; administrationNumber: string; cocNumber: string; vatNumber: string
    startDate: string; seniorityDate: string; country: string; ikvNumber: string
    prerequisitesTitle: string; nationality: string; bsn: string; birthDate: string; gender: string
    savePrerequisites: string; prerequisiteSaved: string; bsnOptionalHelp: string
    countrySearch: string; countryNoResults: string
    genderMale: string; genderFemale: string; genderOther: string; genderUndisclosed: string
    stepAdministration: string; stepEmployment: string; stepPayrollChoice: string; stepContract: string; stepSchedule: string; stepSalary: string
    stepOther: string; stepReview: string; payrollChoiceTitle: string; payrollChoiceHelp: string; addPayrollDetails: string; skipPayrollDetails: string
    workerType: string; workerEmployee: string; workerStudentIntern: string; workerTemporaryAgency: string; workerFreelancer: string; workerVolunteer: string; workerNoPayroll: string
    flexPhase: string; laborConditions: string; duration: string; indefinite: string; definite: string
    endDate: string; probation: string; probationEnd: string; addFourWeeks: string
    addOneMonth: string; addTwoMonths: string; onCallEmployee: string; onCallObligation: string
    employmentScope: string; fullTime: string; partTime: string; weeklyHours: string; fulltimeReference: string
    partTimeFactor: string; roster: string; rosterMismatch: string; monday: string; tuesday: string
    wednesday: string; thursday: string; friday: string; saturday: string; sunday: string
    salaryCalculation: string; salaryManual: string; salaryMinimum: string; salaryTable: string
    frequency: string; frequencySingleHelp: string; frequencyNone: string; fulltimeSalary: string; parttimeSalary: string
    salaryScale: string; salaryScaleStep: string; salaryScaleAmount: string; minimumHourlyRate: string
    jobGroup: string; department: string; job: string; manager: string; noManager: string; costCenter: string; costCarrier: string
    splitCostCenter: string; addAllocation: string; removeAllocation: string; allocationPercentage: string; allocationTotal: string; allocationMismatch: string
    completeSummary: string; createHint: string; optionsLoading: string
  }
}

interface AllocationDraft { costCenterId: string; costCarrierId: string; percentage: string }

interface Draft {
  administrationId: string; nationality: string; bsn: string; birthDate: string; gender: string
  employmentNumber: string; employmentType: EmploymentType; isPrimary: boolean; startsOn: string; seniorityDate: string
  countryCode: string; ikvNumber: string; flexPhaseId: string; laborConditionSetId: string; durationType: DurationType; endsOn: string
  probationApplies: boolean; probationEndsOn: string; isOnCall: boolean; onCallObligation: boolean
  workScope: 'FULL_TIME' | 'PART_TIME'; weeklyHours: string; partTimeFactor: string; days: Record<DayKey, string>
  salaryBasis: SalaryBasis; salaryFrequencyId: string; fulltimeAmount: string; parttimeAmount: string; salaryScaleId: string; salaryScaleStepId: string
  jobGroupId: string; departmentId: string; jobId: string; managerEmployeeId: string; allocations: AllocationDraft[]
}

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const dayKeys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
type EmploymentFieldLabels = Pick<EmploymentCreateFormProps['labels'], 'required' | 'optional'>
const employmentFieldLabelsContext = createContext<EmploymentFieldLabels | null>(null)

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

function workerTypeForEmployment(type: EmploymentType): WorkerType {
  if (type === 'INTERN') return 'STUDENT_INTERN'
  if (type === 'TEMPORARY_AGENCY') return 'TEMPORARY_AGENCY'
  if (type === 'EMPLOYEE') return 'EMPLOYEE'
  return 'EXTERNAL_NO_PAYROLL'
}

function defaultDraft(options: EmploymentCreationOptions): Draft {
  const firstGroup = options.jobGroups[0]?.id ?? ''
  const firstJob = options.jobs.find((job) => job.jobGroupId === firstGroup) ?? options.jobs[0]
  const firstScale = options.salaryScales[0]?.id ?? ''
  return {
    administrationId: options.selectedAdministrationId,
    nationality: normalizeNationalityCode(options.prerequisites.nationality), bsn: '', birthDate: options.prerequisites.birthDate ?? '', gender: options.prerequisites.gender ?? '',
    employmentNumber: '', employmentType: 'EMPLOYEE', isPrimary: !options.hasActivePrimaryEmployment,
    startsOn: options.defaultStartDate, seniorityDate: options.defaultStartDate, countryCode: options.defaultCountryCode, ikvNumber: String(options.nextIkvNumber),
    flexPhaseId: options.flexPhases[0]?.id ?? '', laborConditionSetId: options.laborConditionSets[0]?.id ?? '', durationType: 'INDEFINITE', endsOn: '', probationApplies: false, probationEndsOn: '',
    isOnCall: false, onCallObligation: true, workScope: 'FULL_TIME', weeklyHours: String(options.laborConditionSets[0]?.standardHoursPerWeek ?? 40), partTimeFactor: '1',
    days: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' },
    salaryBasis: 'MANUAL', salaryFrequencyId: options.salaryFrequencies[0]?.id ?? '', fulltimeAmount: '', parttimeAmount: '', salaryScaleId: firstScale,
    salaryScaleStepId: options.salaryScaleSteps.find((step) => step.salaryScaleId === firstScale)?.id ?? '', jobGroupId: firstGroup,
    departmentId: options.departments[0]?.id ?? '', jobId: firstJob?.id ?? '', managerEmployeeId: '',
    allocations: [{ costCenterId: options.costCenters[0]?.id ?? '', costCarrierId: options.costCarriers[0]?.id ?? '', percentage: '100' }],
  }
}

export function EmploymentCreateForm({ employeeId, options: initialOptions, showNavigation = true, showPayrollChoice = false, onStepChange, onPayrollChoiceChange, onSaved, labels }: EmploymentCreateFormProps) {
  const router = useRouter()
  const [options, setOptions] = useState(initialOptions)
  const missingPrerequisites = !options.prerequisites.nationality || !options.prerequisites.birthDate || !options.prerequisites.gender
  const [prerequisitesComplete, setPrerequisitesComplete] = useState(!missingPrerequisites)
  const [bsnSaved, setBsnSaved] = useState(options.prerequisites.hasBsn)
  const [step, setStep] = useState(0)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [errorCode, setErrorCode] = useState('')
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [payrollDetails, setPayrollDetails] = useState(!showPayrollChoice)
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(initialOptions))

  const stepKeys: StepKey[] = showPayrollChoice
    ? payrollDetails ? ['administration', 'employment', 'payrollChoice', 'contract', 'schedule', 'salary', 'other', 'review'] : ['administration', 'employment', 'payrollChoice', 'review']
    : ['administration', 'employment', 'contract', 'schedule', 'salary', 'other', 'review']
  const stepLabels: Record<StepKey, string> = {
    administration: labels.stepAdministration, employment: labels.stepEmployment, payrollChoice: labels.stepPayrollChoice,
    contract: labels.stepContract, schedule: labels.stepSchedule, salary: labels.stepSalary, other: labels.stepOther, review: labels.stepReview,
  }
  const currentStep = stepKeys[step] ?? 'administration'
  const selectedLaborSet = useMemo(() => options.laborConditionSets.find((item) => item.id === draft.laborConditionSetId), [draft.laborConditionSetId, options.laborConditionSets])
  const selectedFulltimeHours = selectedLaborSet?.standardHoursPerWeek ?? 40
  const filteredJobs = useMemo(() => options.jobs.filter((job) => !draft.jobGroupId || job.jobGroupId === draft.jobGroupId), [draft.jobGroupId, options.jobs])
  const selectedJob = options.jobs.find((item) => item.id === draft.jobId)
  const selectedScale = options.salaryScaleSteps.find((item) => item.id === draft.salaryScaleStepId)
  const employeeAge = ageOn(draft.birthDate, draft.startsOn)
  const minimumRate = options.minimumWageRates.find((rate) => rate.minimumAge === Math.min(Math.max(employeeAge, 15), 21) && rate.validFrom <= draft.startsOn && (!rate.validUntil || rate.validUntil > draft.startsOn))
  const rosterTotal = dayKeys.reduce((sum, day) => sum + (Number(draft.days[day]) || 0), 0)
  const rosterMatches = Math.abs(rosterTotal - (Number(draft.weeklyHours) || 0)) < 0.0001
  const allocationTotal = draft.allocations.reduce((sum, allocation) => sum + (Number(allocation.percentage) || 0), 0)
  const allocationsMatch = Math.abs(allocationTotal - 100) < 0.0001

  useEffect(() => { onStepChange?.(step) }, [onStepChange, step])

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (key === 'laborConditionSetId') {
        const laborSet = options.laborConditionSets.find((item) => item.id === String(value))
        next.partTimeFactor = String(calculateCappedPartTimeFactor(Number(current.weeklyHours), laborSet?.standardHoursPerWeek ?? 40))
      }
      if (key === 'jobGroupId') {
        next.jobId = options.jobs.find((job) => job.jobGroupId === String(value))?.id ?? ''
      }
      if (key === 'salaryScaleId') {
        next.salaryScaleStepId = options.salaryScaleSteps.find((item) => item.salaryScaleId === String(value))?.id ?? ''
      }
      return next
    })
    setState('idle'); setErrorCode('')
  }

  function updateAllocation(index: number, key: keyof AllocationDraft, value: string): void {
    setDraft((current) => ({ ...current, allocations: current.allocations.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, [key]: value } : allocation) }))
    setState('idle')
  }

  function updateDay(day: DayKey, value: string): void {
    setDraft((current) => ({ ...current, days: { ...current.days, [day]: value } })); setState('idle')
  }

  function distributeHours(hours: string): void {
    const weekly = Number(hours) || 0
    const daily = weekly / 5
    setDraft((current) => ({ ...current, weeklyHours: hours, days: { monday: String(daily), tuesday: String(daily), wednesday: String(daily), thursday: String(daily), friday: String(daily), saturday: '0', sunday: '0' }, partTimeFactor: String(calculateCappedPartTimeFactor(weekly, selectedFulltimeHours)) }))
  }

  async function changeAdministration(administrationId: string): Promise<void> {
    update('administrationId', administrationId)
    setOptionsLoading(true)
    const response = await fetch(`/api/employees/${employeeId}/employment-options?administrationId=${encodeURIComponent(administrationId)}`)
    const result = await response.json() as { data?: EmploymentCreationOptions }
    if (!response.ok || !result.data) { setErrorCode('ADMINISTRATION_OPTIONS_FAILED'); setState('failed'); setOptionsLoading(false); return }
    const nextOptions = result.data
    setOptions(nextOptions)
    setDraft((current) => {
      const next = defaultDraft(nextOptions)
      return { ...next, employmentNumber: current.employmentNumber, employmentType: current.employmentType, isPrimary: current.isPrimary, startsOn: current.startsOn, seniorityDate: current.seniorityDate, bsn: current.bsn, nationality: current.nationality, birthDate: current.birthDate, gender: current.gender }
    })
    setOptionsLoading(false); setState('idle')
  }

  async function savePrerequisites(): Promise<void> {
    setState('saving')
    const employeeResponse = await fetch(`/api/employees/${employeeId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updatedAt: options.prerequisites.updatedAt, nationality: draft.nationality, birthDate: draft.birthDate, gender: draft.gender }) })
    if (!employeeResponse.ok) { const result = await employeeResponse.json().catch(() => ({ error: '' })) as { error?: string }; setErrorCode(result.error ?? ''); setState('failed'); return }
    if (draft.countryCode === 'NL' && !bsnSaved && draft.bsn) {
      const bsnResponse = await fetch(`/api/employees/${employeeId}/bsn`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bsn: draft.bsn }) })
      if (!bsnResponse.ok) { const result = await bsnResponse.json().catch(() => ({ error: '' })) as { error?: string }; setErrorCode(result.error ?? ''); setState('failed'); return }
      setBsnSaved(true)
    }
    setPrerequisitesComplete(true); setState('idle')
  }

  function setPayrollChoice(include: boolean): void {
    setPayrollDetails(include); onPayrollChoiceChange?.(include); setState('idle'); setErrorCode('')
    setStep((current) => include ? Math.min(current, 2) : current > 2 ? 3 : current)
  }

  function valid(key: StepKey): boolean {
    if (key === 'administration') return Boolean(draft.administrationId) && !optionsLoading
    if (key === 'employment') return Boolean(draft.employmentNumber && draft.startsOn && draft.seniorityDate && draft.countryCode && (!payrollDetails || (Number(draft.ikvNumber) >= 1 && Number(draft.ikvNumber) <= 99)))
    if (key === 'payrollChoice' || key === 'review') return true
    if (key === 'contract') return Boolean(draft.laborConditionSetId && (draft.employmentType !== 'TEMPORARY_AGENCY' || draft.flexPhaseId) && (draft.durationType === 'INDEFINITE' || (draft.endsOn && draft.endsOn >= draft.startsOn)) && (!draft.probationApplies || draft.probationEndsOn))
    if (key === 'schedule') return rosterMatches && Number(draft.weeklyHours) >= 0 && Number(draft.weeklyHours) <= 50
    if (key === 'salary') {
      if (!options.canWriteSalary) return true
      if (!draft.salaryFrequencyId) return false
      if (draft.salaryBasis === 'MINIMUM_WAGE') return Boolean(minimumRate)
      if (draft.salaryBasis === 'CUSTOM_SCALE') return Boolean(draft.salaryScaleStepId)
      return Boolean(draft.fulltimeAmount)
    }
    return Boolean(draft.jobGroupId && draft.jobId && draft.departmentId && draft.allocations.every((allocation) => allocation.costCenterId && allocation.costCarrierId) && allocationsMatch)
  }

  function next(): void {
    if (!valid(currentStep)) { setState('failed'); return }
    setStep((current) => Math.min(current + 1, stepKeys.length - 1)); setState('idle')
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!stepKeys.every((key) => valid(key))) { setState('failed'); return }
    setState('saving')
    if (draft.countryCode === 'NL' && !bsnSaved && draft.bsn) {
      const bsnResponse = await fetch(`/api/employees/${employeeId}/bsn`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bsn: draft.bsn }) })
      if (!bsnResponse.ok) { const result = await bsnResponse.json().catch(() => ({ error: '' })) as { error?: string }; setErrorCode(result.error ?? ''); setState('failed'); return }
      setBsnSaved(true)
    }
    const fulltimeAmount = selectedScale?.fulltimeAmount ?? Number(draft.fulltimeAmount)
    const standardHours = selectedLaborSet?.standardHoursPerWeek ?? 40
    const factor = draft.isOnCall ? 0 : calculateCappedPartTimeFactor(Number(draft.weeklyHours), standardHours)
    const workScope = draft.isOnCall ? null : Number(draft.weeklyHours) >= standardHours ? 'FULL_TIME' : 'PART_TIME'
    const payload = payrollDetails ? {
      employment: { employmentNumber: draft.employmentNumber, employmentType: draft.employmentType, startsOn: draft.startsOn, seniorityDate: draft.seniorityDate, countryCode: draft.countryCode, isPrimary: draft.isPrimary },
      incomeRelationship: { payrollTaxSubnumber: '0001', ikvNumber: Number(draft.ikvNumber), validFrom: draft.startsOn },
      contract: { workerType: workerTypeForEmployment(draft.employmentType), flexPhaseId: draft.employmentType === 'TEMPORARY_AGENCY' ? draft.flexPhaseId : null, laborConditionSetId: draft.laborConditionSetId, durationType: draft.durationType, startsOn: draft.startsOn, endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : null, probationApplies: draft.probationApplies, probationEndsOn: draft.probationApplies ? draft.probationEndsOn : null },
      schedule: { scheduleType: 'HOURS_PER_DAY', startWeek: 1, averageDaysPerWeek: dayKeys.filter((day) => Number(draft.days[day]) > 0).length, averageHoursPerWeek: Number(draft.weeklyHours), partTimeFactor: factor, timeForTimeAccrual: 0, mondayHours: Number(draft.days.monday), tuesdayHours: Number(draft.days.tuesday), wednesdayHours: Number(draft.days.wednesday), thursdayHours: Number(draft.days.thursday), fridayHours: Number(draft.days.friday), saturdayHours: Number(draft.days.saturday), sundayHours: Number(draft.days.sunday), isOnCall: draft.isOnCall, onCallObligation: draft.isOnCall ? draft.onCallObligation : null, workScope, validFrom: draft.startsOn },
      salary: options.canWriteSalary ? { paymentType: draft.salaryBasis === 'MINIMUM_WAGE' ? 'HOURLY_VARIABLE' : 'PERIODIC_FIXED', paymentFrequency: options.salaryFrequencies.find((item) => item.id === draft.salaryFrequencyId)?.code ?? 'MONTHLY', salaryFrequencyId: draft.salaryFrequencyId, salaryBasis: draft.salaryBasis, fulltimeAmount: draft.salaryBasis === 'MINIMUM_WAGE' ? null : fulltimeAmount, parttimeAmount: draft.salaryBasis === 'MINIMUM_WAGE' ? null : Number(draft.parttimeAmount || fulltimeAmount * factor), hourlyRate: draft.salaryBasis === 'MINIMUM_WAGE' ? minimumRate?.hourlyAmount ?? null : null, currencyCode: 'EUR', salaryScaleStepId: draft.salaryBasis === 'CUSTOM_SCALE' ? draft.salaryScaleStepId : null, validFrom: draft.startsOn } : undefined,
      organization: { departmentId: draft.departmentId, jobId: draft.jobId, jobTitle: selectedJob?.name ?? '', managerEmployeeId: draft.managerEmployeeId || null, effectiveFrom: draft.startsOn },
      costAllocation: { validFrom: draft.startsOn, allocations: draft.allocations.map((allocation) => ({ costCenterId: allocation.costCenterId, costCarrierId: allocation.costCarrierId, percentage: Number(allocation.percentage) })) },
    } : {
      employment: { employmentNumber: draft.employmentNumber, employmentType: draft.employmentType, startsOn: draft.startsOn, seniorityDate: draft.seniorityDate, countryCode: draft.countryCode, isPrimary: draft.isPrimary },
    }
    const response = await fetch(`/api/employees/${employeeId}/employments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ administrationId: draft.administrationId, input: payload }) })
    const result = await response.json() as { data?: { employmentId: string }; code?: string }
    if (!response.ok || !result.data) { setErrorCode(result.code ?? ''); setState('failed'); return }
    setState('saved')
    if (onSaved) onSaved(result.data.employmentId)
    else { router.push(`/employees/${employeeId}/employments/${result.data.employmentId}`); router.refresh() }
  }

  const inputClass = 'form-field'
  if (!prerequisitesComplete) return <employmentFieldLabelsContext.Provider value={labels}><section className="rounded-2xl border bg-surface p-5 shadow-sm"><h3 className="text-lg font-semibold">{labels.prerequisitesTitle}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field required label={labels.country}><CountryPicker value={draft.countryCode} onChange={(value) => update('countryCode', value)} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field><Field required label={labels.nationality}><CountryPicker value={draft.nationality} onChange={(value) => update('nationality', value)} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field><Field required label={labels.birthDate}><input type="date" className={inputClass} value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></Field><Field required label={labels.gender}><select className={inputClass} value={draft.gender} onChange={(event) => update('gender', event.target.value)}><option value="" /><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></select></Field>{draft.countryCode === 'NL' && !options.prerequisites.hasBsn && <Field label={labels.bsn}><input inputMode="numeric" className={inputClass} value={draft.bsn} onChange={(event) => update('bsn', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{labels.bsnOptionalHelp}</span></Field>}</div>{state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{labels.failed}</p>}<div className="mt-5 flex justify-end border-t pt-4"><button type="button" className="button-primary" disabled={state === 'saving'} onClick={() => void savePrerequisites()}>{labels.savePrerequisites}</button></div></section></employmentFieldLabelsContext.Provider>

  return <employmentFieldLabelsContext.Provider value={labels}><form onSubmit={(event) => void submit(event)} className="rounded-2xl border bg-surface p-5 shadow-sm">
    {showNavigation && <nav aria-label={labels.title}><ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{stepKeys.map((key, index) => <li key={key} className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${index === step ? 'border-primary bg-primary/10 text-primary' : index < step ? 'border-success/40 bg-success/10' : 'text-muted-foreground'}`}>{index + 1}. {stepLabels[key]}</li>)}</ol></nav>}
    {optionsLoading && <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{labels.optionsLoading}</p>}

    {currentStep === 'administration' && <WizardStep title={labels.stepAdministration}><Field required label={labels.administration}><DropdownSelect value={draft.administrationId} onChange={(event) => void changeAdministration(event.target.value)} searchable searchPlaceholder={labels.administrationSearch} emptyLabel={labels.frequencyNone}><option value="" />{options.administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name} · {administration.code}</option>)}</DropdownSelect></Field>{options.administrations.find((item) => item.id === draft.administrationId) && <details className="mt-5 rounded-xl border bg-muted/20 p-4"><summary className="cursor-pointer font-semibold">{labels.administrationDetails}</summary><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><Summary label={labels.administrationNumber} value={options.administrations.find((item) => item.id === draft.administrationId)?.administrationNumber ?? ''} /><Summary label={labels.cocNumber} value={options.administrations.find((item) => item.id === draft.administrationId)?.cocNumber ?? ''} /><Summary label={labels.vatNumber} value={options.administrations.find((item) => item.id === draft.administrationId)?.vatNumber ?? ''} /></dl></details>}</WizardStep>}

    {currentStep === 'employment' && <WizardStep title={labels.stepEmployment}><div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.workerType}><DropdownSelect value={draft.employmentType} onChange={(event) => update('employmentType', event.target.value as EmploymentType)}><option value="EMPLOYEE">{labels.workerEmployee}</option><option value="INTERN">{labels.workerStudentIntern}</option><option value="TEMPORARY_AGENCY">{labels.workerTemporaryAgency}</option><option value="FREELANCER">{labels.workerFreelancer}</option><option value="VOLUNTEER">{labels.workerVolunteer}</option><option value="NO_PAYROLL">{labels.workerNoPayroll}</option></DropdownSelect></Field><Field required label={labels.employmentNumber}><input autoFocus className={inputClass} value={draft.employmentNumber} onChange={(event) => update('employmentNumber', event.target.value)} /></Field><Field required label={labels.country}><CountryPicker value={draft.countryCode} onChange={(value) => update('countryCode', value)} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field><Field required label={labels.primaryEmployment}><select className={inputClass} value={String(draft.isPrimary)} onChange={(event) => update('isPrimary', event.target.value === 'true')}><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select></Field><Field label={labels.ikvNumber}><input type="number" min="1" max="99" className={inputClass} value={draft.ikvNumber} onChange={(event) => update('ikvNumber', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{labels.skipPayrollDetails}</span></Field><Field required label={labels.startDate}><input type="date" className={inputClass} value={draft.startsOn} onChange={(event) => { update('startsOn', event.target.value); update('seniorityDate', event.target.value) }} /></Field><Field required label={labels.seniorityDate}><input type="date" className={inputClass} value={draft.seniorityDate} onChange={(event) => update('seniorityDate', event.target.value)} /></Field>{draft.countryCode === 'NL' && !bsnSaved && <Field label={labels.bsn}><input inputMode="numeric" className={inputClass} value={draft.bsn} onChange={(event) => update('bsn', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{labels.bsnOptionalHelp}</span></Field>}</div></WizardStep>}

    {currentStep === 'payrollChoice' && <WizardStep title={labels.payrollChoiceTitle}><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{labels.payrollChoiceHelp}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" className={`rounded-2xl border p-5 text-left transition ${payrollDetails ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => setPayrollChoice(true)}><span className="font-semibold">{labels.addPayrollDetails}</span></button><button type="button" className={`rounded-2xl border p-5 text-left transition ${!payrollDetails ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => setPayrollChoice(false)}><span className="font-semibold">{labels.skipPayrollDetails}</span></button></div></WizardStep>}

    {currentStep === 'contract' && <WizardStep title={labels.stepContract}><div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.laborConditions}><DropdownSelect value={draft.laborConditionSetId} onChange={(event) => update('laborConditionSetId', event.target.value)} searchable searchPlaceholder={labels.laborConditions} emptyLabel={labels.frequencyNone}>{options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.fulltimeReference}><input readOnly className={`${inputClass} bg-muted/40`} value={`${selectedFulltimeHours}`} /></Field>{draft.employmentType === 'TEMPORARY_AGENCY' && <Field required label={labels.flexPhase}><DropdownSelect value={draft.flexPhaseId} onChange={(event) => update('flexPhaseId', event.target.value)}>{options.flexPhases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect></Field>}<Field required label={labels.duration}><select className={inputClass} value={draft.durationType} onChange={(event) => update('durationType', event.target.value as DurationType)}><option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option></select></Field><Field label={labels.startDate}><input type="date" readOnly className={`${inputClass} bg-muted/40`} value={draft.startsOn} /></Field>{draft.durationType === 'DEFINITE' && <Field required label={labels.endDate}><input type="date" min={draft.startsOn} className={inputClass} value={draft.endsOn} onChange={(event) => update('endsOn', event.target.value)} /></Field>}<Field required label={labels.probation}><select className={inputClass} value={String(draft.probationApplies)} onChange={(event) => update('probationApplies', event.target.value === 'true')}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></Field>{draft.probationApplies && <Field required label={labels.probationEnd}><input type="date" min={draft.startsOn} className={inputClass} value={draft.probationEndsOn} onChange={(event) => update('probationEndsOn', event.target.value)} /><span className="flex flex-wrap gap-2"><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'FOUR_WEEKS'))}>{labels.addFourWeeks}</SmallButton><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'ONE_MONTH'))}>{labels.addOneMonth}</SmallButton><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'TWO_MONTHS'))}>{labels.addTwoMonths}</SmallButton></span></Field>}</div></WizardStep>}

    {currentStep === 'schedule' && <WizardStep title={labels.stepSchedule}><div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.onCallEmployee}><select className={inputClass} value={String(draft.isOnCall)} onChange={(event) => update('isOnCall', event.target.value === 'true')}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></Field>{draft.isOnCall ? <Field required label={labels.onCallObligation}><select className={inputClass} value={String(draft.onCallObligation)} onChange={(event) => update('onCallObligation', event.target.value === 'true')}><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select></Field> : <Field required label={labels.employmentScope}><select className={inputClass} value={draft.workScope} onChange={(event) => update('workScope', event.target.value as Draft['workScope'])}><option value="FULL_TIME">{labels.fullTime}</option><option value="PART_TIME">{labels.partTime}</option></select></Field>}<Field label={labels.fulltimeReference}><input readOnly className={`${inputClass} bg-muted/40`} value={`${selectedFulltimeHours}`} /></Field><Field required label={labels.weeklyHours}><input type="number" min="0" max="50" step="0.01" className={inputClass} value={draft.weeklyHours} onChange={(event) => distributeHours(event.target.value)} /></Field>{!draft.isOnCall && <Field label={labels.partTimeFactor}><input readOnly className={`${inputClass} bg-muted/40`} value={`${Math.round(Number(draft.partTimeFactor) * 10000) / 100}%`} /></Field>}</div><h4 className="mt-6 font-semibold">{labels.roster}</h4><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{dayKeys.map((day) => <Field required key={day} label={labels[day]}><input type="number" min="0" max="24" step="0.25" className={inputClass} value={draft.days[day]} onChange={(event) => updateDay(day, event.target.value)} /></Field>)}</div>{!rosterMatches && <p role="alert" className="mt-3 text-sm text-destructive">{labels.rosterMismatch}</p>}</WizardStep>}

    {currentStep === 'salary' && <WizardStep title={labels.stepSalary}>{!options.canWriteSalary ? <p className="text-sm text-muted-foreground">{labels.frequencyNone}</p> : <div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.salaryCalculation}><select className={inputClass} value={draft.salaryBasis} onChange={(event) => update('salaryBasis', event.target.value as SalaryBasis)}><option value="MANUAL">{labels.salaryManual}</option><option value="MINIMUM_WAGE">{labels.salaryMinimum}</option><option value="CUSTOM_SCALE">{labels.salaryTable}</option></select></Field><Field required label={labels.frequency}>{options.salaryFrequencies.length === 1 ? <><input readOnly className={`${inputClass} bg-muted/40`} value={options.salaryFrequencies[0]?.name ?? ''} /><span className="text-xs font-normal text-muted-foreground">{labels.frequencySingleHelp}</span></> : options.salaryFrequencies.length > 1 ? <DropdownSelect value={draft.salaryFrequencyId} onChange={(event) => update('salaryFrequencyId', event.target.value)}>{options.salaryFrequencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect> : <span className="text-sm text-destructive">{labels.frequencyNone}</span>}</Field>{draft.salaryBasis === 'CUSTOM_SCALE' && <><Field required label={labels.salaryScale}><DropdownSelect value={draft.salaryScaleId} onChange={(event) => update('salaryScaleId', event.target.value)} searchable searchPlaceholder={labels.salaryScale} emptyLabel={labels.frequencyNone}>{options.salaryScales.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.salaryScaleStep}><DropdownSelect value={draft.salaryScaleStepId} onChange={(event) => update('salaryScaleStepId', event.target.value)} searchable searchPlaceholder={labels.salaryScaleStep} emptyLabel={labels.frequencyNone}>{options.salaryScaleSteps.filter((item) => item.salaryScaleId === draft.salaryScaleId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</DropdownSelect></Field><Field label={labels.salaryScaleAmount}><input readOnly className={`${inputClass} bg-muted/40`} value={selectedScale ? `€ ${selectedScale.fulltimeAmount.toFixed(2)}` : '—'} /></Field></>}{draft.salaryBasis === 'MINIMUM_WAGE' && <Field label={labels.minimumHourlyRate}><input readOnly className={`${inputClass} bg-muted/40`} value={minimumRate ? `€ ${minimumRate.hourlyAmount.toFixed(2)}` : '—'} /></Field>}{draft.salaryBasis === 'MANUAL' && <><Field required label={labels.fulltimeSalary}><input type="number" min="0" step="0.01" className={inputClass} value={draft.fulltimeAmount} onChange={(event) => { update('fulltimeAmount', event.target.value); const factor = Number(draft.weeklyHours) / selectedFulltimeHours; update('parttimeAmount', String(Number(event.target.value) * factor)) }} /></Field>{Number(draft.weeklyHours) !== selectedFulltimeHours && <Field required label={labels.parttimeSalary}><input type="number" min="0" step="0.01" className={inputClass} value={draft.parttimeAmount} onChange={(event) => { update('parttimeAmount', event.target.value); const factor = Number(draft.weeklyHours) / selectedFulltimeHours; if (factor > 0) update('fulltimeAmount', String(Number(event.target.value) / factor)) }} /></Field>}</>}</div>}</WizardStep>}

    {currentStep === 'other' && <WizardStep title={labels.stepOther}><div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.jobGroup}><DropdownSelect value={draft.jobGroupId} onChange={(event) => update('jobGroupId', event.target.value)} searchable searchPlaceholder={labels.jobGroup} emptyLabel={labels.frequencyNone}>{options.jobGroups.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.job}><DropdownSelect value={draft.jobId} onChange={(event) => update('jobId', event.target.value)} searchable searchPlaceholder={labels.job} emptyLabel={labels.frequencyNone}>{filteredJobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.department}><DropdownSelect value={draft.departmentId} onChange={(event) => update('departmentId', event.target.value)} searchable searchPlaceholder={labels.department} emptyLabel={labels.frequencyNone}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.manager}><DropdownSelect value={draft.managerEmployeeId} onChange={(event) => update('managerEmployeeId', event.target.value)} searchable searchPlaceholder={labels.manager} emptyLabel={labels.noManager}><option value="">{labels.noManager}</option>{options.managers.map((item) => <option key={item.id} value={item.id}>{item.employeeNumber} · {item.name}</option>)}</DropdownSelect></Field></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">{labels.costCenter}</h4><button type="button" className="button-secondary" onClick={() => setDraft((current) => ({ ...current, allocations: [...current.allocations, { costCenterId: options.costCenters[0]?.id ?? '', costCarrierId: options.costCarriers[0]?.id ?? '', percentage: '0' }] }))}>{labels.addAllocation}</button></div><div className="mt-3 space-y-3">{draft.allocations.map((allocation, index) => <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_8rem_auto]" key={`${index}-${allocation.costCenterId}`}><Field required label={labels.costCenter}><DropdownSelect value={allocation.costCenterId} onChange={(event) => updateAllocation(index, 'costCenterId', event.target.value)} searchable searchPlaceholder={labels.costCenter} emptyLabel={labels.frequencyNone}>{options.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.costCarrier}><DropdownSelect value={allocation.costCarrierId} onChange={(event) => updateAllocation(index, 'costCarrierId', event.target.value)} searchable searchPlaceholder={labels.costCarrier} emptyLabel={labels.frequencyNone}>{options.costCarriers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.allocationPercentage}><input type="number" min="0.01" max="100" step="0.01" className={inputClass} value={allocation.percentage} onChange={(event) => updateAllocation(index, 'percentage', event.target.value)} /></Field><button type="button" className="button-secondary self-end" disabled={draft.allocations.length === 1} onClick={() => setDraft((current) => ({ ...current, allocations: current.allocations.filter((_item, allocationIndex) => allocationIndex !== index) }))}>{labels.removeAllocation}</button></div>)}</div><p className={`mt-3 text-sm ${allocationsMatch ? 'text-muted-foreground' : 'text-destructive'}`}>{labels.allocationTotal}: {allocationTotal.toFixed(2)}%{!allocationsMatch ? ` · ${labels.allocationMismatch}` : ''}</p><p className="mt-2 text-xs text-muted-foreground">{labels.splitCostCenter}</p></WizardStep>}

    {currentStep === 'review' && <WizardStep title={labels.completeSummary}><p className="text-sm text-muted-foreground">{labels.createHint}</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Summary label={labels.administration} value={options.administrations.find((item) => item.id === draft.administrationId)?.name ?? ''} /><Summary label={labels.employmentNumber} value={draft.employmentNumber} /><Summary label={labels.workerType} value={draft.employmentType} /><Summary label={labels.startDate} value={draft.startsOn} />{payrollDetails && <><Summary label={labels.laborConditions} value={selectedLaborSet?.name ?? ''} /><Summary label={labels.weeklyHours} value={draft.weeklyHours} /><Summary label={labels.job} value={selectedJob?.name ?? ''} /></>}</dl></WizardStep>}

    {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{errorCode || labels.requiredFields}</p>}{state === 'saved' && <p className="mt-4 text-sm text-success">{labels.saved}</p>}<div className="mt-5 flex items-center justify-between gap-3 border-t pt-4"><button type="button" className="button-secondary" disabled={step === 0 || state === 'saving' || optionsLoading} onClick={() => setStep((current) => Math.max(0, current - 1))}>{labels.previous}</button>{step < stepKeys.length - 1 ? <button type="button" className="button-primary" disabled={state === 'saving' || optionsLoading} onClick={next}>{labels.next}</button> : <button type="submit" className="button-primary" disabled={state === 'saving' || optionsLoading}>{labels.submit}</button>}</div>
  </form></employmentFieldLabelsContext.Provider>
}

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  const labels = useContext(employmentFieldLabelsContext)
  return <label className="grid content-start gap-1.5 text-sm font-medium"><span className="flex flex-wrap items-center gap-2"><span>{label}</span>{labels && <span className={`text-xs font-normal ${required ? 'text-primary' : 'text-muted-foreground'}`}>{required ? `* ${labels.required}` : labels.optional}</span>}</span>{children}</label>
}

function WizardStep({ title, children }: { title: string; children: ReactNode }) { return <section className="mt-6"><h3 className="mb-5 text-xl font-semibold">{title}</h3>{children}</section> }
function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-muted" onClick={onClick}>{children}</button> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value || '—'}</dd></div> }
function ageOn(birthDate: string, date: string): number { if (!birthDate || !date) return 21; const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number); const [year, month, day] = date.split('-').map(Number); return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0) }
