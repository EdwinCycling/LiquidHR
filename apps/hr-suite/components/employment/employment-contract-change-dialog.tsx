'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock3, X } from 'lucide-react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { SalaryBandPositionCard } from '@/components/salary/salary-band-position-card'
import { SalaryBandPercentageControl } from '@/components/salary/salary-band-percentage-control'
import { calculateCappedPartTimeFactor } from '@/lib/employment/fulltime-reference'

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
    laborConditionName: string
    fulltimeHoursPerWeek: number
    durationType: string
    startsOn: string
    endsOn: string | null
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
type ActionMode = 'SCHEDULE' | 'SCHEDULE_SALARY' | 'ORGANIZATION_COST' | 'SALARY' | null
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

function modeForAction(actionKey: EmploymentOverviewActionKey): ActionMode {
  if (actionKey === 'hoursSchedule') return 'SCHEDULE'
  if (actionKey === 'hoursScheduleSalary') return 'SCHEDULE_SALARY'
  if (actionKey === 'functionDepartmentCostCenter') return 'ORGANIZATION_COST'
  if (actionKey === 'salary') return 'SALARY'
  return null
}

function asNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function asInput(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function dateAt<T extends { validFrom: string; validUntil?: string | null }>(rows: T[], date: string): T | undefined {
  return [...rows].filter((row) => row.validFrom <= date && (!row.validUntil || row.validUntil >= date)).sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0]
}

function effectiveAt<T extends { effectiveFrom: string; effectiveTo?: string | null }>(rows: T[], date: string): T | undefined {
  return [...rows].filter((row) => row.effectiveFrom <= date && (!row.effectiveTo || row.effectiveTo >= date)).sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
}

function intersectsContract(validFrom: string, validUntil: string | null, contract: EmploymentOverviewChangeData['contracts'][number]): boolean {
  return validFrom <= (contract.endsOn ?? '9999-12-31') && (!validUntil || validUntil >= contract.startsOn)
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
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function workPatternDays(weeks: DayValues[]): Array<{ weekIndex: number; isoWeekday: number; isWorkingDay: boolean; startsAt: string | null; endsAt: string | null; breakMinutes: number; scheduledMinutes: number; note: null }> {
  return weeks.flatMap((week, weekIndex) => dayKeys.map((day, dayIndex) => {
    const scheduledMinutes = Math.round(asNumber(week[day]) * 60)
    return {
      weekIndex: weekIndex + 1,
      isoWeekday: dayIndex + 1,
      isWorkingDay: scheduledMinutes > 0,
      startsAt: scheduledMinutes > 0 ? '00:00' : null,
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

function scheduleTypeLabel(value: string, labels: Labels): string {
  if (value === 'HOURS_PER_DAY') return labels.hoursPerDay
  if (value === 'HOURS_AND_AVG_DAYS') return labels.hoursAndAverageDays
  if (value === 'HOURS_AND_SPECIFIC_DAYS') return labels.hoursAndSpecificDays
  if (value === 'TIMES_PER_DAY') return labels.timesPerDay
  return labels.notRecorded
}

function salaryBasisLabel(value: string, labels: Labels): string {
  if (value === 'MINIMUM_WAGE') return labels.salaryMinimum
  if (value === 'CUSTOM_SCALE') return labels.salaryTable
  if (value === 'SALARY_BAND') return labels.salaryBand
  if (value === 'CAO_SCALE') return labels.caoScale
  return labels.salaryManual
}

function paymentFrequencyLabel(value: string, labels: Labels): string {
  return value === 'FOUR_WEEKLY' ? labels.fourWeekly : labels.monthly
}

function initialSchedule(
  rows: EmploymentOverviewChangeData['schedules'],
  date: string,
): { weeklyHours: string; days: DayValues; secondWeekDays: DayValues; twoWeekRoster: boolean; timeForTime: string } {
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
  }
}

function initialSalary(rows: EmploymentOverviewChangeData['salaries'], date: string): SalaryDraft {
  const row = dateAt(rows, date)
  const route = row?.salaryRoute === 'MINIMUM_WAGE' || row?.salaryRoute === 'SCALE_WITH_STEPS' || row?.salaryRoute === 'SALARY_BAND'
    ? row.salaryRoute
    : row?.salaryBasis === 'MINIMUM_WAGE' ? 'MINIMUM_WAGE' : row?.salaryBasis === 'CUSTOM_SCALE' ? 'SCALE_WITH_STEPS' : row?.salaryBasis === 'SALARY_BAND' ? 'SALARY_BAND' : 'MANUAL'
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
  const active = rows.filter((row) => row.validFrom <= date && (!row.validUntil || row.validUntil >= date)).sort((left, right) => left.validFrom.localeCompare(right.validFrom))
  if (active.length > 0) return active.map((row) => ({ costCenterId: row.costCenterId, costCarrierId: row.costCarrierId, percentage: asInput(row.percentage) }))
  return [{ costCenterId: options.costCenters[0]?.id ?? '', costCarrierId: options.costCarriers[0]?.id ?? '', percentage: '100' }]
}

function initialOrganization(rows: EmploymentOverviewChangeData['organizations'], date: string, options: EmploymentOverviewChangeData['options']) {
  const row = effectiveAt(rows, date)
  return { departmentId: row?.departmentId ?? options.departments[0]?.id ?? '', jobId: row?.jobId ?? options.jobs[0]?.id ?? '' }
}

function fieldClassName(invalid = false): string {
  return `form-field${invalid ? ' border-destructive' : ''}`
}

export function EmploymentContractChangeDialog({ actionKey, actionTitle, employmentId, today, locale, data, labels, dayLabels, onClose }: Props) {
  const router = useRouter()
  const mode = modeForAction(actionKey)
  const closeRef = useRef<HTMLButtonElement>(null)
  const orderedContracts = useMemo(() => [...data.contracts].sort((left, right) => left.sequenceNumber - right.sequenceNumber), [data.contracts])
  const [step, setStep] = useState<Step>('selection')
  const [selectedContractId, setSelectedContractId] = useState(orderedContracts.length === 1 ? orderedContracts[0]?.id ?? '' : '')
  const selectedContract = orderedContracts.find((contract) => contract.id === selectedContractId) ?? null
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale])
  const [dateChoice, setDateChoice] = useState<DateChoice>('contract')
  const [effectiveOn, setEffectiveOn] = useState(selectedContract?.startsOn ?? today)
  const [schedule, setSchedule] = useState(() => initialSchedule(data.schedules, selectedContract?.startsOn ?? today))
  const [salary, setSalary] = useState(() => initialSalary(data.salaries, selectedContract?.startsOn ?? today))
  const [organization, setOrganization] = useState(() => initialOrganization(data.organizations, selectedContract?.startsOn ?? today, data.options))
  const [allocations, setAllocations] = useState<AllocationDraft[]>(() => initialAllocations(data.costAllocations, selectedContract?.startsOn ?? today, data.options))
  const [reason, setReason] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && state !== 'saving') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, state])

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
  const scheduleAverageHours = scheduleWeeks.reduce((sum, week) => sum + sumDays(week), 0) / scheduleWeeks.length
  const scheduleAverageDays = scheduleWeeks.reduce((sum, week) => sum + dayKeys.filter((day) => asNumber(week[day]) > 0).length, 0) / scheduleWeeks.length
  const weeklyHours = asNumber(schedule.weeklyHours)
  const fulltimeHours = selectedContract?.fulltimeHoursPerWeek ?? 40
  const partTimeFactor = calculateCappedPartTimeFactor(weeklyHours, fulltimeHours)
  const rosterMatches = Math.abs(scheduleAverageHours - weeklyHours) < 0.001
  const salaryFactor = mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY' ? partTimeFactor : calculateCappedPartTimeFactor(asNumber(dateAt(data.schedules, effectiveOn)?.averageHours ?? fulltimeHours), fulltimeHours)
  const allocationTotal = allocations.reduce((sum, allocation) => sum + asNumber(allocation.percentage), 0)
  const detailsValid = mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY'
    ? weeklyHours >= 0 && weeklyHours <= 50 && rosterMatches && (mode === 'SCHEDULE' || salaryIsValid(salary))
    : mode === 'SALARY'
      ? salaryIsValid(salary)
      : mode === 'ORGANIZATION_COST'
        ? Boolean(organization.departmentId && organization.jobId) && Math.abs(allocationTotal - 100) < 0.001 && allocations.every((allocation) => allocation.costCenterId && allocation.costCarrierId && asNumber(allocation.percentage) > 0)
        : false

  function chooseContract(contractId: string): void {
    const contract = orderedContracts.find((item) => item.id === contractId)
    setSelectedContractId(contractId)
    if (contract) {
      setEffectiveOn(contract.startsOn)
      setDateChoice('contract')
      setError('')
    }
  }

  function hydrateDrafts(): void {
    setSchedule(initialSchedule(data.schedules, effectiveOn))
    setSalary(initialSalary(data.salaries, effectiveOn))
    setOrganization(initialOrganization(data.organizations, effectiveOn, data.options))
    setAllocations(initialAllocations(data.costAllocations, effectiveOn, data.options))
  }

  function next(): void {
    if (step === 'selection') {
      if (!selectedContract) { setError(labels.chooseContract); return }
      setStep(mode ? 'date' : 'details')
      return
    }
    if (step === 'date') {
      if (!selectedContract || !isDateInContract(effectiveOn, selectedContract)) { setError(labels.dateOutsideContract); return }
      hydrateDrafts()
      setStep('details')
      return
    }
    if (step === 'details') {
      if (!detailsValid) { setError(labels.requiredFields); return }
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
      mondayHours: averageDay(scheduleWeeks, 'monday'), tuesdayHours: averageDay(scheduleWeeks, 'tuesday'),
      wednesdayHours: averageDay(scheduleWeeks, 'wednesday'), thursdayHours: averageDay(scheduleWeeks, 'thursday'),
      fridayHours: averageDay(scheduleWeeks, 'friday'), saturdayHours: averageDay(scheduleWeeks, 'saturday'), sundayHours: averageDay(scheduleWeeks, 'sunday'),
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
    await post(`/api/employments/${employmentId}/work-patterns`, {
      name: labels.roster,
      cycleWeeks: weeks.length,
      anchorDate: toMonday(effectiveOn),
      validFrom: effectiveOn,
      validUntil: selectedContract.endsOn && selectedContract.endsOn > effectiveOn ? selectedContract.endsOn : null,
      days: workPatternDays(weeks),
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
      }
      setState('saved')
      router.refresh()
    } catch {
      setState('failed')
      setError(labels.changeFailed)
    }
  }

  const modeTitle = mode === 'SCHEDULE' ? labels.changeHoursSchedule
    : mode === 'SCHEDULE_SALARY' ? labels.changeHoursScheduleSalary
      : mode === 'ORGANIZATION_COST' ? labels.changeFunctionDepartmentCostCenter
        : mode === 'SALARY' ? labels.changeSalary : actionTitle
  const stepLabels = [labels.stepSelection, labels.stepDate, labels.stepDetails, labels.stepReview]
  const stepIndex = step === 'selection' ? 0 : step === 'date' ? 1 : step === 'details' ? 2 : 3

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-3 sm:p-6" role="presentation">
    <section aria-labelledby="employment-contract-change-title" aria-modal="true" className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border bg-surface shadow-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <header className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7">
        <div className="min-w-0"><p className="eyebrow text-primary">{labels.changeModalTitle}</p><h2 className="mt-1 truncate text-xl font-semibold" id="employment-contract-change-title">{modeTitle}</h2></div>
        <button aria-label={labels.cancel} className="button-secondary shrink-0 p-2" disabled={state === 'saving'} onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" className="size-4" /></button>
      </header>
      <div className="border-b bg-muted/20 px-5 py-3 sm:px-7"><ol className="grid gap-2 sm:grid-cols-4">{stepLabels.map((label, index) => <li className={`flex items-center gap-2 text-xs font-semibold ${index <= stepIndex ? 'text-primary' : 'text-muted-foreground'}`} key={label}><span className={`grid size-7 place-items-center rounded-full border ${index <= stepIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{index + 1}</span><span>{label}</span></li>)}</ol></div>
      <form className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6" onSubmit={(event) => void save(event)}>
        {step === 'selection' && <section className="space-y-5"><div><p className="eyebrow text-primary">{labels.chooseContract}</p><h3 className="mt-1 text-2xl font-semibold">{labels.contractSelectionTitle}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.contractSelectionHelp}</p></div><div className="grid gap-3">{orderedContracts.map((contract) => <button aria-pressed={selectedContractId === contract.id} className={`rounded-2xl border p-4 text-left transition ${selectedContractId === contract.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/40 hover:bg-muted/50'}`} key={contract.id} onClick={() => chooseContract(contract.id)} type="button"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{labels.contractNumber} {contract.sequenceNumber}</p><p className="mt-1 font-semibold">{contract.laborConditionName}</p></div>{selectedContractId === contract.id && <CircleCheck aria-hidden="true" className="size-5 text-primary" />}</div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><Summary label={labels.contractType} value={contractTypeLabel(contract.durationType, labels)} /><Summary label={labels.workerType} value={workerTypeLabel(contract.workerType, labels)} /><Summary label={labels.period} value={`${dateLabel(contract.startsOn, formatter)} — ${contract.endsOn ? dateLabel(contract.endsOn, formatter) : labels.active}`} /><Summary label={labels.fulltimeReference} value={`${contract.fulltimeHoursPerWeek} ${labels.hoursPerWeek}`} /></dl></button>)}</div>{selectedContract && <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(selectedContract, formatter, labels)}</p></div>}</section>}

        {step === 'date' && selectedContract && <section className="space-y-6"><div><p className="eyebrow text-primary">{labels.timelineBeforeChange}</p><h3 className="mt-1 text-2xl font-semibold">{labels.changeStartDateTitle}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.changeStartDateHelp}</p></div><TimelinePreview actionKey={actionKey} contract={selectedContract} data={data} labels={labels} locale={locale} formatter={formatter} /><fieldset><legend className="text-sm font-semibold">{labels.changeStartDateTitle}</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{dateChoices.map((choice) => <button className={`rounded-xl border p-3 text-left text-sm transition ${choice.disabled ? 'cursor-not-allowed opacity-50' : dateChoice === choice.key ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:border-primary/40'}`} disabled={choice.disabled} key={choice.key} onClick={() => { setDateChoice(choice.key); setEffectiveOn(choice.date); setError('') }} type="button"><span className="font-semibold">{choice.label}</span><span className="mt-1 block text-muted-foreground">{dateLabel(choice.date, formatter)}</span></button>)}</div><label className="mt-3 grid gap-1.5 text-sm font-medium sm:max-w-sm"><span>{labels.customDateOption}</span><input aria-label={labels.customDateOption} className={fieldClassName(Boolean(selectedContract && !isDateInContract(effectiveOn, selectedContract)))} max={selectedContract.endsOn ?? undefined} min={selectedContract.startsOn} onChange={(event) => { setDateChoice('custom'); setEffectiveOn(event.target.value); setError('') }} type="date" value={dateChoice === 'custom' ? effectiveOn : ''} /></label></fieldset></section>}

        {step === 'details' && selectedContract && <section className="space-y-6"><div className="rounded-2xl border border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(selectedContract, formatter, labels)} · {labels.effectiveOn}: {dateLabel(effectiveOn, formatter)}</p></div>{mode === null ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.changeNotAvailable}</p> : <><h3 className="text-2xl font-semibold">{labels.changeDetailsTitle}</h3>{(mode === 'SCHEDULE' || mode === 'SCHEDULE_SALARY') && <ScheduleEditor labels={labels} dayLabels={dayLabels} schedule={schedule} weeklyHours={weeklyHours} fulltimeHours={fulltimeHours} partTimeFactor={partTimeFactor} scheduleAverageDays={scheduleAverageDays} rosterMatches={rosterMatches} onWeeklyHours={distributeHours} onToggleTwoWeeks={() => setSchedule((current) => ({ ...current, twoWeekRoster: !current.twoWeekRoster }))} onTimeForTime={(value) => setSchedule((current) => ({ ...current, timeForTime: value }))} onDayChange={updateScheduleDay} />}{(mode === 'SALARY' || mode === 'SCHEDULE_SALARY') && <SalaryEditor locale={locale} labels={labels} salary={salary} salaryFactor={salaryFactor} options={data.options} onChange={updateSalary} />}{mode === 'ORGANIZATION_COST' && <OrganizationCostEditor labels={labels} organization={organization} allocations={allocations} options={data.options} allocationTotal={allocationTotal} onOrganizationChange={(key, value) => setOrganization((current) => ({ ...current, [key]: value }))} onAllocationChange={(index, key, value) => setAllocations((current) => current.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, [key]: value } : allocation))} onAddAllocation={() => setAllocations((current) => [...current, { costCenterId: data.options.costCenters[0]?.id ?? '', costCarrierId: data.options.costCarriers[0]?.id ?? '', percentage: '0' }])} onRemoveAllocation={(index) => setAllocations((current) => current.length > 1 ? current.filter((_, allocationIndex) => allocationIndex !== index) : current)} />}</>}</section>}

        {step === 'review' && selectedContract && <section className="space-y-5"><div><p className="eyebrow text-primary">{labels.stepReview}</p><h3 className="mt-1 text-2xl font-semibold">{labels.reviewChangeTitle}</h3></div><div className="rounded-2xl border border-primary/25 bg-primary/5 p-4"><p className="font-semibold text-primary">{labels.selectedContractStatement}</p><p className="mt-1 text-sm text-muted-foreground">{contractSummary(selectedContract, formatter, labels)}</p></div><dl className="grid gap-3 sm:grid-cols-3"><Summary label={labels.effectiveOn} value={dateLabel(effectiveOn, formatter)} /><Summary label={labels.change} value={modeTitle} /><Summary label={labels.weeklyHours} value={mode === 'ORGANIZATION_COST' || mode === 'SALARY' ? labels.notRecorded : `${weeklyHours} ${labels.hoursPerWeek}`} /></dl><ReviewSummary actionKey={actionKey} labels={labels} schedule={schedule} weeklyHours={weeklyHours} partTimeFactor={partTimeFactor} salary={salary} organization={organization} allocations={allocations} data={data} locale={locale} /><label className="grid gap-1.5 text-sm font-medium"><span>{labels.changeReason}</span><textarea className="form-field min-h-24" maxLength={500} onChange={(event) => setReason(event.target.value)} required value={reason} /></label></section>}
         {step === 'details' && (mode === 'SALARY' || mode === 'SCHEDULE_SALARY') && salary.salaryRoute === 'SALARY_BAND' && data.options.salaryBands.find((item) => item.id === salary.salaryBandId) && <SalaryBandPercentageControl band={(() => { const selectedBand = data.options.salaryBands.find((item) => item.id === salary.salaryBandId); return { minimum: selectedBand?.minimumAmount.toFixed(2) ?? '0.00', midpoint: selectedBand?.midpointAmount.toFixed(2) ?? '0.00', maximum: selectedBand?.maximumAmount === null || selectedBand === undefined ? null : selectedBand.maximumAmount.toFixed(2) } })()} labels={{ percentage: labels.salaryBandMidpoint ?? labels.salaryBand, percentageHelp: labels.rangePenetration ?? labels.salaryBand }} salaryAmount={salary.fulltimeAmount || String(data.options.salaryBands.find((item) => item.id === salary.salaryBandId)?.midpointAmount ?? 0)} onSalaryAmountChange={(value) => { updateSalary('fulltimeAmount', value); updateSalary('parttimeAmount', moneyInput(asNumber(value) * salaryFactor)) }} />}
         {error && <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
        {state === 'saved' && <p className="mt-5 rounded-xl border border-success/30 bg-success-surface p-3 text-sm text-success" role="status">{labels.changeSaved}</p>}
      </form>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-surface/95 px-5 py-4 backdrop-blur-sm sm:px-7"><button className="button-secondary inline-flex items-center gap-2" disabled={step === 'selection' || state === 'saving'} onClick={previous} type="button"><ChevronLeft aria-hidden="true" className="size-4" />{labels.previous}</button><div className="flex items-center gap-3"><button className="button-secondary" disabled={state === 'saving'} onClick={onClose} type="button">{labels.cancel}</button>{step !== 'review' ? <button className="button-primary inline-flex items-center gap-2" disabled={state === 'saving' || (step === 'selection' && !selectedContract)} onClick={next} type="button">{labels.next}<ChevronRight aria-hidden="true" className="size-4" /></button> : <button className="button-primary inline-flex items-center gap-2" disabled={state === 'saving' || state === 'saved' || !reason.trim()} type="submit">{state === 'saving' ? labels.saving : labels.confirm}<CircleCheck aria-hidden="true" className="size-4" /></button>}</div></footer>
    </section>
  </div>
}

function isDateInContract(date: string, contract: EmploymentOverviewChangeData['contracts'][number]): boolean {
  return Boolean(date && date >= contract.startsOn && (!contract.endsOn || date <= contract.endsOn))
}

function sumDays(days: DayValues): number { return dayKeys.reduce((sum, day) => sum + asNumber(days[day]), 0) }
function averageDay(weeks: DayValues[], day: DayKey): number { return weeks.reduce((sum, week) => sum + asNumber(week[day]), 0) / weeks.length }
function moneyInput(value: number): string { return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '' }
function salaryIsValid(salary: SalaryDraft): boolean {
  if (salary.salaryRoute === 'MINIMUM_WAGE') return Boolean(salary.minimumWageScheme)
  if (salary.salaryRoute === 'SCALE_WITH_STEPS') return Boolean(salary.salaryStructureId && salary.salaryScaleId && salary.salaryStepCode)
  if (salary.salaryRoute === 'SALARY_BAND') return Boolean(salary.salaryStructureId && salary.salaryBandId && asNumber(salary.fulltimeAmount) > 0)
  return asNumber(salary.fulltimeAmount) > 0
}
function contractSummary(contract: EmploymentOverviewChangeData['contracts'][number], formatter: Intl.DateTimeFormat, labels: Labels): string {
  return `${labels.contractNumber} ${contract.sequenceNumber} · ${contract.laborConditionName} · ${dateLabel(contract.startsOn, formatter)} — ${contract.endsOn ? dateLabel(contract.endsOn, formatter) : labels.active}`
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value || '—'}</dd></div>
}

function TimelinePreview({ actionKey, contract, data, labels, locale, formatter }: { actionKey: EmploymentOverviewActionKey; contract: EmploymentOverviewChangeData['contracts'][number]; data: EmploymentOverviewChangeData; labels: Labels; locale: string; formatter: Intl.DateTimeFormat }) {
  const items: Array<{ id: string; from: string; title: string; period: string; summary: string }> = []
  if (actionKey === 'hoursSchedule' || actionKey === 'hoursScheduleSalary') data.schedules.filter((row) => intersectsContract(row.validFrom, row.validUntil, contract)).forEach((row) => items.push({ id: `schedule-${row.id}`, from: row.validFrom, title: `${row.averageHours} ${labels.hoursPerWeek}`, period: `${dateLabel(row.validFrom, formatter)} — ${row.validUntil ? dateLabel(row.validUntil, formatter) : labels.active}`, summary: `${scheduleTypeLabel(row.scheduleType, labels)} · ${Math.round(row.partTimeFactor * 100)}%` }))
  if (actionKey === 'hoursScheduleSalary' || actionKey === 'salary') data.salaries.filter((row) => intersectsContract(row.validFrom, row.validUntil, contract)).forEach((row) => items.push({ id: `salary-${row.id}`, from: row.validFrom, title: moneyLabel(row.parttimeAmount ?? row.fulltimeAmount ?? row.hourlyRate, row.currencyCode, locale), period: `${dateLabel(row.validFrom, formatter)} — ${row.validUntil ? dateLabel(row.validUntil, formatter) : labels.active}`, summary: `${salaryBasisLabel(row.salaryBasis, labels)} · ${paymentFrequencyLabel(row.paymentFrequency, labels)}` }))
  if (actionKey === 'functionDepartmentCostCenter') data.organizations.filter((row) => intersectsContract(row.effectiveFrom, row.effectiveTo, contract)).forEach((row) => items.push({ id: `organization-${row.id}`, from: row.effectiveFrom, title: row.departmentName, period: `${dateLabel(row.effectiveFrom, formatter)} — ${row.effectiveTo ? dateLabel(row.effectiveTo, formatter) : labels.active}`, summary: row.jobName }))
  if (actionKey === 'functionDepartmentCostCenter') data.costAllocations.filter((row) => intersectsContract(row.validFrom, row.validUntil, contract)).forEach((row) => items.push({ id: `cost-${row.id}`, from: row.validFrom, title: row.costCenterName, period: `${dateLabel(row.validFrom, formatter)} — ${row.validUntil ? dateLabel(row.validUntil, formatter) : labels.active}`, summary: `${row.percentage}% · ${row.costCarrierName}` }))
  items.sort((left, right) => right.from.localeCompare(left.from))
  return <section className="rounded-2xl border bg-muted/20 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"><Clock3 aria-hidden="true" className="size-4" /></span><div><h4 className="font-semibold">{labels.timelineBeforeChange}</h4><p className="text-xs text-muted-foreground">{labels.selectedContractStatement}</p></div></div>{items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.notRecorded}</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map((item, index) => <article className="rounded-xl border bg-surface p-3" key={item.id}><p className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{index === 0 ? labels.currentValue : labels.historyLabel}</p><p className="mt-1 font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.period}</p><p className="mt-2 text-sm text-muted-foreground">{item.summary}</p></article>)}</div>}</section>
}

function ScheduleEditor({ labels, dayLabels, schedule, weeklyHours, fulltimeHours, partTimeFactor, scheduleAverageDays, rosterMatches, onWeeklyHours, onToggleTwoWeeks, onTimeForTime, onDayChange }: { labels: Labels; dayLabels: string[]; schedule: { weeklyHours: string; days: DayValues; secondWeekDays: DayValues; twoWeekRoster: boolean; timeForTime: string }; weeklyHours: number; fulltimeHours: number; partTimeFactor: number; scheduleAverageDays: number; rosterMatches: boolean; onWeeklyHours: (value: string) => void; onToggleTwoWeeks: () => void; onTimeForTime: (value: string) => void; onDayChange: (week: 1 | 2, day: DayKey, value: string) => void }) {
  const scope = Math.abs(weeklyHours - fulltimeHours) < 0.0001 ? labels.fullTime : labels.partTime
  return <section className="rounded-2xl border p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Clock3 aria-hidden="true" className="size-5" /></span><div><p className="eyebrow text-primary">{labels.roster}</p><h4 className="mt-1 text-lg font-semibold">{labels.stepSchedule}</h4></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label={labels.employmentScope}><div className="form-field flex items-center bg-muted/40" aria-live="polite">{scope}</div></Field><Field label={labels.weeklyHours}><input className="form-field" inputMode="decimal" max="50" min="0" onChange={(event) => onWeeklyHours(event.target.value)} step="0.01" type="number" value={schedule.weeklyHours} /><span className="text-xs font-normal text-muted-foreground">{labels.fulltimeReference}: {fulltimeHours} {labels.hoursPerWeek}</span></Field><Field label={labels.partTimeFactor}><div className="form-field flex items-center bg-muted/40">{Math.round(partTimeFactor * 10000) / 100}%</div></Field><Field label={labels.averageDays}><div className="form-field flex items-center bg-muted/40">{Math.round(scheduleAverageDays * 100) / 100}</div></Field></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h5 className="font-semibold">{labels.roster}</h5><button className="button-secondary" onClick={onToggleTwoWeeks} type="button">{schedule.twoWeekRoster ? labels.removeSecondWeek : labels.addSecondWeek}</button></div><RosterWeek title={labels.weekOne} week={1} days={schedule.days} dayLabels={dayLabels} onDayChange={onDayChange} />{schedule.twoWeekRoster && <RosterWeek title={labels.weekTwo} week={2} days={schedule.secondWeekDays} dayLabels={dayLabels} onDayChange={onDayChange} />}<div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label={labels.timeForTime}><input className="form-field" min="0" onChange={(event) => onTimeForTime(event.target.value)} step="0.01" type="number" value={schedule.timeForTime} /></Field><div className={`self-end rounded-xl border p-3 text-sm ${rosterMatches ? 'border-success/30 bg-success-surface text-success' : 'border-destructive/30 bg-destructive/5 text-destructive'}`} role="status">{labels.rosterAverage}: {scheduleAverageHours(schedule)} {labels.hoursPerWeek}{!rosterMatches ? ` · ${labels.rosterMismatch}` : ''}</div></div></section>
}

function scheduleAverageHours(schedule: { days: DayValues; secondWeekDays: DayValues; twoWeekRoster: boolean }): number { return Math.round((sumDays(schedule.days) + (schedule.twoWeekRoster ? sumDays(schedule.secondWeekDays) : 0)) / (schedule.twoWeekRoster ? 2 : 1) * 100) / 100 }

function RosterWeek({ title, week, days, dayLabels, onDayChange }: { title: string; week: 1 | 2; days: DayValues; dayLabels: string[]; onDayChange: (week: 1 | 2, day: DayKey, value: string) => void }) {
  return <fieldset className="mt-4"><legend className="text-sm font-semibold">{title}</legend><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{dayKeys.map((day, index) => <label className="grid gap-1.5 text-xs font-semibold" key={day}><span>{dayLabels[index]}</span><input className="form-field px-2" inputMode="decimal" max="24" min="0" onChange={(event) => onDayChange(week, day, event.target.value)} step="0.01" type="number" value={days[day]} /></label>)}</div></fieldset>
}

function SalaryEditor({ locale, labels, salary, salaryFactor, options, onChange }: { locale: string; labels: Labels; salary: SalaryDraft; salaryFactor: number; options: EmploymentOverviewChangeData['options']; onChange: <K extends keyof SalaryDraft>(key: K, value: SalaryDraft[K]) => void }) {
  const selectedBand = options.salaryBands.find((item) => item.id === salary.salaryBandId)
  const selectedScale = options.salaryScaleSteps.find((item) => item.id === salary.salaryScaleStepId)
  const availableRoutes = options.salaryRoutes
  return <section className="rounded-2xl border p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><CalendarDays aria-hidden="true" className="size-5" /></span><div><p className="eyebrow text-primary">{labels.salary}</p><h4 className="mt-1 text-lg font-semibold">{labels.stepSalary}</h4></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={labels.salaryCalculation}><DropdownSelect searchable searchPlaceholder={labels.salaryCalculation} value={salary.salaryRoute} onChange={(event) => onChange('salaryRoute', event.target.value as SalaryDraft['salaryRoute'])}><option value="MANUAL">{labels.salaryManual}</option>{availableRoutes.includes('MINIMUM_WAGE') && <option value="MINIMUM_WAGE">{labels.salaryMinimum}</option>}{availableRoutes.includes('SCALE_WITH_STEPS') && <option value="SCALE_WITH_STEPS">{labels.salaryTable}</option>}{availableRoutes.includes('SALARY_BAND') && <option value="SALARY_BAND">{labels.salaryBand}</option>}</DropdownSelect></Field><Field label={labels.paymentFrequency}><DropdownSelect value={salary.paymentFrequency} onChange={(event) => onChange('paymentFrequency', event.target.value as SalaryDraft['paymentFrequency'])}><option value="MONTHLY">{labels.monthly}</option><option value="FOUR_WEEKLY">{labels.fourWeekly}</option></DropdownSelect></Field>{salary.salaryRoute === 'MINIMUM_WAGE' && <><Field label={labels.salaryApplicationScheme ?? labels.salaryMinimum}><DropdownSelect value={salary.minimumWageScheme} onChange={(event) => onChange('minimumWageScheme', event.target.value as SalaryDraft['minimumWageScheme'])}><option value="REGULAR">{labels.salaryRegular ?? 'REGULAR'}</option><option value="BBL">{labels.salaryBbl ?? 'BBL'}</option></DropdownSelect></Field><p className="self-end text-sm text-muted-foreground">{labels.salaryApplicationExternalAmount ?? labels.notRecorded}</p></>}{salary.salaryRoute === 'SCALE_WITH_STEPS' && <><Field label={labels.salaryScale}><DropdownSelect searchable searchPlaceholder={labels.salaryScale} emptyLabel={labels.notRecorded} value={salary.salaryScaleId} onChange={(event) => onChange('salaryScaleId', event.target.value)}>{options.salaryScales.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.salaryScaleStep}><DropdownSelect searchable searchPlaceholder={labels.salaryScaleStep} emptyLabel={labels.notRecorded} value={salary.salaryScaleStepId} onChange={(event) => onChange('salaryScaleStepId', event.target.value)}>{options.salaryScaleSteps.filter((item) => item.salaryScaleId === salary.salaryScaleId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</DropdownSelect></Field><Field label={labels.salaryScaleAmount}><input className="form-field bg-muted/40" readOnly value={selectedScale ? `€ ${selectedScale.fulltimeAmount.toFixed(2)}` : '—'} /></Field></>}{salary.salaryRoute === 'SALARY_BAND' && <Field label={labels.salaryBand}><DropdownSelect searchable searchPlaceholder={labels.salaryBand} emptyLabel={labels.notRecorded} value={salary.salaryBandId} onChange={(event) => onChange('salaryBandId', event.target.value)}>{options.salaryBands.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field>}{(salary.salaryRoute === 'MANUAL' || salary.salaryRoute === 'SALARY_BAND') && <><Field label={labels.fulltimeSalary}><input className="form-field" min="0" onChange={(event) => onChange('fulltimeAmount', event.target.value)} step="0.01" type="number" value={salary.fulltimeAmount} /></Field><Field label={labels.parttimeSalary}><input className="form-field" min="0" onChange={(event) => onChange('parttimeAmount', event.target.value)} step="0.01" type="number" value={salary.parttimeAmount} /><span className="text-xs font-normal text-muted-foreground">{labels.partTimeFactor}: {Math.round(salaryFactor * 10000) / 100}%</span></Field></>}{salary.salaryRoute === 'SALARY_BAND' && selectedBand && <div className="sm:col-span-2"><SalaryBandPositionCard salaryAmount={salary.fulltimeAmount || String(selectedBand.midpointAmount)} band={{ minimum: selectedBand.minimumAmount.toFixed(2), midpoint: selectedBand.midpointAmount.toFixed(2), maximum: selectedBand.maximumAmount === null ? null : selectedBand.maximumAmount.toFixed(2) }} locale={locale} currencyCode="EUR" labels={{ preview: labels.salaryBand, currentSalary: labels.fulltimeSalary, minimum: labels.salaryBandMinimum ?? labels.salaryBand, midpoint: labels.salaryBandMidpoint ?? labels.salaryBand, maximum: labels.salaryBandMaximum ?? labels.salaryBand, compaRatio: labels.compaRatio ?? labels.salaryBand, rangePenetration: labels.rangePenetration ?? labels.salaryBand, status: labels.status ?? labels.salaryBand, underMinimum: labels.underMinimum ?? labels.salaryBand, withinRange: labels.withinRange ?? labels.salaryBand, aboveMaximum: labels.aboveMaximum ?? labels.salaryBand, noValidBand: labels.noValidBand ?? labels.salaryBand, openEnded: labels.salaryOpenEnded ?? '—' }} /></div>}</div></section>
}

function OrganizationCostEditor({ labels, organization, allocations, options, allocationTotal, onOrganizationChange, onAllocationChange, onAddAllocation, onRemoveAllocation }: { labels: Labels; organization: { departmentId: string; jobId: string }; allocations: AllocationDraft[]; options: EmploymentOverviewChangeData['options']; allocationTotal: number; onOrganizationChange: (key: 'departmentId' | 'jobId', value: string) => void; onAllocationChange: (index: number, key: 'costCenterId' | 'costCarrierId' | 'percentage', value: string) => void; onAddAllocation: () => void; onRemoveAllocation: (index: number) => void }) {
  return <section className="rounded-2xl border p-4 sm:p-5"><div><p className="eyebrow text-primary">{labels.organizationPlacement}</p><h4 className="mt-1 text-lg font-semibold">{labels.changeFunctionDepartmentCostCenter}</h4></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={labels.department}><DropdownSelect searchable searchPlaceholder={labels.department} emptyLabel={labels.notRecorded} value={organization.departmentId} onChange={(event) => onOrganizationChange('departmentId', event.target.value)}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.job}><DropdownSelect searchable searchPlaceholder={labels.job} emptyLabel={labels.notRecorded} value={organization.jobId} onChange={(event) => onOrganizationChange('jobId', event.target.value)}>{options.jobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h5 className="font-semibold">{labels.costCenter}</h5><button className="button-secondary" onClick={onAddAllocation} type="button">{labels.addAllocation}</button></div><div className="mt-3 space-y-3">{allocations.map((allocation, index) => <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]" key={`${index}-${allocation.costCenterId}`}><Field label={labels.costCenter}><DropdownSelect searchable searchPlaceholder={labels.costCenter} emptyLabel={labels.notRecorded} value={allocation.costCenterId} onChange={(event) => onAllocationChange(index, 'costCenterId', event.target.value)}>{options.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.costCarrier}><DropdownSelect searchable searchPlaceholder={labels.costCarrier} emptyLabel={labels.notRecorded} value={allocation.costCarrierId} onChange={(event) => onAllocationChange(index, 'costCarrierId', event.target.value)}>{options.costCarriers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field label={labels.allocationPercentage}><input className="form-field" min="0.01" max="100" onChange={(event) => onAllocationChange(index, 'percentage', event.target.value)} step="0.01" type="number" value={allocation.percentage} /></Field><button aria-label={labels.removeAllocation} className="button-secondary self-end p-2" disabled={allocations.length === 1} onClick={() => onRemoveAllocation(index)} type="button">{labels.removeAllocation}</button></div>)}</div><p className={`mt-3 text-sm ${Math.abs(allocationTotal - 100) < 0.001 ? 'text-success' : 'text-destructive'}`}>{labels.allocationTotal}: {allocationTotal.toFixed(2)}%{Math.abs(allocationTotal - 100) >= 0.001 ? ` · ${labels.allocationMismatch}` : ''}</p></section>
}

function ReviewSummary({ actionKey, labels, schedule, weeklyHours, partTimeFactor, salary, organization, allocations, data, locale }: { actionKey: EmploymentOverviewActionKey; labels: Labels; schedule: { days: DayValues; secondWeekDays: DayValues; twoWeekRoster: boolean }; weeklyHours: number; partTimeFactor: number; salary: SalaryDraft; organization: { departmentId: string; jobId: string }; allocations: AllocationDraft[]; data: EmploymentOverviewChangeData; locale: string }) {
  return <div className="grid gap-3 sm:grid-cols-2">{(actionKey === 'hoursSchedule' || actionKey === 'hoursScheduleSalary') && <><Summary label={labels.weeklyHours} value={`${weeklyHours} ${labels.hoursPerWeek}`} /><Summary label={labels.partTimeFactor} value={`${Math.round(partTimeFactor * 10000) / 100}%`} /><Summary label={labels.roster} value={`${scheduleAverageHours(schedule)} ${labels.hoursPerWeek}`} /></>}{(actionKey === 'hoursScheduleSalary' || actionKey === 'salary') && <><Summary label={labels.salaryCalculation} value={salaryBasisLabel(salary.salaryBasis, labels)} /><Summary label={labels.fulltimeSalary} value={salary.salaryBasis === 'MINIMUM_WAGE' ? `${salary.hourlyRate} ${labels.hourlyRate.toLowerCase()}` : moneyLabel(asNumber(salary.fulltimeAmount), 'EUR', locale)} /><Summary label={labels.parttimeSalary} value={salary.salaryBasis === 'MINIMUM_WAGE' ? labels.notRecorded : moneyLabel(asNumber(salary.parttimeAmount), 'EUR', locale)} /></>}{actionKey === 'functionDepartmentCostCenter' && <><Summary label={labels.department} value={data.options.departments.find((item) => item.id === organization.departmentId)?.name ?? labels.notRecorded} /><Summary label={labels.job} value={data.options.jobs.find((item) => item.id === organization.jobId)?.name ?? labels.notRecorded} /><Summary label={labels.costCenter} value={`${allocations.length} ${labels.costCenter.toLowerCase()}`} /><Summary label={labels.allocationTotal} value={`${allocations.reduce((sum, allocation) => sum + asNumber(allocation.percentage), 0).toFixed(2)}%`} /></>}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 content-start gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label> }

async function post(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error('REQUEST_FAILED')
}
