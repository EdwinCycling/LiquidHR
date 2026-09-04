'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronUp, CircleCheck, Clock3 } from 'lucide-react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormActions } from '@/components/patterns/form-actions'
import { SalaryBandPositionCard } from '@/components/salary/salary-band-position-card'
import { SalaryBandPercentageControl } from '@/components/salary/salary-band-percentage-control'
import { Switch } from '@/components/ui/switch'
import { calculateCappedPartTimeFactor } from '@/lib/employment/fulltime-reference'
import { parseDecimalInput } from '@/lib/employment/decimal-input'
import { convertRosterHoursInput, parseRosterHoursValue, type RosterHoursInputMode } from '@/lib/employment/roster-hours'

export type EmploymentOverviewActionKey =
  | 'hoursSchedule'
  | 'hoursScheduleSalary'
  | 'functionDepartmentCostCenter'
  | 'salary'
  | 'laborConditions'
  | 'contractTypeStartDate'
  | 'deleteContract'

export interface EmploymentOverviewChangeData {
  contracts: Array<{
    id: string
    sequenceNumber: number
    workerType: string
    flexPhaseId: string | null
    flexPhaseName: string | null
    laborConditionSetId: string
    laborConditionName: string
    fulltimeHoursPerWeek: number
    durationType: string
    startsOn: string
    endsOn: string | null
    probationApplies: boolean
    probationEndsOn: string | null
  }>
  schedules: Array<{
    id: string
    validFrom: string
    validUntil: string | null
    averageHours: number
    averageDays: number
    partTimeFactor: number
    scheduleType: string
    mondayHours: number | null
    tuesdayHours: number | null
    wednesdayHours: number | null
    thursdayHours: number | null
    fridayHours: number | null
    saturdayHours: number | null
    sundayHours: number | null
  }>
  salaries: Array<{
    id: string
    validFrom: string
    validUntil: string | null
    paymentType: string
    paymentFrequency: string
    salaryBasis: string
    salaryRoute: string
    minimumWageScheme: string | null
    fulltimeAmount: number | null
    parttimeAmount: number | null
    hourlyRate: number | null
    currencyCode: string
    salaryScaleStepId: string | null
    salaryStructureId: string | null
    salaryScaleId: string | null
    salaryStepCode: string | null
    salaryBandId: string | null
  }>
  organizations: Array<{
    id: string
    effectiveFrom: string
    effectiveTo: string | null
    departmentId: string
    departmentName: string
    jobId: string | null
    jobName: string
  }>
  costAllocations: Array<{
    id: string
    validFrom: string
    validUntil: string | null
    costCenterId: string
    costCenterName: string
    costCarrierId: string
    costCarrierName: string
    percentage: number
  }>
  options: {
    laborConditionSets: Array<{ id: string; name: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }>
    flexPhases: Array<{ id: string; name: string }>
    departments: Array<{ id: string; code: string; name: string }>
    jobs: Array<{ id: string; code: string; name: string }>
    costCenters: Array<{ id: string; code: string; name: string }>
    costCarriers: Array<{ id: string; code: string; name: string }>
    salaryScaleSteps: Array<{ id: string; salaryScaleId: string; label: string; stepCode: string; fulltimeAmount: number }>
    salaryScales: Array<{ id: string; structureId: string; code: string; name: string }>
    salaryBands: Array<{ id: string; structureId: string; code: string; name: string; minimumAmount: number; midpointAmount: number; maximumAmount: number | null; effectiveFrom: string }>
    salaryRoutes: Array<'MANUAL' | 'MINIMUM_WAGE' | 'SCALE_WITH_STEPS' | 'SALARY_BAND'>
  }
}

export type EmploymentContractChangeLabels = Record<string, string>
type Labels = EmploymentContractChangeLabels
type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const dayKeys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
type DayValues = Record<DayKey, string>
type ScheduleDraft = {
  weeklyHours: string
  days: DayValues
  secondWeekDays: DayValues
  twoWeekRoster: boolean
  timeForTime: string
  rosterInputMode: RosterHoursInputMode
}
type ActionMode = 'SCHEDULE' | 'SCHEDULE_SALARY' | 'ORGANIZATION_COST' | 'SALARY' | 'LABOR_CONDITIONS' | 'CONTRACT' | null
type Step = 'selection' | 'date' | 'details' | 'review'
type DateChoice = 'contract' | 'currentMonth' | 'nextMonth' | 'custom'
type State = 'idle' | 'saving' | 'saved' | 'failed'

interface Props {
  actionKey: EmploymentOverviewActionKey
  actionTitle: string
  employmentId: string
  today: string
  locale: string
  data: EmploymentOverviewChangeData
  labels: Labels
  dayLabels: string[]
  onClose: () => void
}

interface AllocationDraft {
  costCenterId: string
  costCarrierId: string
  percentage: string
}

interface SalaryDraft {
  salaryBasis: 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE' | 'SALARY_BAND'
  salaryRoute: 'MANUAL' | 'MINIMUM_WAGE' | 'SCALE_WITH_STEPS' | 'SALARY_BAND'
  minimumWageScheme: 'REGULAR' | 'BBL'
  paymentType: 'PERIODIC_FIXED' | 'HOURLY_VARIABLE'
  paymentFrequency: 'MONTHLY' | 'FOUR_WEEKLY'
  fulltimeAmount: string
  parttimeAmount: string
  hourlyRate: string
  salaryScaleStepId: string
  salaryStructureId: string
  salaryScaleId: string
  salaryStepCode: string
  salaryBandId: string
}

type WorkerType = 'EMPLOYEE' | 'STUDENT_INTERN' | 'TEMPORARY_AGENCY' | 'EXTERNAL_NO_PAYROLL'
type DurationType = 'INDEFINITE' | 'DEFINITE' | 'TEMPORARY_NO_END'

interface ContractDraft {
  workerType: WorkerType
  flexPhaseId: string
  laborConditionSetId: string
  durationType: DurationType
  startsOn: string
  endsOn: string
  probationApplies: boolean
  probationEndsOn: string
}

function modeForAction(actionKey: EmploymentOverviewActionKey): ActionMode {
  if (actionKey === 'hoursSchedule') return 'SCHEDULE'
  if (actionKey === 'hoursScheduleSalary') return 'SCHEDULE_SALARY'
  if (actionKey === 'functionDepartmentCostCenter') return 'ORGANIZATION_COST'
  if (actionKey === 'salary') return 'SALARY'
  if (actionKey === 'laborConditions') return 'LABOR_CONDITIONS'
  if (actionKey === 'contractTypeStartDate') return 'CONTRACT'
  return null
}

function asNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseDecimalInput(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function asInput(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function dateAt<T extends { validFrom: string; validUntil?: string | null }>(rows: T[], date: string): T | undefined {
  return [...rows].filter((row) => row.validFrom <= date && (!row.validUntil || row.validUntil > date)).sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0]
}

function effectiveAt<T extends { effectiveFrom: string; effectiveTo?: string | null }>(rows: T[], date: string): T | undefined {
  return [...rows].filter((row) => row.effectiveFrom <= date && (!row.effectiveTo || row.effectiveTo > date)).sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

function nextMonthStart(date: string): string {
  const [year, month] = date.slice(0, 7).split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return next.toISOString().slice(0, 10)
}

function toMonday(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  const isoDay = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - isoDay + 1)
  return date.toISOString().slice(0, 10)
}

function patternEndTime(minutes: number): string {
  const rounded = 9 * 60 + Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function workPatternDays(weeks: DayValues[], inputMode: RosterHoursInputMode): Array<{ weekIndex: number; isoWeekday: number; isWorkingDay: boolean; startsAt: string | null; endsAt: string | null; breakMinutes: number; scheduledMinutes: number; note: null }> {
  return weeks.flatMap((week, weekIndex) => dayKeys.map((day, dayIndex) => {
    const parsedHours = parseRosterHoursValue(week[day], inputMode)
    const scheduledMinutes = Math.round((Number.isFinite(parsedHours) ? parsedHours : 0) * 60)
    return {
      weekIndex: weekIndex + 1,
      isoWeekday: dayIndex + 1,
      isWorkingDay: scheduledMinutes > 0,
      startsAt: scheduledMinutes > 0 ? '09:00' : null,
      endsAt: scheduledMinutes > 0 ? patternEndTime(scheduledMinutes) : null,
      breakMinutes: 0,
      scheduledMinutes,
      note: null,
    }
  }))
}

function dateLabel(value: string, formatter: Intl.DateTimeFormat): string {
  return formatter.format(new Date(`${value}T00:00:00Z`))
}

function moneyLabel(value: number | null, currency: string, locale: string): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

function contractTypeLabel(value: string, labels: Labels): string {
  if (value === 'INDEFINITE') return labels.indefinite
  if (value === 'DEFINITE') return labels.definite
  if (value === 'TEMPORARY_NO_END') return labels.temporaryWithoutEnd
  return labels.notRecorded
}

function workerTypeLabel(value: string, labels: Labels): string {
  if (value === 'EMPLOYEE') return labels.workerEmployee
  if (value === 'STUDENT_INTERN') return labels.workerStudentIntern
  if (value === 'TEMPORARY_AGENCY') return labels.workerTemporaryAgency
  if (value === 'EXTERNAL_NO_PAYROLL') return labels.workerExternal
  return labels.notRecorded
}

function salaryBasisLabel(value: string, labels: Labels): string {
  if (value === 'MINIMUM_WAGE') return labels.salaryMinimum
  if (value === 'CUSTOM_SCALE') return labels.salaryTable
  if (value === 'SALARY_BAND') return labels.salaryBand
  if (value === 'CAO_SCALE') return labels.caoScale
  return labels.salaryManual
}

function initialSchedule(
  rows: EmploymentOverviewChangeData['schedules'],
  date: string,
): ScheduleDraft {
  const row = dateAt(rows, date)
  return {
    weeklyHours: asInput(row?.averageHours ?? 0),
    days: {
      monday: asInput(row?.mondayHours ?? 0), tuesday: asInput(row?.tuesdayHours ?? 0),
      wednesday: asInput(row?.wednesdayHours ?? 0), thursday: asInput(row?.thursdayHours ?? 0),
      friday: asInput(row?.fridayHours ?? 0), saturday: asInput(row?.saturdayHours ?? 0), sunday: asInput(row?.sundayHours ?? 0),
    },
    secondWeekDays: {
      monday: asInput(row?.mondayHours ?? 0), tuesday: asInput(row?.tuesdayHours ?? 0),
      wednesday: asInput(row?.wednesdayHours ?? 0), thursday: asInput(row?.thursdayHours ?? 0),
      friday: asInput(row?.fridayHours ?? 0), saturday: asInput(row?.saturdayHours ?? 0), sunday: asInput(row?.sundayHours ?? 0),
    },
    twoWeekRoster: false,
    timeForTime: '0',
    rosterInputMode: 'DECIMAL',
  }
}

function convertDayValues(days: DayValues, from: RosterHoursInputMode, to: RosterHoursInputMode): DayValues {
  return dayKeys.reduce<DayValues>((next, day) => {
    next[day] = convertRosterHoursInput(days[day], from, to)
    return next
  }, { ...days })
}

function toggleRosterInputMode(schedule: ScheduleDraft): ScheduleDraft {
  const nextMode: RosterHoursInputMode = schedule.rosterInputMode === 'HOURS_MINUTES' ? 'DECIMAL' : 'HOURS_MINUTES'
  return {
    ...schedule,
    rosterInputMode: nextMode,
    days: convertDayValues(schedule.days, schedule.rosterInputMode, nextMode),
    secondWeekDays: convertDayValues(schedule.secondWeekDays, schedule.rosterInputMode, nextMode),
  }
}

function initialSalary(rows: EmploymentOverviewChangeData['salaries'], date: string, availableRoutes: EmploymentOverviewChangeData['options']['salaryRoutes']): SalaryDraft {
  const row = dateAt(rows, date)
  const configuredRoute = row?.salaryRoute === 'MINIMUM_WAGE' || row?.salaryRoute === 'SCALE_WITH_STEPS' || row?.salaryRoute === 'SALARY_BAND'
    ? row.salaryRoute
    : row?.salaryBasis === 'MINIMUM_WAGE' ? 'MINIMUM_WAGE' : row?.salaryBasis === 'CUSTOM_SCALE' ? 'SCALE_WITH_STEPS' : row?.salaryBasis === 'SALARY_BAND' ? 'SALARY_BAND' : 'MANUAL'
  const route = availableRoutes.includes(configuredRoute) ? configuredRoute : availableRoutes[0] ?? 'MANUAL'
  const basis = route === 'MINIMUM_WAGE' ? 'MINIMUM_WAGE' : route === 'SCALE_WITH_STEPS' ? 'CUSTOM_SCALE' : route === 'SALARY_BAND' ? 'SALARY_BAND' : 'MANUAL'
  const paymentType = row?.paymentType === 'HOURLY_VARIABLE' ? 'HOURLY_VARIABLE' : 'PERIODIC_FIXED'
  return {
    salaryBasis: basis,
    salaryRoute: route,
    minimumWageScheme: row?.minimumWageScheme === 'BBL' ? 'BBL' : 'REGULAR',
    paymentType,
    paymentFrequency: row?.paymentFrequency === 'FOUR_WEEKLY' ? 'FOUR_WEEKLY' : 'MONTHLY',
    fulltimeAmount: asInput(row?.fulltimeAmount),
    parttimeAmount: asInput(row?.parttimeAmount),
    hourlyRate: asInput(row?.hourlyRate),
    salaryScaleStepId: row?.salaryScaleStepId ?? '',
    salaryStructureId: row?.salaryStructureId ?? '',
    salaryScaleId: row?.salaryScaleId ?? '',
    salaryStepCode: row?.salaryStepCode ?? '',
    salaryBandId: row?.salaryBandId ?? '',
  }
}

function initialAllocations(rows: EmploymentOverviewChangeData['costAllocations'], date: string, options: EmploymentOverviewChangeData['options']): AllocationDraft[] {
  const active = rows.filter((row) => row.validFrom <= date && (!row.validUntil || row.validUntil > date)).sort((left, right) => left.validFrom.localeCompare(right.validFrom))
  if (active.length > 0) return active.map((row) => ({ costCenterId: row.costCenterId, costCarrierId: row.costCarrierId, percentage: asInput(row.percentage) }))
  return [{ costCenterId: options.costCenters[0]?.id ?? '', costCarrierId: options.costCarriers[0]?.id ?? '', percentage: '100' }]
}

function initialOrganization(rows: EmploymentOverviewChangeData['organizations'], date: string, options: EmploymentOverviewChangeData['options']) {
  const row = effectiveAt(rows, date)
  return { departmentId: row?.departmentId ?? options.departments[0]?.id ?? '', jobId: row?.jobId ?? options.jobs[0]?.id ?? '' }
}

function initialContract(contract: EmploymentOverviewChangeData['contracts'][number]): ContractDraft {
  return {
    workerType: isWorkerType(contract.workerType) ? contract.workerType : 'EMPLOYEE',
    flexPhaseId: contract.flexPhaseId ?? '',
    laborConditionSetId: contract.laborConditionSetId,
    durationType: isDurationType(contract.durationType) ? contract.durationType : 'INDEFINITE',
    startsOn: contract.startsOn,
    endsOn: contract.endsOn ?? '',
    probationApplies: contract.probationApplies,
    probationEndsOn: contract.probationEndsOn ?? '',
  }
}

function isWorkerType(value: string): value is WorkerType {
  return ['EMPLOYEE', 'STUDENT_INTERN', 'TEMPORARY_AGENCY', 'EXTERNAL_NO_PAYROLL'].includes(value)
}

function isDurationType(value: string): value is DurationType {
  return ['INDEFINITE', 'DEFINITE', 'TEMPORARY_NO_END'].includes(value)
}

function formControlValue(form: HTMLFormElement | undefined, name: string, fallback: string): string {
  const control = form?.elements.namedItem(name)
  return control instanceof HTMLInputElement || control instanceof HTMLSelectElement ? control.value : fallback
}

function fieldClassName(invalid = false): string {
  return `form-field${invalid ? ' border-destructive' : ''}`
}

export function EmploymentContractChangeDialog({ actionKey, actionTitle, employmentId, today, locale, data, labels, dayLabels, onClose }: Props) {
  const router = useRouter()
  const mode = modeForAction(actionKey)
  const orderedContracts = useMemo(() => [...data.contracts].sort((left, right) => left.sequenceNumber - right.sequenceNumber), [data.contracts])
  const activeContracts = useMemo(() => orderedContracts.filter((contract) => isDateInContract(today, contract)), [orderedContracts, today])
  const hasSingleActiveContract = activeContracts.length === 1
  const [step, setStep] = useState<Step>(hasSingleActiveContract ? 'date' : 'selection')
  const [selectedContractId, setSelectedContractId] = useState(hasSingleActiveContract ? activeContracts[0]?.id ?? '' : '')
  const selectedContract = orderedContracts.find((contract) => contract.id === selectedContractId) ?? null
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale])
  const defaultDateChoice: DateChoice = mode === 'CONTRACT' || !selectedContract || !isDateInContract(nextMonthStart(today), selectedContract) ? 'contract' : 'nextMonth'
  const defaultEffectiveOn = defaultDateChoice === 'nextMonth' ? nextMonthStart(today) : selectedContract?.startsOn ?? today
  const [dateChoice, setDateChoice] = useState<DateChoice>(defaultDateChoice)
  const [effectiveOn, setEffectiveOn] = useState(defaultEffectiveOn)
  const [schedule, setSchedule] = useState(() => initialSchedule(data.schedules, selectedContract?.startsOn ?? today))
  const [salary, setSalary] = useState(() => initialSalary(data.salaries, selectedContract?.startsOn ?? today, data.options.salaryRoutes))
  const [organization, setOrganization] = useState(() => initialOrganization(data.organizations, selectedContract?.startsOn ?? today, data.options))
  const [allocations, setAllocations] = useState<AllocationDraft[]>(() => initialAllocations(data.costAllocations, selectedContract?.startsOn ?? today, data.options))
  const [laborConditionSetId, setLaborConditionSetId] = useState(selectedContract?.laborConditionSetId ?? data.options.laborConditionSets[0]?.id ?? '')
  const [contract, setContract] = useState<ContractDraft>(() => selectedContract ? initialContract(selectedContract) : {
    workerType: 'EMPLOYEE', flexPhaseId: '', laborConditionSetId: data.options.laborConditionSets[0]?.id ?? '',
    durationType: 'INDEFINITE', startsOn: today, endsOn: '', probationApplies: false, probationEndsOn: '',
  })
  const [reason, setReason] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [initialDraft] = useState(() => JSON.stringify({ selectedContractId, dateChoice, effectiveOn, schedule, salary, organization, allocations, laborConditionSetId, contract, reason }))
  const hasUnsavedChanges = state !== 'saved' && JSON.stringify({ selectedContractId, dateChoice, effectiveOn, schedule, salary, organization, allocations, laborConditionSetId, contract, reason }) !== initialDraft

  const requestClose = useCallback((): void => {
    if (state === 'saving') return
    if (hasUnsavedChanges) { setDiscardConfirmOpen(true); return }
    onClose()
  }, [hasUnsavedChanges, onClose, state])

  function discardChanges(): void {
    setDiscardConfirmOpen(false)
    onClose()
  }

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && state !== 'saving') { event.preventDefault(); requestClose() } }
    const protectBeforeUnload = (event: BeforeUnloadEvent) => { if (hasUnsavedChanges) { event.preventDefault(); event.returnValue = '' } }
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('beforeunload', protectBeforeUnload)
    return () => { document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('beforeunload', protectBeforeUnload) }
  }, [hasUnsavedChanges, onClose, requestClose, state])

  const dateChoices = useMemo(() => {
    if (!selectedContract) return []
    const currentMonth = monthStart(today)
    const nextMonth = nextMonthStart(today)
    return [
      { key: 'contract' as const, date: selectedContract.startsOn, label: labels.contractStartOption, disabled: false },
      { key: 'currentMonth' as const, date: currentMonth, label: labels.currentMonthOption, disabled: !isDateInContract(currentMonth, selectedContract) },
      { key: 'nextMonth' as const, date: nextMonth, label: labels.nextMonthOption, disabled: !isDateInContract(nextMonth, selectedContract) },
    ]
  }, [labels, selectedContract, today])

  const scheduleWeeks = schedule.twoWeekRoster ? [schedule.days, schedule.secondWeekDays] : [schedule.days]
  const scheduleAverageHours = scheduleWeeks.reduce((sum, week) => sum + sumDays(week, schedule.rosterInputMode), 0) / scheduleWeeks.length
  const scheduleAverageDays = scheduleWeeks.reduce((sum, week) => sum + dayKeys.filter((day) => {
    const parsed = parseRosterHoursValue(week[day], schedule.rosterInputMode)
    return Number.isFinite(parsed) && parsed > 0
  }).length, 0) / scheduleWeeks.length
  const rosterInputsValid = scheduleWeeks.every((week) => dayKeys.every((day) => {
    const value = week[day].trim()
    const parsed = parseRosterHoursValue(value, schedule.rosterInputMode)
    return value !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 24
  }))
  const weeklyHours = asNumber(schedule.weeklyHours)
  const fulltimeHours = selectedContract?.fulltimeHoursPerWeek ?? 40
  const partTimeFactor = calculateCappedPartTimeFactor(weeklyHours, fulltimeHours)
  const rosterMatches = Math.abs(scheduleAverageHours - weeklyHours) < 0.001
  const salaryFactor = mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY' ? partTimeFactor : calculateCappedPartTimeFactor(asNumber(dateAt(data.schedules, effectiveOn)?.averageHours ?? fulltimeHours), fulltimeHours)
  const allocationTotal = allocations.reduce((sum, allocation) => sum + asNumber(allocation.percentage), 0)
  const detailsValid = mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY'
    ? weeklyHours >= 0 && weeklyHours <= 50 && rosterInputsValid && rosterMatches && (mode === 'SCHEDULE' || salaryIsValid(salary))
    : mode === 'SALARY'
      ? salaryIsValid(salary)
      : mode === 'ORGANIZATION_COST'
        ? Boolean(organization.departmentId && organization.jobId) && Math.abs(allocationTotal - 100) < 0.001 && allocations.every((allocation) => allocation.costCenterId && allocation.costCarrierId && asNumber(allocation.percentage) > 0)
        : mode === 'LABOR_CONDITIONS'
          ? Boolean(laborConditionSetId)
          : mode === 'CONTRACT'
            ? contractIsValid(contract, selectedContract)
            : false

  function chooseContract(contractId: string): void {
    const contract = orderedContracts.find((item) => item.id === contractId)
    setSelectedContractId(contractId)
    if (contract) {
      setEffectiveOn(contract.startsOn)
      setDateChoice('contract')
      setLaborConditionSetId(contract.laborConditionSetId)
      setContract(initialContract(contract))
      setError('')
    }
  }

  function hydrateDrafts(date = effectiveOn): void {
    setSchedule(initialSchedule(data.schedules, date))
    setSalary(initialSalary(data.salaries, date, data.options.salaryRoutes))
    setOrganization(initialOrganization(data.organizations, date, data.options))
    setAllocations(initialAllocations(data.costAllocations, date, data.options))
    if (selectedContract) {
      setLaborConditionSetId(selectedContract.laborConditionSetId)
      setContract(initialContract(selectedContract))
    }
  }

  function next(form?: HTMLFormElement): void {
    if (step === 'selection') {
      if (!selectedContract) { setError(labels.chooseContract); return }
      setStep(mode ? 'date' : 'details')
      return
    }
    if (step === 'date') {
      const formDate = form?.elements.namedItem('effectiveOn')
      const formEffectiveOn = formDate instanceof HTMLInputElement && formDate.value ? formDate.value : effectiveOn
      if (formEffectiveOn !== effectiveOn) {
        setDateChoice('custom')
        setEffectiveOn(formEffectiveOn)
      }
      if (!selectedContract || !isDateInContract(formEffectiveOn, selectedContract)) { setError(labels.dateOutsideContract); return }
      hydrateDrafts(formEffectiveOn)
      setStep('details')
      return
    }
    if (step === 'details') {
      let valid = detailsValid
      let nextContract = contract
      if (mode === 'CONTRACT' && form) {
        const workerType = formControlValue(form, 'contractWorkerType', contract.workerType)
        const durationType = formControlValue(form, 'contractDurationType', contract.durationType)
        nextContract = {
          ...contract,
          workerType: isWorkerType(workerType) ? workerType : contract.workerType,
          flexPhaseId: formControlValue(form, 'contractFlexPhaseId', contract.flexPhaseId),
          laborConditionSetId: formControlValue(form, 'contractLaborConditionSetId', contract.laborConditionSetId),
          durationType: isDurationType(durationType) ? durationType : contract.durationType,
          startsOn: formControlValue(form, 'contractStartsOn', contract.startsOn),
          endsOn: formControlValue(form, 'contractEndsOn', contract.endsOn),
          probationApplies: formControlValue(form, 'contractProbationApplies', String(contract.probationApplies)) === 'true',
          probationEndsOn: formControlValue(form, 'contractProbationEndsOn', contract.probationEndsOn),
        }
        valid = contractIsValid(nextContract, selectedContract)
      }
      if (!valid) { setError(labels.requiredFields); return }
      if (mode === 'CONTRACT') setContract(nextContract)
      setError('')
      setStep('review')
    }
  }

  function previous(): void {
    if (step === 'review') setStep('details')
    else if (step === 'details') setStep(mode ? 'date' : 'selection')
    else if (step === 'date') setStep('selection')
    setError('')
  }

  function updateScheduleDay(week: 1 | 2, day: DayKey, value: string): void {
    setSchedule((current) => week === 1
      ? { ...current, days: { ...current.days, [day]: value } }
      : { ...current, secondWeekDays: { ...current.secondWeekDays, [day]: value } })
    setState('idle')
  }

  function distributeHours(value: string): void {
    const weekly = asNumber(value)
    const daily = String(Math.round((weekly / 5) * 100) / 100)
    const days = { monday: daily, tuesday: daily, wednesday: daily, thursday: daily, friday: daily, saturday: '0', sunday: '0' }
    setSchedule((current) => ({ ...current, weeklyHours: value, days, secondWeekDays: current.twoWeekRoster ? { ...days } : current.secondWeekDays }))
    setState('idle')
  }

  function toggleRosterInputFormat(): void {
    setSchedule((current) => toggleRosterInputMode(current))
    setState('idle')
  }

  function updateSalary<K extends keyof SalaryDraft>(key: K, value: SalaryDraft[K]): void {
    setSalary((current) => {
      const nextSalary = { ...current, [key]: value }
      if (key === 'salaryRoute') {
        nextSalary.salaryBasis = value === 'MINIMUM_WAGE' ? 'MINIMUM_WAGE' : value === 'SCALE_WITH_STEPS' ? 'CUSTOM_SCALE' : value === 'SALARY_BAND' ? 'SALARY_BAND' : 'MANUAL'
        if (value === 'MINIMUM_WAGE') nextSalary.paymentType = 'HOURLY_VARIABLE'
        if (value !== 'MINIMUM_WAGE' && nextSalary.paymentType === 'HOURLY_VARIABLE') nextSalary.paymentType = 'PERIODIC_FIXED'
      }
      if (key === 'fulltimeAmount') nextSalary.parttimeAmount = moneyInput(asNumber(String(value)) * salaryFactor)
      if (key === 'parttimeAmount' && salaryFactor > 0) nextSalary.fulltimeAmount = moneyInput(asNumber(String(value)) / salaryFactor)
      if (key === 'salaryScaleStepId') {
        const selectedStep = data.options.salaryScaleSteps.find((step) => step.id === value)
        if (selectedStep) {
          nextSalary.fulltimeAmount = moneyInput(selectedStep.fulltimeAmount)
          nextSalary.parttimeAmount = moneyInput(selectedStep.fulltimeAmount * salaryFactor)
        }
      }
      if (key === 'salaryScaleId') {
        const selectedScale = data.options.salaryScales.find((scale) => scale.id === value)
        const firstStep = data.options.salaryScaleSteps.find((step) => step.salaryScaleId === value)
        nextSalary.salaryStructureId = selectedScale?.structureId ?? ''
        nextSalary.salaryScaleStepId = firstStep?.id ?? ''
        nextSalary.salaryStepCode = firstStep?.stepCode ?? ''
        if (firstStep) {
          nextSalary.fulltimeAmount = moneyInput(firstStep.fulltimeAmount)
          nextSalary.parttimeAmount = moneyInput(firstStep.fulltimeAmount * salaryFactor)
        }
      }
      if (key === 'salaryScaleStepId') {
        const selectedStep = data.options.salaryScaleSteps.find((step) => step.id === value)
        if (selectedStep) nextSalary.salaryStepCode = selectedStep.stepCode
      }
      if (key === 'salaryBandId') {
        const selectedBand = data.options.salaryBands.find((band) => band.id === value)
        nextSalary.salaryStructureId = selectedBand?.structureId ?? ''
      }
      return nextSalary
    })
    setState('idle')
  }

  function schedulePayload() {
    return {
      scheduleType: 'HOURS_PER_DAY', startWeek: 1, averageDaysPerWeek: scheduleAverageDays,
      averageHoursPerWeek: weeklyHours, partTimeFactor, timeForTimeAccrual: asNumber(schedule.timeForTime),
      mondayHours: averageDay(scheduleWeeks, 'monday', schedule.rosterInputMode), tuesdayHours: averageDay(scheduleWeeks, 'tuesday', schedule.rosterInputMode),
      wednesdayHours: averageDay(scheduleWeeks, 'wednesday', schedule.rosterInputMode), thursdayHours: averageDay(scheduleWeeks, 'thursday', schedule.rosterInputMode),
      fridayHours: averageDay(scheduleWeeks, 'friday', schedule.rosterInputMode), saturdayHours: averageDay(scheduleWeeks, 'saturday', schedule.rosterInputMode), sundayHours: averageDay(scheduleWeeks, 'sunday', schedule.rosterInputMode),
    }
  }

  function salaryPayload() {
    const isMinimumWage = salary.salaryRoute === 'MINIMUM_WAGE'
    const paymentType = isMinimumWage ? 'HOURLY_VARIABLE' : salary.paymentType
    return {
      paymentType, paymentFrequency: salary.paymentFrequency,
      salaryBasis: salary.salaryBasis,
      salaryRoute: salary.salaryRoute,
      minimumWageScheme: isMinimumWage ? salary.minimumWageScheme : null,
      fulltimeAmount: isMinimumWage ? null : asNumber(salary.fulltimeAmount),
      parttimeAmount: isMinimumWage ? null : asNumber(salary.parttimeAmount),
      hourlyRate: paymentType === 'HOURLY_VARIABLE' && !isMinimumWage ? asNumber(salary.hourlyRate) : null,
      currencyCode: 'EUR', salaryScaleStepId: salary.salaryRoute === 'SCALE_WITH_STEPS' ? salary.salaryScaleStepId || null : null,
      salaryStructureId: salary.salaryRoute === 'SCALE_WITH_STEPS' || salary.salaryRoute === 'SALARY_BAND' ? salary.salaryStructureId || null : null,
      salaryScaleId: salary.salaryRoute === 'SCALE_WITH_STEPS' ? salary.salaryScaleId || null : null,
      salaryStepCode: salary.salaryRoute === 'SCALE_WITH_STEPS' ? salary.salaryStepCode || null : null,
      salaryBandId: salary.salaryRoute === 'SALARY_BAND' ? salary.salaryBandId || null : null,
      caoScaleName: null, caoStepName: null,
    }
  }

  async function saveWorkPattern(): Promise<void> {
    if (!selectedContract) return
    const weeks = schedule.twoWeekRoster ? [schedule.days, schedule.secondWeekDays] : [schedule.days]
    const nextScheduleStart = data.schedules
      .filter((row) => row.validFrom > effectiveOn)
      .sort((left, right) => left.validFrom.localeCompare(right.validFrom))[0]?.validFrom
    const validUntil = [selectedContract.endsOn, nextScheduleStart]
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null
    await post(`/api/employments/${employmentId}/work-patterns`, {
      name: labels.roster,
      cycleWeeks: weeks.length,
      anchorDate: toMonday(effectiveOn),
      validFrom: effectiveOn,
      validUntil: validUntil && validUntil > effectiveOn ? validUntil : null,
      days: workPatternDays(weeks, schedule.rosterInputMode),
    })
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedContract || !reason.trim()) { setError(labels.requiredFields); return }
    setState('saving')
    setError('')
    const common = {
      contractId: selectedContract.id, effectiveOn, reason: reason.trim(),
      warningCodes: effectiveOn < today ? ['RETROACTIVE_CHANGE'] : [],
      acknowledgements: { confirmed: true, retroactive: effectiveOn < today },
    }
    try {
      if (mode === 'SCHEDULE') {
        await post(`/api/employments/${employmentId}/timeline/SCHEDULE`, { ...common, payload: schedulePayload() })
        await saveWorkPattern()
      } else if (mode === 'SALARY') {
        await post(`/api/employments/${employmentId}/timeline/SALARY`, { ...common, payload: salaryPayload() })
      } else if (mode === 'SCHEDULE_SALARY') {
        await post(`/api/employments/${employmentId}/changes`, { ...common, mutations: [{ timeline: 'SCHEDULE', payload: schedulePayload() }, { timeline: 'SALARY', payload: salaryPayload() }] })
        await saveWorkPattern()
      } else if (mode === 'ORGANIZATION_COST') {
        const existingPlacement = data.organizations.find((row) => row.effectiveFrom === effectiveOn)
        await post(`/api/employments/${employmentId}/organization`, { contractId: selectedContract.id, effectiveOn, departmentId: organization.departmentId, jobId: organization.jobId, placementId: existingPlacement?.id ?? null })
        await post(`/api/employments/${employmentId}/timeline/COST_ALLOCATION`, { ...common, payload: { allocations: allocations.map((allocation) => ({ costCenterId: allocation.costCenterId, costCarrierId: allocation.costCarrierId, percentage: asNumber(allocation.percentage) })) } })
      } else if (mode === 'LABOR_CONDITIONS') {
        const conditionGroup = data.options.laborConditionSets.find((item) => item.id === laborConditionSetId)?.name ?? selectedContract.laborConditionName
        await post(`/api/employments/${employmentId}/timeline/LABOR_CONDITIONS`, { ...common, payload: { conditionGroup } })
      } else if (mode === 'CONTRACT') {
        await request(`/api/employments/${employmentId}/contracts`, 'PATCH', {
          contractId: selectedContract.id,
          input: {
            ...contract,
            flexPhaseId: contract.workerType === 'TEMPORARY_AGENCY' ? contract.flexPhaseId || null : null,
            endsOn: contract.durationType === 'DEFINITE' ? contract.endsOn || null : null,
            probationEndsOn: contract.probationApplies ? contract.probationEndsOn || null : null,
            caoAllowsTwoMonths: data.options.laborConditionSets.find((item) => item.id === contract.laborConditionSetId)?.probationMaximumMonths === 2,
          },
        })
      }
      setState('saved')
      router.refresh()
    } catch {
      setState('failed')
      setError(labels.changeFailed)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    if (state === 'saved') {
      event.preventDefault()
      return
    }
    if (step !== 'review') {
      event.preventDefault()
      next(event.currentTarget)
      return
    }
    void save(event)
  }

  const modeTitle = mode === 'SCHEDULE' ? labels.changeHoursSchedule
    : mode === 'SCHEDULE_SALARY' ? labels.changeHoursScheduleSalary
        : mode === 'ORGANIZATION_COST' ? labels.changeFunctionDepartmentCostCenter
        : mode === 'SALARY' ? labels.changeSalary
          : mode === 'LABOR_CONDITIONS' ? labels.changeLaborConditions
            : mode === 'CONTRACT' ? labels.changeContractTypeStartDate : actionTitle
  const stepLabels = [labels.stepSelection, labels.stepDate, labels.stepDetails, labels.stepReview]
  const stepIndex = step === 'selection' ? 0 : step === 'date' ? 1 : step === 'details' ? 2 : 3

  return <>
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-sidebar/70 p-0 sm:p-6" role="presentation">
    <main aria-labelledby="employment-contract-change-title" className="flex h-dvh w-full min-w-0 flex-col bg-surface sm:h-[calc(100dvh-3rem)] sm:max-w-5xl sm:rounded-[var(--radius-surface)] sm:border sm:border-subtle sm:shadow-lg">
      <header className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7">
        <div className="min-w-0"><p className="eyebrow text-primary">{labels.changeModalTitle}</p><h2 className="mt-1 truncate text-xl font-semibold" id="employment-contract-change-title">{modeTitle}</h2></div>
      </header>
      <div className="border-b bg-muted/20 px-5 py-3 sm:px-7"><ol className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">{stepLabels.map((label, index) => <li className={`flex min-w-0 items-center gap-2 text-xs font-semibold ${index <= stepIndex ? 'text-primary' : 'text-muted-foreground'}`} key={label}><span className={`grid size-7 shrink-0 place-items-center rounded-full border ${index <= stepIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{index + 1}</span><span className="truncate">{label}</span></li>)}</ol></div>
      <form id="employment-contract-change-form" className="min-h-0 w-full flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6" onSubmit={handleSubmit}>
        {step === 'selection' && <section className="space-y-5">{hasSingleActiveContract && selectedContract ? <SingleContractSelection contract={selectedContract} formatter={formatter} labels={labels} locale={locale} mode={mode} salaries={data.salaries} today={today} /> : <MultiContractSelection contracts={orderedContracts} formatter={formatter} labels={labels} onChoose={chooseContract} selectedContract={selectedContract} selectedContractId={selectedContractId} />}</section>}

        {step === 'date' && selectedContract && <section className="space-y-6"><div><h3 className="text-2xl font-semibold">{labels.changeStartDateTitle}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.changeStartDateHelp}</p></div><TimelinePreview actionKey={actionKey} contract={selectedContract} data={data} labels={labels} locale={locale} formatter={formatter} /><fieldset><legend className="text-sm font-semibold">{labels.changeStartDateTitle}</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{dateChoices.map((choice) => <button className={`border border-subtle p-3 text-left text-sm transition-colors ${choice.disabled ? 'cursor-not-allowed opacity-50' : dateChoice === choice.key ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/40'}`} disabled={choice.disabled} key={choice.key} onClick={() => { setDateChoice(choice.key); setEffectiveOn(choice.date); setError('') }} type="button"><span className="font-semibold">{choice.label}</span><span className="mt-1 block text-muted-foreground">{dateLabel(choice.date, formatter)}</span></button>)}</div><label className="mt-3 grid gap-1.5 text-sm font-medium sm:max-w-sm"><span>{labels.customDateOption}</span><input aria-label={labels.customDateOption} className={fieldClassName(Boolean(selectedContract && !isDateInContract(effectiveOn, selectedContract)))} max={selectedContract.endsOn ?? undefined} min={selectedContract.startsOn} name="effectiveOn" onChange={(event) => { setDateChoice('custom'); setEffectiveOn(event.target.value); setError('') }} onInput={(event) => { setDateChoice('custom'); setEffectiveOn(event.currentTarget.value); setError('') }} type="date" value={dateChoice === 'custom' ? effectiveOn : ''} /></label></fieldset></section>}

        {step === 'details' && selectedContract && <section className="space-y-6"><div className="border-y border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(selectedContract, formatter, labels)} · {labels.effectiveOn}: {dateLabel(effectiveOn, formatter)}</p></div>{mode === null ? <EmptyState title={labels.changeNotAvailable} /> : <><h3 className="text-2xl font-semibold">{labels.changeDetailsTitle}</h3>{(mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY') && <ScheduleEditor labels={labels} dayLabels={dayLabels} schedule={schedule} weeklyHours={weeklyHours} fulltimeHours={fulltimeHours} partTimeFactor={partTimeFactor} scheduleAverageDays={scheduleAverageDays} rosterMatches={rosterMatches} onWeeklyHours={distributeHours} onToggleTwoWeeks={() => setSchedule((current) => ({ ...current, twoWeekRoster: !current.twoWeekRoster }))} onToggleRosterInputMode={toggleRosterInputFormat} onTimeForTime={(value) => setSchedule((current) => ({ ...current, timeForTime: value }))} onDayChange={updateScheduleDay} />}{(mode === 'SALARY' || mode === 'SCHEDULE_SALARY') && <SalaryEditor locale={locale} labels={labels} salary={salary} salaryFactor={salaryFactor} options={data.options} onChange={updateSalary} />}{mode === 'ORGANIZATION_COST' && <OrganizationCostEditor labels={labels} organization={organization} allocations={allocations} options={data.options} allocationTotal={allocationTotal} onOrganizationChange={(key, value) => setOrganization((current) => ({ ...current, [key]: value }))} onAllocationChange={(index, key, value) => setAllocations((current) => current.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, [key]: value } : allocation))} onAddAllocation={() => setAllocations((current) => [...current, { costCenterId: data.options.costCenters[0]?.id ?? '', costCarrierId: data.options.costCarriers[0]?.id ?? '', percentage: '0' }])} onRemoveAllocation={(index) => setAllocations((current) => current.length > 1 ? current.filter((_, allocationIndex) => allocationIndex !== index) : current)} />}{mode === 'LABOR_CONDITIONS' && <LaborConditionsEditor labels={labels} options={data.options} value={laborConditionSetId} onChange={(value) => { setLaborConditionSetId(value); setState('idle') }} />}{mode === 'CONTRACT' && <ContractEditor contract={contract} labels={labels} options={data.options} isFirstContract={selectedContract.sequenceNumber === 1} employmentStartsOn={selectedContract.startsOn} onChange={(key, value) => { setContract((current) => ({ ...current, [key]: value })); setState('idle') }} />}</>}</section>}

        {step === 'review' && selectedContract && <section className="space-y-5"><div><p className="eyebrow text-primary">{labels.stepReview}</p><h3 className="mt-1 text-2xl font-semibold">{labels.reviewChangeTitle}</h3></div><div className="border-y border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(selectedContract, formatter, labels)}</p></div><dl className="grid gap-3 sm:grid-cols-2"><Summary label={labels.effectiveOn} value={dateLabel(effectiveOn, formatter)} /><Summary label={labels.change} value={modeTitle} />{(mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY') && <Summary label={labels.weeklyHours} value={`${weeklyHours} ${labels.hoursPerWeek}`} />}</dl><ReviewSummary actionKey={actionKey} labels={labels} schedule={schedule} weeklyHours={weeklyHours} partTimeFactor={partTimeFactor} salary={salary} organization={organization} allocations={allocations} laborConditionSetId={laborConditionSetId} contract={contract} data={data} locale={locale} formatter={formatter} /><label className="grid gap-1.5 text-sm font-medium"><span>{labels.changeReason}</span><textarea className="form-field min-h-24" maxLength={500} onChange={(event) => setReason(event.target.value)} required value={reason} /></label></section>}
         {step === 'details' && (mode === 'SALARY' || mode === 'SCHEDULE_SALARY') && salary.salaryRoute === 'SALARY_BAND' && data.options.salaryBands.find((item) => item.id === salary.salaryBandId) && <SalaryBandPercentageControl band={(() => { const selectedBand = data.options.salaryBands.find((item) => item.id === salary.salaryBandId); return { minimum: selectedBand?.minimumAmount.toFixed(2) ?? '0.00', midpoint: selectedBand?.midpointAmount.toFixed(2) ?? '0.00', maximum: selectedBand?.maximumAmount === null || selectedBand === undefined ? null : selectedBand.maximumAmount.toFixed(2) } })()} labels={{ percentage: labels.salaryBandMidpoint ?? labels.salaryBand, percentageHelp: labels.rangePenetration ?? labels.salaryBand }} salaryAmount={salary.fulltimeAmount || String(data.options.salaryBands.find((item) => item.id === salary.salaryBandId)?.midpointAmount ?? 0)} onSalaryAmountChange={(value) => { updateSalary('fulltimeAmount', value); updateSalary('parttimeAmount', moneyInput(asNumber(value) * salaryFactor)) }} />}
         {error && <p className="mt-5 border-y border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
        {state === 'saved' && <p className="mt-5 border-y border-success/30 bg-success-surface p-3 text-sm text-success" role="status">{labels.changeSaved}</p>}
      </form>
      <FormActions
        cancelLabel={labels.cancel}
        className="w-full px-5 py-4 sm:px-7"
        disabled={false}
        form="employment-contract-change-form"
        leading={<button className={buttonClasses({ variant: 'secondary' })} disabled={step === 'selection' || state === 'saving'} onClick={previous} type="button"><ChevronLeft aria-hidden="true" className="size-4" />{labels.previous}</button>}
        onCancel={requestClose}
        saveLabel={step !== 'review' ? labels.next : state === 'saving' ? labels.saving : labels.confirm}
        saving={state === 'saving'}
        sticky
      />
    </main>
    </div>
    <ConfirmDialog cancelLabel={labels.changeDiscardCancel} confirmLabel={labels.changeDiscardConfirm} description={labels.changeDiscardDescription} destructive onConfirm={discardChanges} onOpenChange={setDiscardConfirmOpen} open={discardConfirmOpen} title={labels.changeDiscardTitle} />
  </>
}

function isDateInContract(date: string, contract: EmploymentOverviewChangeData['contracts'][number]): boolean {
  return Boolean(date && date >= contract.startsOn && (!contract.endsOn || date <= contract.endsOn))
}

function sumDays(days: DayValues, inputMode: RosterHoursInputMode): number {
  return dayKeys.reduce((sum, day) => {
    const parsed = parseRosterHoursValue(days[day], inputMode)
    return sum + (Number.isFinite(parsed) ? parsed : 0)
  }, 0)
}
function averageDay(weeks: DayValues[], day: DayKey, inputMode: RosterHoursInputMode): number {
  return weeks.reduce((sum, week) => {
    const parsed = parseRosterHoursValue(week[day], inputMode)
    return sum + (Number.isFinite(parsed) ? parsed : 0)
  }, 0) / weeks.length
}
function moneyInput(value: number): string { return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '' }
function salaryIsValid(salary: SalaryDraft): boolean {
  if (salary.salaryRoute === 'MINIMUM_WAGE') return Boolean(salary.minimumWageScheme)
  if (salary.salaryRoute === 'SCALE_WITH_STEPS') return Boolean(salary.salaryStructureId && salary.salaryScaleId && salary.salaryStepCode)
  if (salary.salaryRoute === 'SALARY_BAND') return Boolean(salary.salaryStructureId && salary.salaryBandId && asNumber(salary.fulltimeAmount) > 0)
  return asNumber(salary.fulltimeAmount) > 0
}
function contractIsValid(contract: ContractDraft, selectedContract: EmploymentOverviewChangeData['contracts'][number] | null): boolean {
  if (!selectedContract || !isWorkerType(contract.workerType) || !isDurationType(contract.durationType) || !contract.laborConditionSetId || !contract.startsOn || contract.startsOn < selectedContract.startsOn) return false
  if (selectedContract.sequenceNumber === 1 && contract.startsOn !== selectedContract.startsOn) return false
  if (contract.workerType === 'TEMPORARY_AGENCY' && !contract.flexPhaseId) return false
  if (contract.durationType === 'DEFINITE' && (!contract.endsOn || contract.endsOn < contract.startsOn)) return false
  if (contract.probationApplies && (!contract.probationEndsOn || contract.probationEndsOn < contract.startsOn || (contract.durationType === 'DEFINITE' && Boolean(contract.endsOn) && contract.probationEndsOn > contract.endsOn))) return false
  return true
}
function contractSummary(contract: EmploymentOverviewChangeData['contracts'][number], formatter: Intl.DateTimeFormat, labels: Labels): string {
  return `${labels.contractNumber} ${contract.sequenceNumber} · ${contract.laborConditionName} · ${dateLabel(contract.startsOn, formatter)} — ${contract.endsOn ? dateLabel(contract.endsOn, formatter) : labels.active}`
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-subtle pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm text-foreground">{value || '—'}</dd></div>
}

function ContractDetails({ contract, formatter, labels }: { contract: EmploymentOverviewChangeData['contracts'][number]; formatter: Intl.DateTimeFormat; labels: Labels }) {
  return <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Summary label={labels.contractType} value={contractTypeLabel(contract.durationType, labels)} /><Summary label={labels.workerType} value={workerTypeLabel(contract.workerType, labels)} /><Summary label={labels.period} value={`${dateLabel(contract.startsOn, formatter)} — ${contract.endsOn ? dateLabel(contract.endsOn, formatter) : labels.active}`} /><Summary label={labels.fulltimeReference} value={`${contract.fulltimeHoursPerWeek} ${labels.hoursPerWeek}`} /></dl>
}

function SingleContractSelection({ contract, formatter, labels, locale, mode, salaries, today }: { contract: EmploymentOverviewChangeData['contracts'][number]; formatter: Intl.DateTimeFormat; labels: Labels; locale: string; mode: ActionMode; salaries: EmploymentOverviewChangeData['salaries']; today: string }) {
  return <><div className="border-y border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(contract, formatter, labels)}</p></div><div className="border border-subtle p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.contractNumber} {contract.sequenceNumber}</p><p className="mt-1 font-semibold">{contract.laborConditionName}</p></div><CircleCheck aria-hidden="true" className="size-5 text-success" /></div><ContractDetails contract={contract} formatter={formatter} labels={labels} /></div>{mode === 'SALARY' ? <SalaryHistory labels={labels} locale={locale} salaries={salaries} today={today} formatter={formatter} /> : null}</>
}

function MultiContractSelection({ contracts, formatter, labels, onChoose, selectedContract, selectedContractId }: { contracts: EmploymentOverviewChangeData['contracts']; formatter: Intl.DateTimeFormat; labels: Labels; onChoose: (contractId: string) => void; selectedContract: EmploymentOverviewChangeData['contracts'][number] | null; selectedContractId: string }) {
  return <><div><p className="eyebrow text-primary">{labels.chooseContract}</p><h3 className="mt-1 text-2xl font-semibold">{labels.contractSelectionTitle}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.contractSelectionHelp}</p></div><div className="grid gap-3 divide-y divide-subtle border-y border-subtle">{contracts.map((contract) => <button aria-pressed={selectedContractId === contract.id} className={`border-subtle p-4 text-left transition-colors ${selectedContractId === contract.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/40 hover:bg-muted/50'}`} key={contract.id} onClick={() => onChoose(contract.id)} type="button"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.contractNumber} {contract.sequenceNumber}</p><p className="mt-1 font-semibold">{contract.laborConditionName}</p></div>{selectedContractId === contract.id && <CircleCheck aria-hidden="true" className="size-5 text-primary" />}</div><ContractDetails contract={contract} formatter={formatter} labels={labels} /></button>)}</div>{selectedContract && <div className="border-y border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(selectedContract, formatter, labels)}</p></div>}</>
}

function SalaryHistory({ formatter, labels, locale, salaries, today }: { formatter: Intl.DateTimeFormat; labels: Labels; locale: string; salaries: EmploymentOverviewChangeData['salaries']; today: string }) {
  const ordered = [...salaries].sort((left, right) => right.validFrom.localeCompare(left.validFrom))
  return <section className="border border-subtle p-4 sm:p-5"><h3 className="text-lg font-semibold">{labels.salaryHistoryTitle}</h3>{ordered.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.salaryHistoryEmpty}</p> : <ol className="mt-4 divide-y divide-subtle border-y border-subtle">{ordered.map((row) => { const status = row.validFrom > today ? labels.future : row.validUntil && row.validUntil < today ? labels.historyLabel : labels.currentValue; const amount = row.paymentType === 'HOURLY_VARIABLE' ? moneyLabel(row.hourlyRate, row.currencyCode, locale) : moneyLabel(row.fulltimeAmount, row.currencyCode, locale); const parttime = row.paymentType === 'PERIODIC_FIXED' && row.parttimeAmount !== null ? moneyLabel(row.parttimeAmount, row.currencyCode, locale) : null; return <li className="grid gap-3 p-4 sm:grid-cols-[minmax(7rem,.55fr)_minmax(0,1fr)_auto]" key={row.id}><div><time className="text-sm font-semibold" dateTime={row.validFrom}>{dateLabel(row.validFrom, formatter)}</time><p className="mt-1 text-xs font-medium text-muted-foreground">{status}</p></div><div className="min-w-0"><p className="text-sm font-semibold">{row.paymentType === 'HOURLY_VARIABLE' ? labels.hourlyRate : labels.fulltimeSalary}</p><p className="mt-1 text-sm tabular-nums">{amount}{parttime ? ` · ${labels.parttimeSalary}: ${parttime}` : ''}</p></div><p className="text-right text-xs text-muted-foreground">{row.validUntil ? `${labels.validUntil}: ${dateLabel(row.validUntil, formatter)}` : labels.active}</p></li> })}</ol>}</section>
}

function TimelinePreview({ actionKey, contract, data, labels, locale, formatter }: { actionKey: EmploymentOverviewActionKey; contract: EmploymentOverviewChangeData['contracts'][number]; data: EmploymentOverviewChangeData; labels: Labels; locale: string; formatter: Intl.DateTimeFormat }) {
  const schedule = dateAt(data.schedules, contract.startsOn)
  const salary = dateAt(data.salaries, contract.startsOn)
  const organization = effectiveAt(data.organizations, contract.startsOn)
  const costCount = data.costAllocations.filter((row) => row.validFrom <= contract.startsOn && (!row.validUntil || row.validUntil >= contract.startsOn)).length
  const currentSummary = actionKey === 'hoursSchedule' || actionKey === 'hoursScheduleSalary'
    ? schedule ? `${schedule.averageHours} ${labels.hoursPerWeek} · ${Math.round(schedule.partTimeFactor * 100)}%` : labels.notRecorded
    : actionKey === 'salary'
      ? salary ? moneyLabel(salary.parttimeAmount ?? salary.fulltimeAmount ?? salary.hourlyRate, salary.currencyCode, locale) : labels.notRecorded
      : actionKey === 'functionDepartmentCostCenter'
        ? organization ? `${organization.departmentName} · ${organization.jobName}${costCount > 0 ? ` · ${costCount} ${labels.costCenter.toLowerCase()}` : ''}` : labels.notRecorded
        : labels.notRecorded
  return <p className="border-y bg-muted/20 px-1 py-3 text-sm"><span className="font-semibold">{labels.selectedContractStatement}</span><span className="ml-2 text-muted-foreground">{contractSummary(contract, formatter, labels)} · {labels.currentValue}: {currentSummary}</span></p>
}

function ScheduleEditor({ labels, dayLabels, schedule, weeklyHours, fulltimeHours, partTimeFactor, scheduleAverageDays, rosterMatches, onWeeklyHours, onToggleTwoWeeks, onToggleRosterInputMode, onTimeForTime, onDayChange }: { labels: Labels; dayLabels: string[]; schedule: ScheduleDraft; weeklyHours: number; fulltimeHours: number; partTimeFactor: number; scheduleAverageDays: number; rosterMatches: boolean; onWeeklyHours: (value: string) => void; onToggleTwoWeeks: () => void; onToggleRosterInputMode: () => void; onTimeForTime: (value: string) => void; onDayChange: (week: 1 | 2, day: DayKey, value: string) => void }) {
  const scope = Math.abs(weeklyHours - fulltimeHours) < 0.0001 ? labels.fullTime : labels.partTime
  return (
    <section className="border border-subtle p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Clock3 aria-hidden="true" className="size-5" /></span>
        <div><p className="eyebrow text-primary">{labels.stepSchedule}</p><h4 className="mt-1 text-lg font-semibold">{labels.roster}</h4><p className="mt-1 text-sm text-muted-foreground">{labels.hoursAgreementHelp}</p></div>
      </div>
      <fieldset className="mt-6 border-t pt-5">
        <legend className="text-base font-semibold">{labels.hoursAgreement}</legend>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1.25fr)]">
          <Field label={labels.employmentScope}><div aria-live="polite" className="form-field flex items-center bg-muted/40">{scope}</div></Field>
          <Field label={labels.weeklyHours}><div className="relative"><input className="form-field pr-14" inputMode="numeric" max="50" min="0" onChange={(event) => onWeeklyHours(event.target.value)} step="1" type="number" value={schedule.weeklyHours} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{labels.hourUnit}</span></div><span className="text-xs font-normal text-muted-foreground">{labels.fulltimeReference}: {fulltimeHours} {labels.hoursPerWeek}</span></Field>
          <Field label={labels.partTimeFactor}><div className="form-field flex items-center bg-muted/40">{Math.round(partTimeFactor * 10000) / 100}%</div><span className="text-xs font-normal text-muted-foreground">{labels.factorCalculated}</span></Field>
          <Field label={labels.averageDays}><div className="form-field flex items-center bg-muted/40">{Math.round(scheduleAverageDays * 100) / 100}</div></Field>
        </div>
      </fieldset>
      <fieldset className="mt-6 border-t pt-5">
        <legend className="text-base font-semibold">{labels.roster}</legend>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 flex-1 items-start gap-4"><div className="min-w-0"><p className="text-sm text-muted-foreground">{labels.rosterHelp}</p></div><Switch checked={schedule.rosterInputMode === 'HOURS_MINUTES'} className="shrink-0" description={schedule.rosterInputMode === 'HOURS_MINUTES' ? labels.rosterHoursMinutesHelp : labels.rosterDecimalHelp} label={schedule.rosterInputMode === 'HOURS_MINUTES' ? labels.rosterHoursMinutes : labels.rosterDecimal} onCheckedChange={onToggleRosterInputMode} /></div><button className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={onToggleTwoWeeks} type="button">{schedule.twoWeekRoster ? labels.removeSecondWeek : labels.addSecondWeek}</button></div>
        <RosterWeek inputMode={schedule.rosterInputMode} title={labels.weekOne} week={1} days={schedule.days} dayLabels={dayLabels} labels={labels} onDayChange={onDayChange} />
        {schedule.twoWeekRoster && <RosterWeek inputMode={schedule.rosterInputMode} title={labels.weekTwo} week={2} days={schedule.secondWeekDays} dayLabels={dayLabels} labels={labels} onDayChange={onDayChange} />}
      </fieldset>
      <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
        <Field label={labels.timeForTime}><div className="relative"><input className="form-field pr-14" inputMode="numeric" min="0" onChange={(event) => onTimeForTime(event.target.value)} step="1" type="number" value={schedule.timeForTime} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{labels.hourUnit}</span></div></Field>
        <div className={`self-end rounded-lg border p-3 text-sm ${rosterMatches ? 'border-success/30 bg-success-surface text-success' : 'border-destructive/30 bg-destructive/5 text-destructive'}`} role="status"><span className="font-semibold">{labels.rosterAverage}:</span> {scheduleAverageHours(schedule)} {labels.hoursPerWeek}{!rosterMatches ? ` · ${labels.rosterMismatch}` : ''}</div>
      </div>
    </section>
  )
}

function scheduleAverageHours(schedule: ScheduleDraft): number { return Math.round((sumDays(schedule.days, schedule.rosterInputMode) + (schedule.twoWeekRoster ? sumDays(schedule.secondWeekDays, schedule.rosterInputMode) : 0)) / (schedule.twoWeekRoster ? 2 : 1) * 100) / 100 }

function RosterWeek({ inputMode, title, week, days, dayLabels, labels, onDayChange }: { inputMode: RosterHoursInputMode; title: string; week: 1 | 2; days: DayValues; dayLabels: string[]; labels: Labels; onDayChange: (week: 1 | 2, day: DayKey, value: string) => void }) {
  const hourUnit = inputMode === 'HOURS_MINUTES' ? labels.rosterHoursMinutesUnit : labels.rosterDecimalUnit
  const placeholder = inputMode === 'HOURS_MINUTES' ? labels.rosterHoursMinutesPlaceholder : labels.rosterDecimalPlaceholder
  return <fieldset className="mt-4"><legend className="text-sm font-semibold">{title}</legend><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{dayKeys.map((day, index) => <label className="grid min-w-0 content-start gap-1.5 text-xs font-semibold" key={day}><span>{dayLabels[index]} <span className="font-normal text-muted-foreground">({hourUnit})</span></span><input aria-label={`${dayLabels[index]} ${hourUnit}`} className="form-field px-2" inputMode="decimal" onChange={(event) => onDayChange(week, day, event.target.value)} placeholder={placeholder} type="text" value={days[day]} /></label>)}</div></fieldset>
}

function SalaryAmountInput({ value, onChange, increaseLabel, decreaseLabel }: { value: string; onChange: (value: string) => void; increaseLabel: string; decreaseLabel: string }) {
  function step(direction: 1 | -1): void {
    const current = parseDecimalInput(value)
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + direction * 100)
    onChange(moneyInput(next))
  }

  function normalize(): void {
    const parsed = parseDecimalInput(value)
    if (Number.isFinite(parsed)) onChange(moneyInput(parsed))
  }

  return <div className="flex min-w-0"><input className="form-field min-w-0 flex-1 rounded-r-none" inputMode="decimal" min="0" onBlur={normalize} onChange={(event) => onChange(event.target.value)} type="text" value={value} /><div className="flex shrink-0 flex-col"><button aria-label={increaseLabel} className="inline-flex min-h-5 min-w-9 flex-1 items-center justify-center rounded-tr-[var(--radius-control)] border border-l-0 border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus" onClick={() => step(1)} type="button"><ChevronUp aria-hidden="true" className="size-4" /></button><button aria-label={decreaseLabel} className="inline-flex min-h-5 min-w-9 flex-1 items-center justify-center rounded-br-[var(--radius-control)] border border-l-0 border-t-0 border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus" onClick={() => step(-1)} type="button"><ChevronDown aria-hidden="true" className="size-4" /></button></div></div>
}

function SalaryEditor({ locale, labels, salary, salaryFactor, options, onChange }: { locale: string; labels: Labels; salary: SalaryDraft; salaryFactor: number; options: EmploymentOverviewChangeData['options']; onChange: <K extends keyof SalaryDraft>(key: K, value: SalaryDraft[K]) => void }) {
  const selectedBand = options.salaryBands.find((item) => item.id === salary.salaryBandId)
  const selectedScale = options.salaryScaleSteps.find((item) => item.id === salary.salaryScaleStepId)
  const availableRoutes = options.salaryRoutes
  return <section className="border border-subtle p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-foreground"><CalendarDays aria-hidden="true" className="size-5" /></span><div><p className="eyebrow text-primary">{labels.salary}</p><h4 className="mt-1 text-lg font-semibold">{labels.stepSalary}</h4></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={labels.salaryCalculation}><DropdownSelect searchable searchPlaceholder={labels.salaryCalculation} value={salary.salaryRoute} onChange={(event) => onChange('salaryRoute', event.target.value as SalaryDraft['salaryRoute'])}><option value="MANUAL">{labels.salaryManual}</option>{availableRoutes.includes('MINIMUM_WAGE') && <option value="MINIMUM_WAGE">{labels.salaryMinimum}</option>}{availableRoutes.includes('SCALE_WITH_STEPS') && <option value="SCALE_WITH_STEPS">{labels.salaryTable}</option>}{availableRoutes.includes('SALARY_BAND') && <option value="SALARY_BAND">{labels.salaryBand}</option>}</DropdownSelect></Field><Field label={labels.paymentFrequency}><DropdownSelect value={salary.paymentFrequency} onChange={(event) => onChange('paymentFrequency', event.target.value as SalaryDraft['paymentFrequency'])}><option value="MONTHLY">{labels.monthly}</option><option value="FOUR_WEEKLY">{labels.fourWeekly}</option></DropdownSelect></Field>{salary.salaryRoute === 'MINIMUM_WAGE' && <><Field label={labels.salaryApplicationScheme ?? labels.salaryMinimum}><DropdownSelect value={salary.minimumWageScheme} onChange={(event) => onChange('minimumWageScheme', event.target.value as SalaryDraft['minimumWageScheme'])}><option value="REGULAR">{labels.salaryRegular ?? 'REGULAR'}</option><option value="BBL">{labels.salaryBbl ?? 'BBL'}</option></DropdownSelect></Field><p className="self-end text-sm text-muted-foreground">{labels.salaryApplicationExternalAmount ?? labels.notRecorded}</p></>}{salary.salaryRoute === 'SCALE_WITH_STEPS' && <><Field label={labels.salaryScale}><DropdownSelect searchable searchPlaceholder={labels.salaryScale} emptyLabel={labels.notRecorded} value={salary.salaryScaleId} onChange={(event) => onChange('salaryScaleId', event.target.value)}>{options.salaryScales.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.salaryScaleStep}><DropdownSelect searchable searchPlaceholder={labels.salaryScaleStep} emptyLabel={labels.notRecorded} value={salary.salaryScaleStepId} onChange={(event) => onChange('salaryScaleStepId', event.target.value)}>{options.salaryScaleSteps.filter((item) => item.salaryScaleId === salary.salaryScaleId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</DropdownSelect></Field><Field label={labels.salaryScaleAmount}><input className="form-field bg-muted/40" readOnly value={selectedScale ? `€ ${selectedScale.fulltimeAmount.toFixed(2)}` : '—'} /></Field></>}{salary.salaryRoute === 'SALARY_BAND' && <Field label={labels.salaryBand}><DropdownSelect searchable searchPlaceholder={labels.salaryBand} emptyLabel={labels.notRecorded} value={salary.salaryBandId} onChange={(event) => onChange('salaryBandId', event.target.value)}>{options.salaryBands.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field>}{(salary.salaryRoute === 'MANUAL' || salary.salaryRoute === 'SALARY_BAND') && <><Field label={labels.fulltimeSalary}><SalaryAmountInput decreaseLabel={labels.salaryDecrease} increaseLabel={labels.salaryIncrease} onChange={(value) => onChange('fulltimeAmount', value)} value={salary.fulltimeAmount} /></Field><Field label={labels.parttimeSalary}><SalaryAmountInput decreaseLabel={labels.salaryDecrease} increaseLabel={labels.salaryIncrease} onChange={(value) => onChange('parttimeAmount', value)} value={salary.parttimeAmount} /><span className="text-xs font-normal text-muted-foreground">{labels.partTimeFactor}: {Math.round(salaryFactor * 10000) / 100}%</span></Field></>}{salary.salaryRoute === 'SALARY_BAND' && selectedBand && <div className="sm:col-span-2"><SalaryBandPositionCard salaryAmount={salary.fulltimeAmount || String(selectedBand.midpointAmount)} band={{ minimum: selectedBand.minimumAmount.toFixed(2), midpoint: selectedBand.midpointAmount.toFixed(2), maximum: selectedBand.maximumAmount === null ? null : selectedBand.maximumAmount.toFixed(2) }} locale={locale} currencyCode="EUR" labels={{ preview: labels.salaryBand, currentSalary: labels.fulltimeSalary, minimum: labels.salaryBandMinimum ?? labels.salaryBand, midpoint: labels.salaryBandMidpoint ?? labels.salaryBand, maximum: labels.salaryBandMaximum ?? labels.salaryBand, compaRatio: labels.compaRatio ?? labels.salaryBand, rangePenetration: labels.rangePenetration ?? labels.salaryBand, status: labels.status ?? labels.salaryBand, underMinimum: labels.underMinimum ?? labels.salaryBand, withinRange: labels.withinRange ?? labels.salaryBand, aboveMaximum: labels.aboveMaximum ?? labels.salaryBand, noValidBand: labels.noValidBand ?? labels.salaryBand, openEnded: labels.salaryOpenEnded ?? '—' }} /></div>}</div></section>
}

function LaborConditionsEditor({ labels, options, value, onChange }: { labels: Labels; options: EmploymentOverviewChangeData['options']; value: string; onChange: (value: string) => void }) {
  return <section className="border border-subtle p-4 sm:p-5"><div><p className="eyebrow text-primary">{labels.laborConditionsLabel}</p><h4 className="mt-1 text-lg font-semibold">{labels.changeLaborConditions}</h4></div><div className="mt-5 max-w-xl"><Field label={labels.laborConditionsLabel}><DropdownSelect searchable searchPlaceholder={labels.laborConditionsLabel} emptyLabel={labels.notRecorded} value={value} onChange={(event) => onChange(event.target.value)}>{options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect></Field></div></section>
}

function ContractEditor({ contract, labels, options, isFirstContract, employmentStartsOn, onChange }: { contract: ContractDraft; labels: Labels; options: EmploymentOverviewChangeData['options']; isFirstContract: boolean; employmentStartsOn: string; onChange: <K extends keyof ContractDraft>(key: K, value: ContractDraft[K]) => void }) {
  const selectedLaborCondition = options.laborConditionSets.find((item) => item.id === contract.laborConditionSetId)
  const fulltimeHours = selectedLaborCondition?.standardHoursPerWeek ?? 40
  return <section className="border border-subtle p-4 sm:p-5"><div><p className="eyebrow text-primary">{labels.changeContractTypeStartDate}</p><h4 className="mt-1 text-lg font-semibold">{labels.changeDetailsTitle}</h4></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={labels.workerType}><DropdownSelect name="contractWorkerType" searchable searchPlaceholder={labels.selectWorkerType} value={contract.workerType} onChange={(event) => onChange('workerType', event.target.value as WorkerType)}><option value="EMPLOYEE">{labels.workerEmployee}</option><option value="STUDENT_INTERN">{labels.workerStudentIntern}</option><option value="TEMPORARY_AGENCY">{labels.workerTemporaryAgency}</option><option value="EXTERNAL_NO_PAYROLL">{labels.workerExternal}</option></DropdownSelect></Field>{contract.workerType === 'TEMPORARY_AGENCY' && <Field label={labels.flexPhase}><DropdownSelect name="contractFlexPhaseId" searchable searchPlaceholder={labels.flexPhase} emptyLabel={labels.notRecorded} value={contract.flexPhaseId} onChange={(event) => onChange('flexPhaseId', event.target.value)}>{options.flexPhases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect></Field>}<Field label={labels.laborConditionsLabel}><DropdownSelect name="contractLaborConditionSetId" searchable searchPlaceholder={labels.laborConditionsLabel} emptyLabel={labels.notRecorded} value={contract.laborConditionSetId} onChange={(event) => onChange('laborConditionSetId', event.target.value)}>{options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect></Field><Field label={labels.fulltimeReference}><input className="form-field bg-muted/40" readOnly value={`${fulltimeHours} ${labels.hoursPerWeek}`} /></Field><Field label={labels.duration}><DropdownSelect name="contractDurationType" value={contract.durationType} onChange={(event) => { const durationType = event.target.value as DurationType; onChange('durationType', durationType); if (durationType !== 'DEFINITE') onChange('endsOn', '') }}><option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option><option value="TEMPORARY_NO_END">{labels.temporaryWithoutEnd}</option></DropdownSelect></Field><Field label={labels.startDate}><input name="contractStartsOn" className={`form-field${isFirstContract ? ' bg-muted/40' : ''}`} min={employmentStartsOn} readOnly={isFirstContract} type="date" value={contract.startsOn} onChange={(event) => onChange('startsOn', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{isFirstContract ? labels.firstContractStartDateHelp : labels.contractStartDateMinimumHelp}</span></Field>{contract.durationType === 'DEFINITE' && <Field label={labels.endDate}><input name="contractEndsOn" className="form-field" min={contract.startsOn} type="date" value={contract.endsOn} onChange={(event) => onChange('endsOn', event.target.value)} /></Field>}<Field label={labels.probation}><DropdownSelect name="contractProbationApplies" value={String(contract.probationApplies)} onChange={(event) => { const applies = event.target.value === 'true'; onChange('probationApplies', applies); if (!applies) onChange('probationEndsOn', '') }}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></DropdownSelect></Field>{contract.probationApplies && <Field label={labels.probationEnd}><input name="contractProbationEndsOn" className="form-field" min={contract.startsOn} max={contract.durationType === 'DEFINITE' ? contract.endsOn || undefined : undefined} type="date" value={contract.probationEndsOn} onChange={(event) => onChange('probationEndsOn', event.target.value)} /></Field>}</div>{selectedLaborCondition?.probationMaximumMonths === 2 && <p className="mt-4 text-xs text-muted-foreground">{labels.probationCaoMaximum}</p>}</section>
}

function OrganizationCostEditor({ labels, organization, allocations, options, allocationTotal, onOrganizationChange, onAllocationChange, onAddAllocation, onRemoveAllocation }: { labels: Labels; organization: { departmentId: string; jobId: string }; allocations: AllocationDraft[]; options: EmploymentOverviewChangeData['options']; allocationTotal: number; onOrganizationChange: (key: 'departmentId' | 'jobId', value: string) => void; onAllocationChange: (index: number, key: 'costCenterId' | 'costCarrierId' | 'percentage', value: string) => void; onAddAllocation: () => void; onRemoveAllocation: (index: number) => void }) {
  return <section className="border border-subtle p-4 sm:p-5"><div><p className="eyebrow text-primary">{labels.organizationPlacement}</p><h4 className="mt-1 text-lg font-semibold">{labels.changeFunctionDepartmentCostCenter}</h4></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={labels.department}><DropdownSelect searchable searchPlaceholder={labels.department} emptyLabel={labels.notRecorded} value={organization.departmentId} onChange={(event) => onOrganizationChange('departmentId', event.target.value)}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.job}><DropdownSelect searchable searchPlaceholder={labels.job} emptyLabel={labels.notRecorded} value={organization.jobId} onChange={(event) => onOrganizationChange('jobId', event.target.value)}>{options.jobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h5 className="font-semibold">{labels.costCenter}</h5><button className={buttonClasses({ variant: 'secondary' })} onClick={onAddAllocation} type="button">{labels.addAllocation}</button></div><div className="mt-3 space-y-3">{allocations.map((allocation, index) => <div className="grid gap-3 rounded-[var(--radius-control)] border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]" key={`${index}-${allocation.costCenterId}`}><Field label={labels.costCenter}><DropdownSelect searchable searchPlaceholder={labels.costCenter} emptyLabel={labels.notRecorded} value={allocation.costCenterId} onChange={(event) => onAllocationChange(index, 'costCenterId', event.target.value)}>{options.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.costCarrier}><DropdownSelect searchable searchPlaceholder={labels.costCarrier} emptyLabel={labels.notRecorded} value={allocation.costCarrierId} onChange={(event) => onAllocationChange(index, 'costCarrierId', event.target.value)}>{options.costCarriers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.allocationPercentage}><input className="form-field" min="0.01" max="100" onChange={(event) => onAllocationChange(index, 'percentage', event.target.value)} step="0.01" type="number" value={allocation.percentage} /></Field><button aria-label={labels.removeAllocation} className={buttonClasses({ variant: 'secondary', className: 'self-end p-2' })} disabled={allocations.length === 1} onClick={() => onRemoveAllocation(index)} type="button">{labels.removeAllocation}</button></div>)}</div><p className={`mt-3 text-sm ${Math.abs(allocationTotal - 100) < 0.001 ? 'text-success' : 'text-destructive'}`}>{labels.allocationTotal}: {allocationTotal.toFixed(2)}%{Math.abs(allocationTotal - 100) >= 0.001 ? ` · ${labels.allocationMismatch}` : ''}</p></section>
}

function ReviewSummary({ actionKey, labels, schedule, weeklyHours, partTimeFactor, salary, organization, allocations, laborConditionSetId, contract, data, locale, formatter }: { actionKey: EmploymentOverviewActionKey; labels: Labels; schedule: ScheduleDraft; weeklyHours: number; partTimeFactor: number; salary: SalaryDraft; organization: { departmentId: string; jobId: string }; allocations: AllocationDraft[]; laborConditionSetId: string; contract: ContractDraft; data: EmploymentOverviewChangeData; locale: string; formatter: Intl.DateTimeFormat }) {
  return <div className="grid gap-3 sm:grid-cols-2">{(actionKey === 'hoursSchedule' || actionKey === 'hoursScheduleSalary') && <><Summary label={labels.weeklyHours} value={`${weeklyHours} ${labels.hoursPerWeek}`} /><Summary label={labels.partTimeFactor} value={`${Math.round(partTimeFactor * 10000) / 100}%`} /><Summary label={labels.roster} value={`${scheduleAverageHours(schedule)} ${labels.hoursPerWeek}`} /></>}{(actionKey === 'hoursScheduleSalary' || actionKey === 'salary') && <><Summary label={labels.salaryCalculation} value={salaryBasisLabel(salary.salaryBasis, labels)} /><Summary label={labels.fulltimeSalary} value={salary.salaryBasis === 'MINIMUM_WAGE' ? `${salary.hourlyRate} ${labels.hourlyRate.toLowerCase()}` : moneyLabel(asNumber(salary.fulltimeAmount), 'EUR', locale)} /><Summary label={labels.parttimeSalary} value={salary.salaryBasis === 'MINIMUM_WAGE' ? labels.notRecorded : moneyLabel(asNumber(salary.parttimeAmount), 'EUR', locale)} /></>}{actionKey === 'functionDepartmentCostCenter' && <><Summary label={labels.department} value={data.options.departments.find((item) => item.id === organization.departmentId)?.name ?? labels.notRecorded} /><Summary label={labels.job} value={data.options.jobs.find((item) => item.id === organization.jobId)?.name ?? labels.notRecorded} /><Summary label={labels.costCenter} value={`${allocations.length} ${labels.costCenter.toLowerCase()}`} /><Summary label={labels.allocationTotal} value={`${allocations.reduce((sum, allocation) => sum + asNumber(allocation.percentage), 0).toFixed(2)}%`} /></>}{actionKey === 'laborConditions' && <Summary label={labels.laborConditionsLabel} value={data.options.laborConditionSets.find((item) => item.id === laborConditionSetId)?.name ?? labels.notRecorded} />}{actionKey === 'contractTypeStartDate' && <><Summary label={labels.workerType} value={workerTypeLabel(contract.workerType, labels)} /><Summary label={labels.contractType} value={contractTypeLabel(contract.durationType, labels)} /><Summary label={labels.laborConditionsLabel} value={data.options.laborConditionSets.find((item) => item.id === contract.laborConditionSetId)?.name ?? labels.notRecorded} /><Summary label={labels.period} value={`${dateLabel(contract.startsOn, formatter)} — ${contract.endsOn ? dateLabel(contract.endsOn, formatter) : labels.active}`} /></>}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label> }

class ChangeRequestError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'ChangeRequestError'
  }
}

async function post(url: string, body: unknown): Promise<void> {
  await request(url, 'POST', body)
}

async function request(url: string, method: 'PATCH' | 'POST', body: unknown): Promise<void> {
  const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { code?: unknown } | null
    throw new ChangeRequestError(typeof result?.code === 'string' ? result.code : 'REQUEST_FAILED')
  }
}
