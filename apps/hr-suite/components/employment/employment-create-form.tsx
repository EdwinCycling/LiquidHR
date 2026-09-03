'use client'

import { useRouter } from 'next/navigation'
import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { CountryPicker } from '@/components/ui/country-picker'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { SalaryBandPercentageControl } from '@/components/salary/salary-band-percentage-control'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'
import { calculateCappedPartTimeFactor, deriveEmploymentWorkScope } from '@/lib/employment/fulltime-reference'
import { isNewEmployeeBirthDateValid } from '@/lib/employees/age-validation'
import { addCalendarMonths, addContractPeriodEnd, validateProbation } from '@/lib/employment/probation-rules'
import { parseDecimalInput } from '@/lib/employment/decimal-input'
import { parseRosterHoursInput } from '@/lib/employment/roster-hours'
import { resolveSalaryStructureIntersection } from '@/lib/salary-application/availability'
import { resolveEffectiveEmploymentSalary, type EmploymentSalaryBasis } from './employment-salary-resolution'
import { canSubmitEmploymentWizard, hasMissingEmploymentPrerequisites, isEmploymentWizardStepValid, type EmploymentWizardStep } from './employment-wizard-validation'

type EmploymentType = 'EMPLOYEE' | 'INTERN' | 'TEMPORARY_AGENCY' | 'FREELANCER' | 'VOLUNTEER' | 'NO_PAYROLL'
type WorkerType = 'EMPLOYEE' | 'STUDENT_INTERN' | 'TEMPORARY_AGENCY' | 'EXTERNAL_NO_PAYROLL'
type DurationType = 'INDEFINITE' | 'DEFINITE' | 'TEMPORARY_NO_END'
type SalaryBasis = EmploymentSalaryBasis
type StepKey = EmploymentWizardStep

export interface EmploymentCreateFormProps {
  employeeId: string
  options: EmploymentCreationOptions
  showNavigation?: boolean
  showPayrollChoice?: boolean
  onStepChange?: (step: number) => void
  onPayrollChoiceChange?: (include: boolean) => void
  onCancel?: () => void
  onSaving?: () => void
  onSaveFailed?: () => void
  onSaved?: (employmentId: string) => void
  employeeSummary?: EmploymentWizardEmployeeSummary
  copyPreviousData?: boolean
  canScrollDown?: boolean
  moreDataAvailable?: string
  labels: {
    title: string; submit: string; saved: string; failed: string; previous: string; next: string
    requiredFields: string; employmentNumber: string; primaryEmployment: string; yes: string; no: string; cancel: string
    required: string
    administration: string; administrationSearch: string; administrationDetails: string; administrationNumber: string; cocNumber: string; vatNumber: string; activeEmployees: string; archivedEmployees: string; availableCaos: string; availableCaosEmpty: string
    startDate: string; seniorityDate: string; country: string; ikvNumber: string
    prerequisitesTitle: string; nationality: string; bsn: string; birthDate: string; ageRangeInvalid: string; gender: string; employeeConflict: string
    savePrerequisites: string; prerequisiteSaved: string; bsnOptionalHelp: string
    countrySearch: string; countryNoResults: string
    genderMale: string; genderFemale: string; genderOther: string; genderUndisclosed: string
    stepAdministration: string; stepEmployment: string; stepPayrollChoice: string; stepContract: string; stepSchedule: string; stepSalary: string
    stepOther: string; stepReview: string; payrollChoiceTitle: string; payrollChoiceHelp: string; addPayrollDetails: string; skipPayrollDetails: string
    workerType: string; selectWorkerType: string; workerEmployee: string; workerStudentIntern: string; workerTemporaryAgency: string; workerFreelancer: string; workerVolunteer: string; workerNoPayroll: string
    flexPhase: string; laborConditions: string; duration: string; indefinite: string; definite: string
    endDate: string; probation: string; probationEnd: string; addFourWeeks: string; addOneMonth: string; addTwoMonths: string; addThreeMonths: string; addSixMonths: string; addTwelveMonths: string; temporaryWithoutEnd: string
    onCallEmployee: string; onCallObligation: string
    employmentScope: string; fullTime: string; partTime: string; weeklyHours: string; hoursPerWeek: string; fulltimeReference: string
    partTimeFactor: string; roster: string; rosterMismatch: string; monday: string; tuesday: string
    wednesday: string; thursday: string; friday: string; saturday: string; sunday: string
    weekOne: string; weekTwo: string; addSecondWeek: string; removeSecondWeek: string; rosterAverage: string
    contractShortWarning: string; startDatePastWarning: string; startDateFutureWarning: string; probationLongWarning: string; probationOutsideContract: string; probationNotAllowed: string; probationMaximumExceeded: string; probationCaoMaximum: string; firstContractStartDateHelp: string; contractStartDateMinimumHelp: string
    weeklyHoursInvalid: string; negativeHoursInvalid: string; rosterHoursFormat: string
    salaryCalculation: string; salaryManual: string; salaryMinimum: string; salaryTable: string; salaryBand: string
    minimumWageScheme: string; minimumWageRegular: string; minimumWageBbl: string; minimumWageExternalAmount: string
    salaryBandPercentage: string; salaryBandPercentageHelp: string
    frequency: string; frequencySingleHelp: string; frequencyNone: string; fulltimeSalary: string; parttimeSalary: string
    salaryScale: string; salaryScaleStep: string; salaryScaleAmount: string; minimumHourlyRate: string
    jobGroup: string; department: string; job: string; manager: string; managerDerived: string; noManager: string; noConfiguredManager: string; costCenter: string; costCarrier: string
    splitCostCenter: string; addAllocation: string; removeAllocation: string; allocationPercentage: string; allocationTotal: string; allocationMismatch: string
    completeSummary: string; reviewMissingFields: string; reviewEditStep: string; createHint: string; optionsLoading: string
    employeeSummaryTitle: string; employeeSummaryName: string; employeeSummaryBirthDate: string; employeeSummaryGender: string
    employmentNumberConflict: string
  }
}

export interface EmploymentWizardEmployeeSummary {
  name: string
  birthDate: string | null
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
}

export interface EmploymentReviewDetailValues {
  duration: string
  endsOn: string
  probation: string
  probationEnd: string
  laborCondition: string
  weeklyHours: string
  fulltimeReference: string
  employmentScope: string
  partTimeFactor: string
  roster: string
  weekOne: string
  weekTwo: string
  rosterAverage: string
  salaryBasis: string
  frequency: string
  fulltimeSalary: string
  parttimeSalary: string
  department: string
  job: string
  manager: string
  costCarrier: string
  costCenter: string
  allocation: string
}

export type EmploymentReviewDetailKey = keyof EmploymentReviewDetailValues

export interface EmploymentReviewDetailItem {
  label: EmploymentReviewDetailKey
  value: string
}

export function buildEmploymentReviewDetailItems(values: EmploymentReviewDetailValues): EmploymentReviewDetailItem[] {
  return [
    { label: 'duration', value: values.duration },
    { label: 'endsOn', value: values.endsOn },
    { label: 'probation', value: values.probation },
    { label: 'probationEnd', value: values.probationEnd },
    { label: 'laborCondition', value: values.laborCondition },
    { label: 'weeklyHours', value: values.weeklyHours },
    { label: 'fulltimeReference', value: values.fulltimeReference },
    { label: 'employmentScope', value: values.employmentScope },
    { label: 'partTimeFactor', value: values.partTimeFactor },
    { label: 'roster', value: values.roster },
    { label: 'weekOne', value: values.weekOne },
    { label: 'weekTwo', value: values.weekTwo },
    { label: 'rosterAverage', value: values.rosterAverage },
    { label: 'salaryBasis', value: values.salaryBasis },
    { label: 'frequency', value: values.frequency },
    { label: 'fulltimeSalary', value: values.fulltimeSalary },
    { label: 'parttimeSalary', value: values.parttimeSalary },
    { label: 'department', value: values.department },
    { label: 'job', value: values.job },
    { label: 'manager', value: values.manager },
    { label: 'costCarrier', value: values.costCarrier },
    { label: 'costCenter', value: values.costCenter },
    { label: 'allocation', value: values.allocation },
  ]
}

interface AllocationDraft { costCenterId: string; costCarrierId: string; percentage: string }

interface Draft {
  administrationId: string; nationality: string; bsn: string; birthDate: string; gender: string
  employmentNumber: string; employmentType: EmploymentType | ''; isPrimary: boolean; startsOn: string; seniorityDate: string
  countryCode: string; ikvNumber: string; flexPhaseId: string; laborConditionSetId: string; durationType: DurationType; endsOn: string
  probationApplies: boolean; probationEndsOn: string; isOnCall: boolean; onCallObligation: boolean
  workScope: 'FULL_TIME' | 'PART_TIME'; weeklyHours: string; partTimeFactor: string; days: Record<DayKey, string>; secondWeekDays: Record<DayKey, string>; twoWeekRoster: boolean
  salaryBasis: SalaryBasis; minimumWageScheme: 'REGULAR' | 'BBL'; salaryFrequencyId: string; fulltimeAmount: string; parttimeAmount: string; salaryScaleId: string; salaryScaleStepId: string; salaryBandId: string
  jobGroupId: string; departmentId: string; jobId: string; managerEmployeeId: string; allocations: AllocationDraft[]
}

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const dayKeys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
type EmploymentFieldLabels = Pick<EmploymentCreateFormProps['labels'], 'required'>
const employmentFieldLabelsContext = createContext<EmploymentFieldLabels | null>(null)
const REQUIRED_FIELDS_ERROR = 'REQUIRED_FIELDS'
const GENERIC_ERROR = 'GENERIC_ERROR'
const AGE_RANGE_ERROR = 'AGE_RANGE'

function addToDate(value: string, mode: 'FOUR_WEEKS' | 'ONE_MONTH' | 'TWO_MONTHS'): string {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (mode === 'FOUR_WEEKS') date.setUTCDate(date.getUTCDate() + 28)
  else return addContractPeriodEnd(value, mode === 'ONE_MONTH' ? 1 : 2)
  return date.toISOString().slice(0, 10)
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

function money(value: number | string | null | undefined): string {
  const amount = typeof value === 'number' ? value : parseDecimalInput(String(value ?? ''))
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}

function moneyInput(value: string): string {
  return value.trim() ? money(value) : ''
}

function toMonday(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  const isoWeekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - isoWeekday + 1)
  return date.toISOString().slice(0, 10)
}

function averageDayHours(weeks: Array<Record<DayKey, string>>): Record<DayKey, number> {
  return Object.fromEntries(dayKeys.map((day) => [day, weeks.reduce((sum, week) => sum + (parseRosterHoursInput(week[day]) || 0), 0) / weeks.length])) as Record<DayKey, number>
}

function formatRosterWeek(week: Record<DayKey, string>, labels: Pick<EmploymentCreateFormProps['labels'], DayKey>): string {
  return dayKeys.map((day) => `${labels[day]}: ${week[day] || '0'}`).join(' · ')
}

function patternEndTime(scheduledMinutes: number): string {
  const totalMinutes = 9 * 60 + scheduledMinutes
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}

function workPatternDays(weeks: Array<Record<DayKey, string>>): Array<{
  weekIndex: number; isoWeekday: number; isWorkingDay: boolean; startsAt: string | null; endsAt: string | null; breakMinutes: number; scheduledMinutes: number; note: null
}> {
  return weeks.flatMap((week, weekIndex) => dayKeys.map((day, dayIndex) => {
    const scheduledMinutes = Math.round((parseRosterHoursInput(week[day]) || 0) * 60)
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

function defaultDraft(options: EmploymentCreationOptions, copyPreviousData = false): Draft {
  const firstGroup = options.jobGroups[0]?.id ?? ''
  const firstJob = options.jobs.find((job) => job.jobGroupId === firstGroup) ?? options.jobs[0]
  const firstLaborConditionId = options.laborConditionSets[0]?.id ?? ''
  const firstStructureIds = new Set(resolveSalaryStructureIntersection(options.salaryStructureIds, options.laborConditionSalaryStructureIds[firstLaborConditionId]))
  const firstScale = options.salaryScales.find((scale) => firstStructureIds.has(scale.structureId))?.id ?? ''
  const firstBand = options.salaryBands.find((band) => firstStructureIds.has(band.structureId))
  const draft: Draft = {
    administrationId: options.selectedAdministrationId,
    nationality: normalizeNationalityCode(options.prerequisites.nationality), bsn: '', birthDate: options.prerequisites.birthDate ?? '', gender: options.prerequisites.gender ?? '',
    employmentNumber: options.nextEmploymentNumber, employmentType: '', isPrimary: !options.hasActivePrimaryEmployment,
    startsOn: options.defaultStartDate, seniorityDate: options.defaultStartDate, countryCode: options.defaultCountryCode, ikvNumber: options.nextIkvNumber > 0 ? String(options.nextIkvNumber) : '',
    flexPhaseId: options.flexPhases[0]?.id ?? '', laborConditionSetId: options.laborConditionSets[0]?.id ?? '', durationType: 'INDEFINITE', endsOn: '', probationApplies: false, probationEndsOn: '',
    isOnCall: false, onCallObligation: true, workScope: 'FULL_TIME', weeklyHours: String(options.laborConditionSets[0]?.standardHoursPerWeek ?? 40), partTimeFactor: '1',
    days: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' },
    secondWeekDays: { monday: '8', tuesday: '8', wednesday: '8', thursday: '8', friday: '8', saturday: '0', sunday: '0' }, twoWeekRoster: false,
    salaryBasis: 'MANUAL', minimumWageScheme: 'REGULAR', salaryFrequencyId: options.salaryFrequencies[0]?.id ?? '', fulltimeAmount: '', parttimeAmount: '', salaryScaleId: firstScale,
     salaryScaleStepId: options.salaryScaleSteps.find((step) => step.salaryScaleId === firstScale)?.id ?? '', salaryBandId: firstBand?.id ?? '', jobGroupId: firstGroup,
    departmentId: options.departments[0]?.id ?? '', jobId: firstJob?.id ?? '', managerEmployeeId: '',
    allocations: [{ costCenterId: options.costCenters[0]?.id ?? '', costCarrierId: options.costCarriers[0]?.id ?? '', percentage: '100' }],
  }
  const previous = copyPreviousData ? options.rehireDefaults : null
  draft.managerEmployeeId = options.departmentManagers[draft.departmentId]?.[0]?.id ?? ''
  if (!previous) return draft

  const supportedEmploymentType: EmploymentType = previous.employmentType === 'INTERN' || previous.employmentType === 'APPRENTICE'
    ? 'INTERN'
    : previous.employmentType === 'TEMPORARY_AGENCY' ? 'TEMPORARY_AGENCY'
      : previous.employmentType === 'FREELANCER' ? 'FREELANCER'
        : previous.employmentType === 'VOLUNTEER' ? 'VOLUNTEER'
          : previous.employmentType === 'NO_PAYROLL' ? 'NO_PAYROLL' : 'EMPLOYEE'
  draft.employmentType = supportedEmploymentType
  draft.countryCode = previous.countryCode || draft.countryCode
  if (previous.contract) {
    if (options.laborConditionSets.some((item) => item.id === previous.contract?.laborConditionSetId)) draft.laborConditionSetId = previous.contract.laborConditionSetId
    if (previous.contract.flexPhaseId && options.flexPhases.some((item) => item.id === previous.contract?.flexPhaseId)) draft.flexPhaseId = previous.contract.flexPhaseId
    draft.durationType = previous.contract.durationType
    draft.probationApplies = false
  }
  if (previous.schedule) {
    draft.isOnCall = previous.schedule.isOnCall
    draft.onCallObligation = previous.schedule.onCallObligation ?? true
    draft.workScope = previous.schedule.workScope ?? draft.workScope
    draft.weeklyHours = String(previous.schedule.weeklyHours)
    draft.partTimeFactor = String(previous.schedule.partTimeFactor)
    draft.days = Object.fromEntries(dayKeys.map((day) => [day, String(previous.schedule?.days[day] ?? 0)])) as Draft['days']
    draft.workScope = deriveEmploymentWorkScope(draft.weeklyHours ? parseDecimalInput(draft.weeklyHours) : 0, options.laborConditionSets.find((item) => item.id === draft.laborConditionSetId)?.standardHoursPerWeek ?? 40)
  }
  if (previous.salary && options.canWriteSalary) {
    const previousStructureIds = new Set(resolveSalaryStructureIntersection(options.salaryStructureIds, options.laborConditionSalaryStructureIds[draft.laborConditionSetId]))
    const previousScaleStepIds = new Set(options.salaryScaleSteps.filter((item) => options.salaryScales.some((scale) => scale.id === item.salaryScaleId && previousStructureIds.has(scale.structureId))).map((item) => item.id))
    const previousBandIds = new Set(options.salaryBands.filter((item) => previousStructureIds.has(item.structureId)).map((item) => item.id))
    const hasFrequency = options.salaryFrequencies.some((item) => item.id === previous.salary?.salaryFrequencyId)
    if (hasFrequency) draft.salaryFrequencyId = previous.salary.salaryFrequencyId
    draft.salaryBasis = previous.salary.salaryBasis === 'MINIMUM_WAGE' ? 'MINIMUM_WAGE' : previous.salary.salaryBasis === 'SALARY_BAND' && previous.salary.salaryBandId && previousBandIds.has(previous.salary.salaryBandId) ? 'SALARY_BAND' : previous.salary.salaryBasis === 'CUSTOM_SCALE' && previous.salary.salaryScaleStepId && previousScaleStepIds.has(previous.salary.salaryScaleStepId) ? 'CUSTOM_SCALE' : 'MANUAL'
    if (previous.salary.minimumWageScheme === 'BBL') draft.minimumWageScheme = 'BBL'
    draft.fulltimeAmount = previous.salary.fulltimeAmount == null ? '' : String(previous.salary.fulltimeAmount)
    draft.parttimeAmount = previous.salary.parttimeAmount == null ? '' : String(previous.salary.parttimeAmount)
    if (previous.salary.salaryScaleStepId && previousScaleStepIds.has(previous.salary.salaryScaleStepId)) draft.salaryScaleStepId = previous.salary.salaryScaleStepId
    if (previous.salary.salaryBandId && previousBandIds.has(previous.salary.salaryBandId)) draft.salaryBandId = previous.salary.salaryBandId
  }
  if (previous.organization) {
    if (options.departments.some((item) => item.id === previous.organization?.departmentId)) draft.departmentId = previous.organization.departmentId
    if (previous.organization.jobId) {
      const job = options.jobs.find((item) => item.id === previous.organization?.jobId)
      if (job) { draft.jobId = job.id; draft.jobGroupId = job.jobGroupId }
    }
    draft.managerEmployeeId = options.departmentManagers[draft.departmentId]?.[0]?.id ?? ''
  }
  const validAllocations = previous.allocations.filter((allocation) => options.costCenters.some((item) => item.id === allocation.costCenterId) && options.costCarriers.some((item) => item.id === allocation.costCarrierId))
  if (validAllocations.length > 0) draft.allocations = validAllocations.map((allocation) => ({ ...allocation, percentage: String(allocation.percentage) }))
  return draft
}

function salaryOptionsForLaborCondition(options: EmploymentCreationOptions, laborConditionSetId: string): EmploymentCreationOptions {
  const structureIds = new Set(resolveSalaryStructureIntersection(options.salaryStructureIds, options.laborConditionSalaryStructureIds[laborConditionSetId]))
  const salaryScales = options.salaryScales.filter((scale) => structureIds.has(scale.structureId))
  const salaryScaleIds = new Set(salaryScales.map((scale) => scale.id))
  return {
    ...options,
    salaryScales,
    salaryScaleSteps: options.salaryScaleSteps.filter((step) => salaryScaleIds.has(step.salaryScaleId)),
    salaryBands: options.salaryBands.filter((band) => structureIds.has(band.structureId)),
  }
}

type EmploymentPrerequisiteValues = {
  nationality: string | null | undefined
  birthDate: string | null | undefined
  gender: string | null | undefined
}

function sameEmploymentPrerequisites(left: EmploymentPrerequisiteValues, right: EmploymentPrerequisiteValues): boolean {
  return (left.nationality?.trim() || null) === (right.nationality?.trim() || null)
    && (left.birthDate?.trim() || null) === (right.birthDate?.trim() || null)
    && (left.gender?.trim() || null) === (right.gender?.trim() || null)
}

export function EmploymentCreateForm({ employeeId, options: initialOptions, showNavigation = true, showPayrollChoice = false, onStepChange, onPayrollChoiceChange, onCancel, onSaving, onSaveFailed, onSaved, employeeSummary, copyPreviousData = false, canScrollDown = false, moreDataAvailable, labels }: EmploymentCreateFormProps) {
  const router = useRouter()
  const initialDraft = defaultDraft(initialOptions, copyPreviousData)
  const [options, setOptions] = useState(() => salaryOptionsForLaborCondition(initialOptions, initialDraft.laborConditionSetId))
  const missingPrerequisites = !options.prerequisites.nationality || !options.prerequisites.birthDate || !options.prerequisites.gender
    || !isNewEmployeeBirthDateValid(options.prerequisites.birthDate ?? '')
  const [prerequisitesComplete, setPrerequisitesComplete] = useState(!missingPrerequisites)
  const [bsnSaved, setBsnSaved] = useState(options.prerequisites.hasBsn)
  const [step, setStep] = useState(0)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [errorCode, setErrorCode] = useState('')
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [payrollDetails, setPayrollDetails] = useState<boolean | null>(showPayrollChoice ? null : true)
  const [draft, setDraft] = useState<Draft>(() => initialDraft)
  const prerequisitesSavingRef = useRef(false)
  const submitInFlightRef = useRef(false)

  const stepKeys: StepKey[] = showPayrollChoice
    ? payrollDetails === true ? ['administration', 'employment', 'payrollChoice', 'contract', 'schedule', 'salary', 'other', 'review'] : ['administration', 'employment', 'payrollChoice', 'review']
    : ['administration', 'employment', 'contract', 'schedule', 'salary', 'other', 'review']
  const stepLabels: Record<StepKey, string> = {
    administration: labels.stepAdministration, employment: labels.stepEmployment, payrollChoice: labels.stepPayrollChoice,
    contract: labels.stepContract, schedule: labels.stepSchedule, salary: labels.stepSalary, other: labels.stepOther, review: labels.stepReview,
  }
  const currentStep = stepKeys[step] ?? 'administration'
  const payrollChoicePending = currentStep === 'payrollChoice' && payrollDetails === null
  const selectedLaborSet = useMemo(() => options.laborConditionSets.find((item) => item.id === draft.laborConditionSetId), [draft.laborConditionSetId, options.laborConditionSets])
  const selectedFulltimeHours = selectedLaborSet?.standardHoursPerWeek ?? 40
  const filteredJobs = useMemo(() => options.jobs.filter((job) => !draft.jobGroupId || job.jobGroupId === draft.jobGroupId), [draft.jobGroupId, options.jobs])
  const selectedJob = options.jobs.find((item) => item.id === draft.jobId)
  const selectedScale = options.salaryScaleSteps.find((item) => item.id === draft.salaryScaleStepId)
  const selectedBand = options.salaryBands.find((item) => item.id === draft.salaryBandId)
  const effectivePartTimeFactor = draft.isOnCall ? 0 : calculateCappedPartTimeFactor(parseDecimalInput(draft.weeklyHours), selectedFulltimeHours)
  const effectiveSalary = resolveEffectiveEmploymentSalary({
    salaryBasis: draft.salaryBasis,
    manualFulltimeAmount: draft.fulltimeAmount,
    manualParttimeAmount: draft.parttimeAmount,
    selectedScaleAmount: selectedScale?.fulltimeAmount,
    partTimeFactor: effectivePartTimeFactor,
  })
  const departmentManagers = options.departmentManagers[draft.departmentId] ?? []
  const employeeAge = ageOn(draft.birthDate, draft.startsOn)
  const minimumRate = draft.minimumWageScheme === 'REGULAR'
    ? options.minimumWageRates.find((rate) => rate.minimumAge === Math.min(Math.max(employeeAge, 15), 21) && rate.validFrom <= draft.startsOn && (!rate.validUntil || rate.validUntil > draft.startsOn))
    : undefined
  const rosterWeeks = draft.twoWeekRoster ? [draft.days, draft.secondWeekDays] : [draft.days]
  const rosterWeekTotals = rosterWeeks.map((week) => dayKeys.reduce((sum, day) => sum + (parseRosterHoursInput(week[day]) || 0), 0))
  const rosterAverage = rosterWeekTotals.reduce((sum, total) => sum + total, 0) / rosterWeekTotals.length
  const rosterMatches = Math.abs(rosterAverage - parseDecimalInput(draft.weeklyHours)) < 0.0001
  const rosterHasNegativeHours = rosterWeeks.some((week) => dayKeys.some((day) => parseRosterHoursInput(week[day]) < 0))
  const rosterHasInvalidHours = rosterWeeks.some((week) => dayKeys.some((day) => week[day].trim() === '' || !Number.isFinite(parseRosterHoursInput(week[day])) || parseRosterHoursInput(week[day]) > 24))
  const contractTooShort = draft.durationType === 'DEFINITE' && Boolean(draft.endsOn) && draft.endsOn < addContractPeriodEnd(draft.startsOn, 1)
  const startDateIsTooFarInPast = Boolean(draft.startsOn) && draft.startsOn < addCalendarMonths(todayDateOnly(), -1)
  const startDateIsTooFarInFuture = Boolean(draft.startsOn) && draft.startsOn > addCalendarMonths(todayDateOnly(), 2)
  const caoAllowsTwoMonths = selectedLaborSet?.probationMaximumMonths === 2
  const probationValidationCode = validateProbation({ durationType: draft.durationType, startsOn: draft.startsOn, endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : null, probationApplies: draft.probationApplies, probationEndsOn: draft.probationEndsOn, caoAllowsTwoMonths })
  const probationTooLong = probationValidationCode === 'PROBATION_MAXIMUM_EXCEEDED'
  const probationNotAllowed = probationValidationCode === 'PROBATION_NOT_ALLOWED'
  const allocationTotal = draft.allocations.reduce((sum, allocation) => sum + (parseDecimalInput(allocation.percentage) || 0), 0)
  const allocationsMatch = Math.abs(allocationTotal - 100) < 0.0001

  useEffect(() => { onStepChange?.(step) }, [onStepChange, step])

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (key === 'laborConditionSetId') {
        const laborSet = options.laborConditionSets.find((item) => item.id === String(value))
        const standardHours = laborSet?.standardHoursPerWeek ?? 40
        next.partTimeFactor = String(calculateCappedPartTimeFactor(parseDecimalInput(current.weeklyHours), standardHours))
        next.workScope = deriveEmploymentWorkScope(parseDecimalInput(current.weeklyHours), standardHours)
        const structureIds = new Set(resolveSalaryStructureIntersection(options.salaryStructureIds, options.laborConditionSalaryStructureIds[String(value)]))
        const firstScaleForCondition = options.salaryScales.find((scale) => structureIds.has(scale.structureId))
        const firstBandForCondition = options.salaryBands.find((band) => structureIds.has(band.structureId))
        next.salaryScaleId = firstScaleForCondition?.id ?? ''
        next.salaryScaleStepId = options.salaryScaleSteps.find((step) => step.salaryScaleId === firstScaleForCondition?.id)?.id ?? ''
        next.salaryBandId = firstBandForCondition?.id ?? ''
      }
      if (key === 'jobGroupId') {
        next.jobId = options.jobs.find((job) => job.jobGroupId === String(value))?.id ?? ''
      }
      if (key === 'salaryScaleId') {
        next.salaryScaleStepId = options.salaryScaleSteps.find((item) => item.salaryScaleId === String(value))?.id ?? ''
      }
      if (key === 'departmentId') {
        next.managerEmployeeId = options.departmentManagers[String(value)]?.[0]?.id ?? ''
      }
      return next
    })
    if (key === 'laborConditionSetId') setOptions(() => salaryOptionsForLaborCondition(initialOptions, String(value)))
    setState('idle'); setErrorCode('')
  }

  function updateAllocation(index: number, key: keyof AllocationDraft, value: string): void {
    setDraft((current) => ({ ...current, allocations: current.allocations.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, [key]: value } : allocation) }))
    setState('idle')
  }

  function updateDay(day: DayKey, value: string): void {
    setDraft((current) => ({ ...current, days: { ...current.days, [day]: value } })); setState('idle')
  }

  function updateSecondWeekDay(day: DayKey, value: string): void {
    setDraft((current) => ({ ...current, secondWeekDays: { ...current.secondWeekDays, [day]: value } })); setState('idle')
  }

  function distributeHours(hours: string): void {
    const weekly = parseDecimalInput(hours) || 0
    const daily = weekly / 5
    setDraft((current) => ({ ...current, weeklyHours: hours, workScope: deriveEmploymentWorkScope(weekly, selectedFulltimeHours), days: { monday: String(daily), tuesday: String(daily), wednesday: String(daily), thursday: String(daily), friday: String(daily), saturday: '0', sunday: '0' }, partTimeFactor: String(calculateCappedPartTimeFactor(weekly, selectedFulltimeHours)) }))
  }

  async function changeAdministration(administrationId: string): Promise<void> {
    update('administrationId', administrationId)
    if (!administrationId) {
      setErrorCode(REQUIRED_FIELDS_ERROR)
      setState('failed')
      return
    }
    setOptionsLoading(true)
    const response = await fetch(`/api/employees/${employeeId}/employment-options?administrationId=${encodeURIComponent(administrationId)}`, { cache: 'no-store' })
    const result = await response.json() as { data?: EmploymentCreationOptions }
    if (!response.ok || !result.data) { setErrorCode(GENERIC_ERROR); setState('failed'); setOptionsLoading(false); return }
    const nextOptions = result.data
    setOptions(nextOptions)
    setDraft((current) => {
      const next = defaultDraft(nextOptions, copyPreviousData)
      return { ...next, employmentNumber: current.employmentNumber, employmentType: current.employmentType, isPrimary: current.isPrimary, startsOn: current.startsOn, seniorityDate: current.seniorityDate, bsn: current.bsn, nationality: current.nationality, birthDate: current.birthDate, gender: current.gender }
    })
    setOptionsLoading(false); setState('idle')
  }

  async function savePrerequisites(): Promise<void> {
    if (prerequisitesSavingRef.current) return
    prerequisitesSavingRef.current = true
    try {
      if (hasMissingEmploymentPrerequisites(draft)) {
        setErrorCode(REQUIRED_FIELDS_ERROR)
        setState('failed')
        return
      }
      if (!isNewEmployeeBirthDateValid(draft.birthDate)) {
        setErrorCode(AGE_RANGE_ERROR)
        setState('failed')
        return
      }
      setState('saving')
      const updatePrerequisites = async (updatedAt: string): Promise<{ response: Response; result: { data?: { updatedAt?: string }; error?: string } }> => {
        const response = await fetch(`/api/employees/${employeeId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updatedAt, nationality: draft.nationality, birthDate: draft.birthDate, gender: draft.gender }) })
        const result = await response.json().catch(() => ({ error: '' })) as { data?: { updatedAt?: string }; error?: string }
        return { response, result }
      }
      let update = await updatePrerequisites(options.prerequisites.updatedAt)
      let prerequisitesAlreadySaved = false
      if (update.response.status === 409) {
        const refreshResponse = await fetch(`/api/employees/${employeeId}/employment-options?administrationId=${encodeURIComponent(draft.administrationId)}`, { cache: 'no-store' })
        const refreshPayload = await refreshResponse.json().catch(() => ({})) as { data?: EmploymentCreationOptions }
        const refreshedOptions = refreshPayload.data
        if (refreshResponse.ok && refreshedOptions) {
          setOptions(refreshedOptions)
          const desiredPrerequisites = { nationality: draft.nationality, birthDate: draft.birthDate, gender: draft.gender }
          if (sameEmploymentPrerequisites(refreshedOptions.prerequisites, desiredPrerequisites)) {
            prerequisitesAlreadySaved = true
          }
          if (!prerequisitesAlreadySaved && sameEmploymentPrerequisites(refreshedOptions.prerequisites, options.prerequisites)) {
            update = await updatePrerequisites(refreshedOptions.prerequisites.updatedAt)
          }
        }
      }
      const employeeResponse = update.response
      const employeeResult = update.result
      if (!prerequisitesAlreadySaved && (!employeeResponse.ok || !employeeResult.data?.updatedAt)) {
        setErrorCode(employeeResponse.status === 409 ? 'EMPLOYEE_CONCURRENCY_CONFLICT' : employeeResponse.status === 400 ? REQUIRED_FIELDS_ERROR : employeeResult.error ?? GENERIC_ERROR)
        setState('failed')
        return
      }
      if (!prerequisitesAlreadySaved) {
        setOptions((current) => ({ ...current, prerequisites: { ...current.prerequisites, updatedAt: employeeResult.data?.updatedAt ?? current.prerequisites.updatedAt } }))
      }
      if (draft.countryCode === 'NL' && !bsnSaved && draft.bsn) {
        const bsnResponse = await fetch(`/api/employees/${employeeId}/bsn`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bsn: draft.bsn }) })
        if (!bsnResponse.ok) { const result = await bsnResponse.json().catch(() => ({ error: '' })) as { error?: string }; setErrorCode(bsnResponse.status === 400 ? REQUIRED_FIELDS_ERROR : result.error ?? GENERIC_ERROR); setState('failed'); return }
        setBsnSaved(true)
      }
      setPrerequisitesComplete(true); setState('idle')
    } finally {
      prerequisitesSavingRef.current = false
    }
  }

  function setPayrollChoice(include: boolean): void {
    setPayrollDetails(include); onPayrollChoiceChange?.(include); setState('idle'); setErrorCode('')
    setStep((current) => {
      const destination = stepKeys.indexOf(include ? 'payrollChoice' : 'review')
      return destination >= 0 ? destination : current
    })
  }

  function valid(key: StepKey): boolean {
    return isEmploymentWizardStepValid(key, { ...draft, caoAllowsTwoMonths }, {
      optionsLoading, payrollDetails, canWriteSalary: options.canWriteSalary, minimumRateAvailable: true, rosterMatches, allocationsMatch,
    })
  }

  const invalidStepKeys = stepKeys.filter((key) => key !== 'review' && !valid(key))
  const reviewDetailItems = buildEmploymentReviewDetailItems({
    duration: draft.durationType === 'DEFINITE' ? labels.definite : draft.durationType === 'TEMPORARY_NO_END' ? labels.temporaryWithoutEnd : labels.indefinite,
    endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : '',
    probation: draft.probationApplies ? labels.yes : labels.no,
    probationEnd: draft.probationApplies ? draft.probationEndsOn : '',
    laborCondition: selectedLaborSet?.name ?? '',
    weeklyHours: draft.weeklyHours,
    fulltimeReference: `${selectedFulltimeHours} ${labels.hoursPerWeek}`,
    employmentScope: draft.isOnCall ? labels.yes : deriveEmploymentWorkScope(parseDecimalInput(draft.weeklyHours), selectedFulltimeHours) === 'FULL_TIME' ? labels.fullTime : labels.partTime,
    partTimeFactor: `${Math.round(parseDecimalInput(draft.partTimeFactor) * 10000) / 100}%`,
    roster: draft.twoWeekRoster ? `${labels.weekOne} + ${labels.weekTwo}` : labels.weekOne,
    weekOne: formatRosterWeek(draft.days, labels),
    weekTwo: draft.twoWeekRoster ? formatRosterWeek(draft.secondWeekDays, labels) : '',
    rosterAverage: `${rosterAverage.toFixed(2)} ${labels.hoursPerWeek}`,
    salaryBasis: draft.salaryBasis === 'MANUAL' ? labels.salaryManual : draft.salaryBasis === 'MINIMUM_WAGE' ? labels.salaryMinimum : draft.salaryBasis === 'CUSTOM_SCALE' ? labels.salaryTable : labels.salaryBand,
    frequency: options.salaryFrequencies.find((item) => item.id === draft.salaryFrequencyId)?.name ?? '',
    fulltimeSalary: draft.salaryBasis === 'MINIMUM_WAGE' ? (minimumRate ? `€ ${money(minimumRate.hourlyAmount)}` : '') : effectiveSalary.fulltimeAmount !== null ? `€ ${money(effectiveSalary.fulltimeAmount)}` : '',
    parttimeSalary: draft.salaryBasis === 'MINIMUM_WAGE' || parseDecimalInput(draft.weeklyHours) === selectedFulltimeHours ? '' : effectiveSalary.parttimeAmount !== null ? `€ ${money(effectiveSalary.parttimeAmount)}` : '',
    department: options.departments.find((item) => item.id === draft.departmentId)?.name ?? '',
    job: selectedJob?.name ?? '',
    manager: departmentManagers.map((item) => `${item.employeeNumber} · ${item.name}`).join(', '),
    costCarrier: options.costCarriers.find((item) => item.id === draft.allocations[0]?.costCarrierId)?.name ?? '',
    costCenter: draft.allocations.map((allocation) => {
      const costCenter = options.costCenters.find((item) => item.id === allocation.costCenterId)
      return `${costCenter?.name ?? ''} (${allocation.percentage}%)`
    }).join(', '),
    allocation: `${allocationTotal.toFixed(2)}%`,
  })

  function next(): void {
    if (payrollChoicePending) return
    if (!valid(currentStep)) { setErrorCode(REQUIRED_FIELDS_ERROR); setState('failed'); return }
    setStep((current) => Math.min(current + 1, stepKeys.length - 1)); setState('idle')
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSubmitEmploymentWizard(currentStep)) {
      next()
      return
    }
    if (submitInFlightRef.current) return
    submitInFlightRef.current = true
    try {
      const firstInvalidStepIndex = stepKeys.findIndex((key) => key !== 'review' && !valid(key))
      if (firstInvalidStepIndex >= 0) {
        setStep(firstInvalidStepIndex)
        setErrorCode('')
        setState('idle')
        return
      }
      const employmentType = draft.employmentType
      if (!employmentType) {
        setStep(stepKeys.indexOf('employment'))
        setErrorCode(REQUIRED_FIELDS_ERROR)
        setState('failed')
        return
      }
      setState('saving')
      onSaving?.()
      if (draft.countryCode === 'NL' && !bsnSaved && draft.bsn) {
        const bsnResponse = await fetch(`/api/employees/${employeeId}/bsn`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bsn: draft.bsn }) })
        if (!bsnResponse.ok) { const result = await bsnResponse.json().catch(() => ({ error: '' })) as { error?: string }; setErrorCode(bsnResponse.status === 400 ? REQUIRED_FIELDS_ERROR : result.error ?? GENERIC_ERROR); onSaveFailed?.(); setState('failed'); return }
        setBsnSaved(true)
      }
      const fulltimeAmount = effectiveSalary.fulltimeAmount ?? 0
      const standardHours = selectedFulltimeHours
      const factor = effectivePartTimeFactor
      const workScope = draft.isOnCall ? null : deriveEmploymentWorkScope(parseDecimalInput(draft.weeklyHours), standardHours)
      const scheduleWeeks = draft.twoWeekRoster ? [draft.days, draft.secondWeekDays] : [draft.days]
      const scheduleDayHours = averageDayHours(scheduleWeeks)
      const payload = payrollDetails ? {
        employment: { employmentNumber: draft.employmentNumber, employmentType, startsOn: draft.startsOn, seniorityDate: draft.seniorityDate, countryCode: draft.countryCode, isPrimary: draft.isPrimary },
        incomeRelationship: { payrollTaxSubnumber: '0001', ikvNumber: Number(draft.ikvNumber), validFrom: draft.startsOn },
        contract: { workerType: workerTypeForEmployment(employmentType), flexPhaseId: employmentType === 'TEMPORARY_AGENCY' ? draft.flexPhaseId : null, laborConditionSetId: draft.laborConditionSetId, durationType: draft.durationType, startsOn: draft.startsOn, endsOn: draft.durationType === 'DEFINITE' ? draft.endsOn : null, probationApplies: draft.probationApplies, probationEndsOn: draft.probationApplies ? draft.probationEndsOn : null, caoAllowsTwoMonths },
        schedule: { scheduleType: 'HOURS_PER_DAY', startWeek: 1, averageDaysPerWeek: scheduleWeeks.reduce((sum, week) => sum + dayKeys.filter((day) => parseRosterHoursInput(week[day]) > 0).length, 0) / scheduleWeeks.length, averageHoursPerWeek: parseDecimalInput(draft.weeklyHours), partTimeFactor: factor, timeForTimeAccrual: 0, mondayHours: scheduleDayHours.monday, tuesdayHours: scheduleDayHours.tuesday, wednesdayHours: scheduleDayHours.wednesday, thursdayHours: scheduleDayHours.thursday, fridayHours: scheduleDayHours.friday, saturdayHours: scheduleDayHours.saturday, sundayHours: scheduleDayHours.sunday, isOnCall: draft.isOnCall, onCallObligation: draft.isOnCall ? draft.onCallObligation : null, workScope, validFrom: draft.startsOn },
         salary: options.canWriteSalary ? { paymentType: draft.salaryBasis === 'MINIMUM_WAGE' ? 'HOURLY_VARIABLE' : 'PERIODIC_FIXED', paymentFrequency: options.salaryFrequencies.find((item) => item.id === draft.salaryFrequencyId)?.code ?? 'MONTHLY', salaryFrequencyId: draft.salaryFrequencyId, salaryBasis: draft.salaryBasis, salaryRoute: draft.salaryBasis === 'MINIMUM_WAGE' ? 'MINIMUM_WAGE' : draft.salaryBasis === 'CUSTOM_SCALE' ? 'SCALE_WITH_STEPS' : draft.salaryBasis === 'SALARY_BAND' ? 'SALARY_BAND' : 'MANUAL', minimumWageScheme: draft.salaryBasis === 'MINIMUM_WAGE' ? draft.minimumWageScheme : null, fulltimeAmount: draft.salaryBasis === 'MINIMUM_WAGE' ? null : fulltimeAmount, parttimeAmount: draft.salaryBasis === 'MINIMUM_WAGE' ? null : (effectiveSalary.parttimeAmount ?? fulltimeAmount * factor), hourlyRate: null, currencyCode: 'EUR', salaryStructureId: draft.salaryBasis === 'CUSTOM_SCALE' ? options.salaryScales.find((item) => item.id === draft.salaryScaleId)?.structureId ?? null : draft.salaryBasis === 'SALARY_BAND' ? options.salaryBands.find((item) => item.id === draft.salaryBandId)?.structureId ?? null : null, salaryScaleId: draft.salaryBasis === 'CUSTOM_SCALE' ? draft.salaryScaleId : null, salaryStepCode: draft.salaryBasis === 'CUSTOM_SCALE' ? selectedScale?.stepCode ?? null : null, salaryScaleStepId: draft.salaryBasis === 'CUSTOM_SCALE' ? draft.salaryScaleStepId : null, salaryBandId: draft.salaryBasis === 'SALARY_BAND' ? draft.salaryBandId : null, validFrom: draft.startsOn } : undefined,
        organization: { departmentId: draft.departmentId, jobId: draft.jobId, jobTitle: selectedJob?.name ?? '', managerEmployeeId: departmentManagers[0]?.id ?? null, effectiveFrom: draft.startsOn },
        costAllocation: { validFrom: draft.startsOn, allocations: draft.allocations.map((allocation) => ({ costCenterId: allocation.costCenterId, costCarrierId: draft.allocations[0]?.costCarrierId ?? allocation.costCarrierId, percentage: parseDecimalInput(allocation.percentage) })) },
      } : {
        employment: { employmentNumber: draft.employmentNumber, employmentType, startsOn: draft.startsOn, seniorityDate: draft.seniorityDate, countryCode: draft.countryCode, isPrimary: draft.isPrimary },
      }
      const response = await fetch(`/api/employees/${employeeId}/employments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ administrationId: draft.administrationId, input: payload }) })
      const result = await response.json().catch(() => ({})) as { data?: { employmentId: string }; code?: string }
      if (!response.ok || !result.data) { setErrorCode(result.code ?? (response.status === 400 ? REQUIRED_FIELDS_ERROR : GENERIC_ERROR)); onSaveFailed?.(); setState('failed'); return }
      if (draft.twoWeekRoster) {
        const workPatternResponse = await fetch(`/api/employments/${result.data.employmentId}/work-patterns`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: `${labels.roster} · ${labels.weekOne}/${labels.weekTwo}`,
            cycleWeeks: 2,
            anchorDate: toMonday(draft.startsOn),
            validFrom: draft.startsOn,
            validUntil: draft.durationType === 'DEFINITE' && draft.endsOn > draft.startsOn ? draft.endsOn : null,
            days: workPatternDays(scheduleWeeks),
          }),
        })
        if (!workPatternResponse.ok) {
          const workPatternResult = await workPatternResponse.json().catch(() => ({})) as { error?: string }
          setErrorCode(workPatternResult.error ?? 'WORK_PATTERN_OPERATION_FAILED')
          onSaveFailed?.()
          setState('failed')
          return
        }
      }
      setState('saved')
      if (onSaved) onSaved(result.data.employmentId)
      else { router.push(`/employees/${employeeId}/employments/${result.data.employmentId}`); router.refresh() }
    } catch {
      setErrorCode(GENERIC_ERROR)
      onSaveFailed?.()
      setState('failed')
    } finally {
      submitInFlightRef.current = false
    }
  }

  const inputClass = 'form-field'
  if (!prerequisitesComplete) return <employmentFieldLabelsContext.Provider value={labels}><section className="flex min-h-full flex-col rounded-2xl border bg-surface p-5 pb-3 shadow-sm"><h3 className="text-lg font-semibold">{labels.prerequisitesTitle}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field required label={labels.country}><CountryPicker value={draft.countryCode} onChange={(value) => update('countryCode', value)} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field><Field required label={labels.nationality}><CountryPicker value={draft.nationality} onChange={(value) => update('nationality', value)} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field><Field required label={labels.birthDate}><input type="date" className={inputClass} value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></Field><Field required label={labels.gender}><select className={inputClass} value={draft.gender} onChange={(event) => update('gender', event.target.value)}><option value="" /><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></select></Field>{draft.countryCode === 'NL' && !options.prerequisites.hasBsn && <Field label={labels.bsn}><input inputMode="numeric" className={inputClass} value={draft.bsn} onChange={(event) => update('bsn', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{labels.bsnOptionalHelp}</span></Field>}</div>{state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{errorCode === 'EMPLOYEE_CONCURRENCY_CONFLICT' ? labels.employeeConflict : errorCode === AGE_RANGE_ERROR ? labels.ageRangeInvalid : errorCode === REQUIRED_FIELDS_ERROR ? labels.requiredFields : labels.failed}</p>}<div className="sticky bottom-0 z-10 mt-8 flex items-center justify-between gap-3 border-t border-border/70 bg-surface/95 py-3 backdrop-blur-sm">{onCancel && <button type="button" className="button-secondary shrink-0" disabled={state === 'saving'} onClick={onCancel}>{labels.cancel}</button>}<button type="button" className="button-primary ml-auto" disabled={state === 'saving'} onClick={() => void savePrerequisites()}>{labels.savePrerequisites}</button></div></section></employmentFieldLabelsContext.Provider>

  return <employmentFieldLabelsContext.Provider value={labels}><form onSubmit={(event) => void submit(event)} className="flex min-h-full min-w-0 flex-col rounded-2xl border bg-surface p-5 shadow-sm">
    {showNavigation && <nav aria-label={labels.title}><ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{stepKeys.map((key, index) => <li key={key} className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${index === step ? 'border-primary bg-primary/10 text-primary' : index < step ? 'border-success/40 bg-success/10' : 'text-muted-foreground'}`}>{index + 1}. {stepLabels[key]}</li>)}</ol></nav>}
    {optionsLoading && <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{labels.optionsLoading}</p>}

    {currentStep === 'administration' && <WizardStep title={labels.stepAdministration}><Field required label={labels.administration}><DropdownSelect value={draft.administrationId} onChange={(event) => void changeAdministration(event.target.value)} searchable searchPlaceholder={labels.administrationSearch} emptyLabel={labels.frequencyNone}><option value="" />{options.administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name} · {administration.code}</option>)}</DropdownSelect></Field>{options.administrations.find((item) => item.id === draft.administrationId) && <details className="mt-5 rounded-xl border bg-muted/20 p-4"><summary className="cursor-pointer font-semibold">{labels.administrationDetails}</summary><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><Summary label={labels.administrationNumber} value={options.administrations.find((item) => item.id === draft.administrationId)?.administrationNumber ?? ''} /><Summary label={labels.cocNumber} value={options.administrations.find((item) => item.id === draft.administrationId)?.cocNumber ?? ''} /><Summary label={labels.vatNumber} value={options.administrations.find((item) => item.id === draft.administrationId)?.vatNumber ?? ''} /></dl><div className="mt-4 grid gap-3 border-t border-border/70 pt-4 text-sm sm:grid-cols-3"><Summary label={labels.activeEmployees} value={String(options.administrations.find((item) => item.id === draft.administrationId)?.activeEmployeeCount ?? 0)} /><Summary label={labels.archivedEmployees} value={String(options.administrations.find((item) => item.id === draft.administrationId)?.archivedEmployeeCount ?? 0)} /><div className="rounded-xl border bg-muted/20 p-3 sm:col-span-3"><p className="text-xs text-muted-foreground">{labels.availableCaos}</p><div className="mt-1 flex flex-wrap gap-2">{(options.administrations.find((item) => item.id === draft.administrationId)?.availableLaborConditions ?? []).length > 0 ? (options.administrations.find((item) => item.id === draft.administrationId)?.availableLaborConditions ?? []).map((condition) => <span key={condition.code} className="rounded-lg border bg-surface px-2.5 py-1 font-semibold">{condition.code} · {condition.name}</span>) : <span className="font-semibold">{labels.availableCaosEmpty}</span>}</div></div></div></details>}</WizardStep>}

    {currentStep === 'employment' && <WizardStep title={labels.stepEmployment}><div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.workerType}><DropdownSelect value={draft.employmentType} placeholder={labels.selectWorkerType} required onChange={(event) => update('employmentType', event.target.value === '' ? '' : event.target.value as EmploymentType)}><option value="" disabled>{labels.selectWorkerType}</option><option value="EMPLOYEE">{labels.workerEmployee}</option><option value="INTERN">{labels.workerStudentIntern}</option><option value="TEMPORARY_AGENCY">{labels.workerTemporaryAgency}</option><option value="FREELANCER">{labels.workerFreelancer}</option><option value="VOLUNTEER">{labels.workerVolunteer}</option><option value="NO_PAYROLL">{labels.workerNoPayroll}</option></DropdownSelect></Field><Field required label={labels.employmentNumber}><input autoFocus className={inputClass} value={draft.employmentNumber} onChange={(event) => update('employmentNumber', event.target.value)} /></Field><Field required label={labels.country}><CountryPicker value={draft.countryCode} onChange={(value) => update('countryCode', value)} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field><Field required label={labels.primaryEmployment}><select className={inputClass} value={String(draft.isPrimary)} onChange={(event) => update('isPrimary', event.target.value === 'true')}><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select></Field><Field label={labels.ikvNumber}><input type="number" min="1" max="99" className={inputClass} value={draft.ikvNumber} onChange={(event) => update('ikvNumber', event.target.value)} /></Field><Field required label={labels.startDate}><input type="date" className={inputClass} value={draft.startsOn} onChange={(event) => { update('startsOn', event.target.value); update('seniorityDate', event.target.value) }} /></Field><Field required label={labels.seniorityDate}><input type="date" className={inputClass} value={draft.seniorityDate} onChange={(event) => update('seniorityDate', event.target.value)} /></Field>{draft.countryCode === 'NL' && !bsnSaved && <Field label={labels.bsn}><input inputMode="numeric" className={inputClass} value={draft.bsn} onChange={(event) => update('bsn', event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{labels.bsnOptionalHelp}</span></Field>}</div></WizardStep>}

    {currentStep === 'payrollChoice' && <WizardStep title={labels.payrollChoiceTitle}><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{labels.payrollChoiceHelp}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" className={`rounded-2xl border p-5 text-left transition ${payrollDetails === true ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => setPayrollChoice(true)}><span className="font-semibold">{labels.addPayrollDetails}</span></button><button type="button" className={`rounded-2xl border p-5 text-left transition ${payrollDetails === false ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`} onClick={() => setPayrollChoice(false)}><span className="font-semibold">{labels.skipPayrollDetails}</span></button></div></WizardStep>}

    {currentStep === 'contract' && <WizardStep title={labels.stepContract}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field required label={labels.laborConditions}>
          <DropdownSelect value={draft.laborConditionSetId} onChange={(event) => update('laborConditionSetId', event.target.value)} searchable searchPlaceholder={labels.laborConditions} emptyLabel={labels.frequencyNone}>
            {options.laborConditionSets.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </DropdownSelect>
          <span className="text-xs font-normal text-muted-foreground">{labels.fulltimeReference}: {selectedFulltimeHours} {labels.hoursPerWeek}</span>
          {caoAllowsTwoMonths && <span className="text-xs font-normal text-muted-foreground">{labels.probationCaoMaximum}</span>}
        </Field>
        {draft.employmentType === 'TEMPORARY_AGENCY' && <Field required label={labels.flexPhase}><DropdownSelect value={draft.flexPhaseId} onChange={(event) => update('flexPhaseId', event.target.value)}>{options.flexPhases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect></Field>}
        <Field required label={labels.duration}><select className={inputClass} value={draft.durationType} onChange={(event) => { const durationType = event.target.value as DurationType; update('durationType', durationType); if (durationType !== 'DEFINITE') update('endsOn', '') }}>{/* Het tijdelijke contract zonder einddatum heeft bewust geen datumveld. */}<option value="INDEFINITE">{labels.indefinite}</option><option value="DEFINITE">{labels.definite}</option><option value="TEMPORARY_NO_END">{labels.temporaryWithoutEnd}</option></select></Field>
         <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
           <Field label={labels.startDate}><input type="date" readOnly className={`${inputClass} bg-muted/40`} value={draft.startsOn} /><span className="text-xs font-normal text-muted-foreground">{labels.firstContractStartDateHelp}</span></Field>
           {draft.durationType === 'DEFINITE' && <Field required label={labels.endDate}><input type="date" min={draft.startsOn} className={inputClass} value={draft.endsOn} onChange={(event) => update('endsOn', event.target.value)} /><span className="flex flex-wrap gap-2"><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 1))}>{labels.addOneMonth}</SmallButton><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 3))}>{labels.addThreeMonths}</SmallButton><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 6))}>{labels.addSixMonths}</SmallButton><SmallButton onClick={() => update('endsOn', addContractPeriodEnd(draft.startsOn, 12))}>{labels.addTwelveMonths}</SmallButton></span></Field>}
        </div>
        <Field required label={labels.probation}><select className={inputClass} value={String(draft.probationApplies)} onChange={(event) => { const applies = event.target.value === 'true'; update('probationApplies', applies); if (!applies) update('probationEndsOn', '') }}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></Field>
        {draft.probationApplies && <Field required label={labels.probationEnd}><input type="date" min={draft.startsOn} className={inputClass} value={draft.probationEndsOn} onChange={(event) => update('probationEndsOn', event.target.value)} /><span className="flex flex-wrap gap-2"><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'FOUR_WEEKS'))}>{labels.addFourWeeks}</SmallButton><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'ONE_MONTH'))}>{labels.addOneMonth}</SmallButton><SmallButton onClick={() => update('probationEndsOn', addToDate(draft.startsOn, 'TWO_MONTHS'))}>{labels.addTwoMonths}</SmallButton></span></Field>}
      </div>
      <div className="mt-4 space-y-2 text-sm" aria-live="polite">
        {startDateIsTooFarInPast && <p className="text-warning">{labels.startDatePastWarning}</p>}
        {startDateIsTooFarInFuture && <p className="text-warning">{labels.startDateFutureWarning}</p>}
        {contractTooShort && <p className="text-warning">{labels.contractShortWarning}</p>}
         {probationNotAllowed && <p role="status" className="text-warning">{labels.probationNotAllowed}</p>}
         {probationTooLong && <p role="status" className="text-warning">{labels.probationMaximumExceeded}</p>}
         {probationValidationCode === 'PROBATION_DATE_OUTSIDE_CONTRACT' && <p role="status" className="text-warning">{labels.probationOutsideContract}</p>}
      </div>
     </WizardStep>}

     {currentStep === 'salary' && draft.salaryBasis === 'MINIMUM_WAGE' && <section className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.minimumWageScheme}><select className={inputClass} value={draft.minimumWageScheme} onChange={(event) => update('minimumWageScheme', event.target.value as Draft['minimumWageScheme'])}><option value="REGULAR">{labels.minimumWageRegular}</option><option value="BBL">{labels.minimumWageBbl}</option></select></Field><p className="self-end text-sm text-muted-foreground">{labels.minimumWageExternalAmount}</p></div></section>}

     {currentStep === 'salary' && draft.salaryBasis === 'SALARY_BAND' && selectedBand && <SalaryBandPercentageControl band={{ minimum: selectedBand.minimumAmount.toFixed(2), midpoint: selectedBand.midpointAmount.toFixed(2), maximum: selectedBand.maximumAmount === null ? null : selectedBand.maximumAmount.toFixed(2) }} labels={{ percentage: labels.salaryBandPercentage, percentageHelp: labels.salaryBandPercentageHelp }} salaryAmount={draft.fulltimeAmount || String(selectedBand.midpointAmount)} onSalaryAmountChange={(value) => { update('fulltimeAmount', value); const factor = parseDecimalInput(draft.weeklyHours) / selectedFulltimeHours; update('parttimeAmount', moneyInput(String(parseDecimalInput(value) * factor))) }} />}

    {currentStep === 'schedule' && <WizardStep title={labels.stepSchedule}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field required label={labels.onCallEmployee}><select className={inputClass} value={String(draft.isOnCall)} onChange={(event) => { const isOnCall = event.target.value === 'true'; update('isOnCall', isOnCall); if (isOnCall) distributeHours('0') }}><option value="false">{labels.no}</option><option value="true">{labels.yes}</option></select></Field>
         {draft.isOnCall ? <Field required label={labels.onCallObligation}><select className={inputClass} value={String(draft.onCallObligation)} onChange={(event) => update('onCallObligation', event.target.value === 'true')}><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select></Field> : <Field required label={labels.employmentScope}><div className={`${inputClass} flex items-center bg-muted/40`} aria-live="polite">{deriveEmploymentWorkScope(parseDecimalInput(draft.weeklyHours), selectedFulltimeHours) === 'FULL_TIME' ? labels.fullTime : labels.partTime}</div></Field>}
        <Field required label={labels.weeklyHours}><input type="text" inputMode="decimal" min="0" max="50" className={inputClass} value={draft.weeklyHours} onChange={(event) => distributeHours(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{labels.fulltimeReference}: {selectedFulltimeHours} {labels.hoursPerWeek}</span></Field>
        {!draft.isOnCall && <Field label={labels.partTimeFactor}><input readOnly className={`${inputClass} bg-muted/40`} value={`${Math.round(parseDecimalInput(draft.partTimeFactor) * 10000) / 100}%`} /></Field>}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">{labels.roster} <span className="text-primary" aria-label={labels.required}>*</span></h4><button type="button" className="button-secondary" onClick={() => setDraft((current) => ({ ...current, twoWeekRoster: !current.twoWeekRoster }))}>{draft.twoWeekRoster ? labels.removeSecondWeek : labels.addSecondWeek}</button></div>
      <RosterWeekFields title={labels.weekOne} days={draft.days} labels={labels} inputClass={inputClass} onChange={updateDay} />
      {draft.twoWeekRoster && <RosterWeekFields title={labels.weekTwo} days={draft.secondWeekDays} labels={labels} inputClass={inputClass} onChange={updateSecondWeekDay} />}
      <p className={`mt-3 text-sm ${rosterMatches ? 'text-muted-foreground' : 'text-destructive'}`}>{labels.rosterAverage}: {rosterAverage.toFixed(2)} {labels.hoursPerWeek}{!rosterMatches ? ` · ${labels.rosterMismatch}` : ''}</p>
      <div className="mt-2 space-y-1 text-sm" aria-live="polite">
        {(parseDecimalInput(draft.weeklyHours) > 50 || parseDecimalInput(draft.weeklyHours) < 0) && <p role="alert" className="text-destructive">{labels.weeklyHoursInvalid}</p>}
        {rosterHasNegativeHours && <p role="alert" className="text-destructive">{labels.negativeHoursInvalid}</p>}
        {rosterHasInvalidHours && <p role="alert" className="text-destructive">{labels.weeklyHoursInvalid}</p>}
        <p className="text-xs text-muted-foreground">{labels.rosterHoursFormat}</p>
      </div>
    </WizardStep>}

     {currentStep === 'salary' && <WizardStep title={labels.stepSalary}>{!options.canWriteSalary ? <p className="text-sm text-muted-foreground">{labels.frequencyNone}</p> : <div className="grid gap-4 sm:grid-cols-2"><Field required label={labels.salaryCalculation}><select className={inputClass} value={draft.salaryBasis} onChange={(event) => update('salaryBasis', event.target.value as SalaryBasis)}><option value="MANUAL">{labels.salaryManual}</option>{options.salaryRoutes.includes('MINIMUM_WAGE') && <option value="MINIMUM_WAGE">{labels.salaryMinimum}</option>}{options.salaryRoutes.includes('SCALE_WITH_STEPS') && <option value="CUSTOM_SCALE">{labels.salaryTable}</option>}{options.salaryRoutes.includes('SALARY_BAND') && <option value="SALARY_BAND">{labels.salaryBand}</option>}</select></Field><Field required label={labels.frequency}>{options.salaryFrequencies.length === 1 ? <><input readOnly className={`${inputClass} bg-muted/40`} value={options.salaryFrequencies[0]?.name ?? ''} /><span className="text-xs font-normal text-muted-foreground">{labels.frequencySingleHelp}</span></> : options.salaryFrequencies.length > 1 ? <DropdownSelect value={draft.salaryFrequencyId} onChange={(event) => update('salaryFrequencyId', event.target.value)}>{options.salaryFrequencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect> : <span className="text-sm text-destructive">{labels.frequencyNone}</span>}</Field>{draft.salaryBasis === 'CUSTOM_SCALE' && <><Field required label={labels.salaryScale}><DropdownSelect value={draft.salaryScaleId} onChange={(event) => update('salaryScaleId', event.target.value)} searchable searchPlaceholder={labels.salaryScale} emptyLabel={labels.frequencyNone}>{options.salaryScales.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.salaryScaleStep}><DropdownSelect value={draft.salaryScaleStepId} onChange={(event) => update('salaryScaleStepId', event.target.value)} searchable searchPlaceholder={labels.salaryScaleStep} emptyLabel={labels.frequencyNone}>{options.salaryScaleSteps.filter((item) => item.salaryScaleId === draft.salaryScaleId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</DropdownSelect></Field><Field label={labels.salaryScaleAmount}><input readOnly className={`${inputClass} bg-muted/40`} value={selectedScale ? `€ ${money(selectedScale.fulltimeAmount)}` : '—'} /></Field></>}{draft.salaryBasis === 'SALARY_BAND' && <Field required label={labels.salaryBand}><DropdownSelect value={draft.salaryBandId} onChange={(event) => update('salaryBandId', event.target.value)} searchable searchPlaceholder={labels.salaryBand} emptyLabel={labels.frequencyNone}>{options.salaryBands.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field>}{draft.salaryBasis === 'MINIMUM_WAGE' && <Field label={labels.minimumHourlyRate}><input readOnly className={`${inputClass} bg-muted/40`} value={minimumRate ? `€ ${money(minimumRate.hourlyAmount)}` : '—'} /></Field>}{(draft.salaryBasis === 'MANUAL' || draft.salaryBasis === 'SALARY_BAND') && <><Field required label={labels.fulltimeSalary}><input type="text" inputMode="decimal" min="0" className={inputClass} value={draft.fulltimeAmount} onBlur={() => update('fulltimeAmount', moneyInput(draft.fulltimeAmount))} onChange={(event) => { update('fulltimeAmount', event.target.value); const factor = parseDecimalInput(draft.weeklyHours) / selectedFulltimeHours; update('parttimeAmount', moneyInput(String(parseDecimalInput(event.target.value) * factor))) }} /></Field>{parseDecimalInput(draft.weeklyHours) !== selectedFulltimeHours && <Field required label={labels.parttimeSalary}><input type="text" inputMode="decimal" min="0" className={inputClass} value={draft.parttimeAmount} onBlur={() => update('parttimeAmount', moneyInput(draft.parttimeAmount))} onChange={(event) => { update('parttimeAmount', event.target.value); const factor = parseDecimalInput(draft.weeklyHours) / selectedFulltimeHours; if (factor > 0) update('fulltimeAmount', moneyInput(String(parseDecimalInput(event.target.value) / factor))) }} /></Field>}</>}</div>}</WizardStep>}

    {currentStep === 'other' && <WizardStep title={labels.stepOther}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field required label={labels.jobGroup}><DropdownSelect value={draft.jobGroupId} onChange={(event) => update('jobGroupId', event.target.value)} searchable searchPlaceholder={labels.jobGroup} emptyLabel={labels.frequencyNone}>{options.jobGroups.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field>
        <Field required label={labels.job}><DropdownSelect value={draft.jobId} onChange={(event) => update('jobId', event.target.value)} searchable searchPlaceholder={labels.job} emptyLabel={labels.frequencyNone}>{filteredJobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field>
        <Field required label={labels.department}><DropdownSelect value={draft.departmentId} onChange={(event) => update('departmentId', event.target.value)} searchable searchPlaceholder={labels.department} emptyLabel={labels.frequencyNone}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field>
        <Field label={labels.manager}><div className={`${inputClass} flex min-h-11 items-center bg-muted/40`} aria-readonly="true">{departmentManagers.length > 0 ? departmentManagers.map((item) => `${item.employeeNumber} · ${item.name}`).join(', ') : labels.noConfiguredManager}</div><span className="text-xs font-normal text-muted-foreground">{labels.managerDerived}</span></Field>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field required label={labels.costCarrier}><DropdownSelect value={draft.allocations[0]?.costCarrierId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, allocations: current.allocations.map((allocation) => ({ ...allocation, costCarrierId: event.target.value })) }))} searchable searchPlaceholder={labels.costCarrier} emptyLabel={labels.frequencyNone}>{options.costCarriers.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">{labels.costCenter}</h4><button type="button" className="button-secondary" onClick={() => setDraft((current) => ({ ...current, allocations: [...current.allocations, { costCenterId: options.costCenters[0]?.id ?? '', costCarrierId: current.allocations[0]?.costCarrierId ?? options.costCarriers[0]?.id ?? '', percentage: '0' }] }))}>{labels.addAllocation}</button></div>
      <div className="mt-3 space-y-3">{draft.allocations.map((allocation, index) => <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" key={`${index}-${allocation.costCenterId}`}><Field required label={labels.costCenter}><DropdownSelect value={allocation.costCenterId} onChange={(event) => updateAllocation(index, 'costCenterId', event.target.value)} searchable searchPlaceholder={labels.costCenter} emptyLabel={labels.frequencyNone}>{options.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect></Field><Field required label={labels.allocationPercentage}><input type="text" inputMode="decimal" min="0.01" max="100" className={inputClass} value={allocation.percentage} onChange={(event) => updateAllocation(index, 'percentage', event.target.value)} /></Field><button type="button" className="button-secondary self-end" disabled={draft.allocations.length === 1} onClick={() => setDraft((current) => ({ ...current, allocations: current.allocations.filter((_item, allocationIndex) => allocationIndex !== index) }))}>{labels.removeAllocation}</button></div>)}</div>
      <p className={`mt-3 text-sm ${allocationsMatch ? 'text-muted-foreground' : 'text-destructive'}`}>{labels.allocationTotal}: {allocationTotal.toFixed(2)}%{!allocationsMatch ? ` · ${labels.allocationMismatch}` : ''}</p><p className="mt-2 text-xs text-muted-foreground">{labels.splitCostCenter}</p>
    </WizardStep>}

    {currentStep === 'review' && <WizardStep title={labels.completeSummary}>{employeeSummary && <EmployeeSummaryCard summary={employeeSummary} labels={labels} />}<p className="text-sm text-muted-foreground">{labels.createHint}</p>{invalidStepKeys.length > 0 && <div role="alert" className="mt-4 rounded-xl border border-warning/40 bg-warning-surface p-4 text-sm"><p className="font-semibold">{labels.reviewMissingFields}</p><div className="mt-2 flex flex-wrap gap-2">{invalidStepKeys.map((key) => <button type="button" className="button-secondary text-xs" key={key} onClick={() => setStep(stepKeys.indexOf(key))}>{labels.reviewEditStep}: {stepLabels[key]}</button>)}</div></div>}<dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Summary label={labels.administration} value={options.administrations.find((item) => item.id === draft.administrationId)?.name ?? ''} /><Summary label={labels.employmentNumber} value={draft.employmentNumber} /><Summary label={labels.workerType} value={draft.employmentType} /><Summary label={labels.startDate} value={draft.startsOn} />{payrollDetails && reviewDetailItems.map((item) => <Summary key={item.label} label={reviewDetailLabel(item.label, labels)} value={item.value} />)}</dl></WizardStep>}

    {state === 'failed' && <p role="alert" className="mt-4 text-sm text-destructive">{errorMessage(errorCode, labels)}</p>}{state === 'saved' && <p className="mt-4 text-sm text-success">{labels.saved}</p>}<div className="sticky bottom-0 z-10 mt-8 flex items-center justify-between gap-3 border-t border-border/70 bg-surface/95 py-3 backdrop-blur-sm"><div className="flex min-w-0 items-center gap-2">{onCancel && <button type="button" className="button-secondary shrink-0" disabled={state === 'saving'} onClick={onCancel}>{labels.cancel}</button>}{step > 0 && <button type="button" className="button-secondary shrink-0" disabled={state === 'saving' || optionsLoading} onClick={() => setStep((current) => Math.max(0, current - 1))}>{labels.previous}</button>}</div><EmploymentScrollHint label={moreDataAvailable} visible={canScrollDown} />{step < stepKeys.length - 1 ? <button type="button" className="button-primary shrink-0" disabled={state === 'saving' || optionsLoading || payrollChoicePending || (currentStep === 'employment' && !draft.employmentType)} onClick={next}>{labels.next}</button> : <button type="submit" className="button-primary shrink-0" disabled={state === 'saving' || optionsLoading}>{labels.submit}</button>}</div>
  </form></employmentFieldLabelsContext.Provider>
}

function EmploymentScrollHint({ label, visible }: { label?: string; visible: boolean }) {
  if (!visible || !label) return <span className="min-w-0 flex-1" aria-hidden="true" />
  return <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 px-1 text-center text-xs font-semibold text-success" role="status" aria-live="polite"><ArrowDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-bounce" />{label}</span>
}

function errorMessage(code: string, labels: EmploymentCreateFormProps['labels']): string {
  if (code === REQUIRED_FIELDS_ERROR || code === 'EMPLOYEE_CONCURRENCY_CONFLICT') return code === 'EMPLOYEE_CONCURRENCY_CONFLICT' ? labels.employeeConflict : labels.requiredFields
  if (code === 'EMPLOYMENT_NUMBER_OR_IKV_CONFLICT') return labels.employmentNumberConflict
  if (code === 'EMPLOYEE_ADMINISTRATION_MISMATCH') return labels.employeeConflict
  if (code === 'ROSTER_HOURS_MISMATCH' || code === 'WEEKLY_HOURS_INVALID' || code.startsWith('WORK_PATTERN_')) return labels.rosterMismatch
  if (code === 'COST_ALLOCATION_TOTAL_INVALID') return labels.allocationMismatch
  if (code === 'PROBATION_DATE_OUTSIDE_CONTRACT') return labels.probationOutsideContract
  if (code === 'PROBATION_NOT_ALLOWED') return labels.probationNotAllowed
  if (code === 'PROBATION_MAXIMUM_EXCEEDED') return labels.probationMaximumExceeded
  if (code === 'PROBATION_DATE_INVALID' || code === 'CONTRACT_END_DATE_REQUIRED' || code === 'CONTRACT_END_DATE_NOT_ALLOWED' || code === 'EMPLOYMENT_NUMBER_INVALID' || code === 'INITIAL_TIMELINE_DATE_MISMATCH' || code === 'EMPLOYMENT_INPUT_INVALID' || code === 'COMPLETE_EMPLOYMENT_PAYLOAD_INVALID') return labels.requiredFields
  return labels.failed
}

function reviewDetailLabel(key: EmploymentReviewDetailKey, labels: EmploymentCreateFormProps['labels']): string {
  const labelsByKey: Record<EmploymentReviewDetailKey, string> = {
    duration: labels.duration, endsOn: labels.endDate, probation: labels.probation, probationEnd: labels.probationEnd,
    laborCondition: labels.laborConditions, weeklyHours: labels.weeklyHours, fulltimeReference: labels.fulltimeReference,
    employmentScope: labels.employmentScope, partTimeFactor: labels.partTimeFactor, roster: labels.roster,
    weekOne: labels.weekOne, weekTwo: labels.weekTwo, rosterAverage: labels.rosterAverage,
    salaryBasis: labels.salaryCalculation, frequency: labels.frequency, fulltimeSalary: labels.fulltimeSalary,
    parttimeSalary: labels.parttimeSalary, department: labels.department, job: labels.job, manager: labels.manager,
    costCarrier: labels.costCarrier, costCenter: labels.costCenter, allocation: labels.allocationTotal,
  }
  return labelsByKey[key]
}

function RosterWeekFields({ title, days, labels, inputClass, onChange }: { title: string; days: Record<DayKey, string>; labels: EmploymentCreateFormProps['labels']; inputClass: string; onChange: (day: DayKey, value: string) => void }) {
  return <section className="mt-4"><h5 className="text-sm font-semibold">{title}</h5><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{dayKeys.map((day) => <Field key={day} label={labels[day]}><input type="text" inputMode="numeric" placeholder="uu,mm" className={inputClass} value={days[day]} onChange={(event) => onChange(day, event.target.value)} /></Field>)}</div></section>
}

function Field({ label, children, required = false, className = '', labelClassName = '' }: { label: string; children: ReactNode; required?: boolean; className?: string; labelClassName?: string }) {
  const labels = useContext(employmentFieldLabelsContext)
  return <label className={`grid min-w-0 content-start gap-1.5 text-sm font-medium ${className}`}><span className={`flex flex-wrap items-center gap-2 ${labelClassName}`}><span>{label}</span>{labels && required && <span className="text-primary" aria-label={labels.required}>*</span>}</span>{children}</label>
}

function WizardStep({ title, children }: { title: string; children: ReactNode }) { return <section className="mt-6"><h3 className="mb-5 text-xl font-semibold">{title}</h3>{children}</section> }
function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" className="rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-muted" onClick={onClick}>{children}</button> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value || '—'}</dd></div> }
function EmployeeSummaryCard({ summary, labels }: { summary: EmploymentWizardEmployeeSummary; labels: EmploymentCreateFormProps['labels'] }) {
  const gender = summary.gender === 'MALE' ? labels.genderMale : summary.gender === 'FEMALE' ? labels.genderFemale : summary.gender === 'OTHER' ? labels.genderOther : labels.genderUndisclosed
  return <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.employeeSummaryTitle}</p><dl className="mt-3 grid gap-3 sm:grid-cols-3"><Summary label={labels.employeeSummaryName} value={summary.name} /><Summary label={labels.employeeSummaryBirthDate} value={summary.birthDate ?? ''} /><Summary label={labels.employeeSummaryGender} value={gender} /></dl></div>
}

function ageOn(birthDate: string, date: string): number { if (!birthDate || !date) return 21; const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number); const [year, month, day] = date.split('-').map(Number); return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0) }
