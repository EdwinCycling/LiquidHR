export type IndicatorValue = 'UNKNOWN' | 'YES' | 'NO'

export type AbsenceEmployeePickerData = {
  firstName: string
  birthNamePrefix: string | null
  birthName: string
  employmentCount: number
  departmentName: string | null
  jobTitle: string | null
}

export function formatAbsenceEmployeeName(employee: Pick<AbsenceEmployeePickerData, 'firstName' | 'birthNamePrefix' | 'birthName'>): string {
  return [employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')
}

export function formatAbsenceEmployeePickerLabel(employee: AbsenceEmployeePickerData): string {
  const name = formatAbsenceEmployeeName(employee)
  if (employee.employmentCount <= 1) return name

  const employmentContext = [employee.departmentName, employee.jobTitle].filter(Boolean).join(' / ')
  return employmentContext ? `${name} [${employmentContext}]` : name
}

export type AbsenceReportPayload = {
  employeeId: string
  employmentId: string | undefined
  startDate: string
  idempotencyKey: string
  absencePercentage?: number
  expectedRecoveryOn?: string | null
  hasSicknessBenefitSafetyNet?: boolean | null
  isWorkAccident?: boolean | null
  isThirdPartyTrafficAccident?: boolean | null
}

export type AbsenceReportFormValues = {
  employeeId: string
  employmentId: string
  startDate: string
  percentage: string
  expectedRecovery: string
  hasSafetyNet: IndicatorValue
  workAccident: IndicatorValue
  thirdPartyAccident: IndicatorValue
  idempotencyKey: string
  selfService: boolean
}

export function toIndicator(value: IndicatorValue): boolean | null {
  return value === 'UNKNOWN' ? null : value === 'YES'
}

export function buildAbsenceReportPayload(values: AbsenceReportFormValues): AbsenceReportPayload {
  if (values.selfService) {
    return {
      employeeId: values.employeeId,
      employmentId: values.employmentId || undefined,
      startDate: values.startDate,
      idempotencyKey: values.idempotencyKey,
    }
  }

  return {
    employeeId: values.employeeId,
    employmentId: values.employmentId || undefined,
    startDate: values.startDate,
    absencePercentage: Number(values.percentage),
    expectedRecoveryOn: values.expectedRecovery || null,
    hasSicknessBenefitSafetyNet: toIndicator(values.hasSafetyNet),
    isWorkAccident: toIndicator(values.workAccident),
    isThirdPartyTrafficAccident: toIndicator(values.thirdPartyAccident),
    idempotencyKey: values.idempotencyKey,
  }
}

export function buildAbsenceRecoveryPayload(caseId: string, recoveredOn: string, idempotencyKey: string) {
  return { caseId, recoveredOn, idempotencyKey }
}

export function buildAbsenceCapacityPayload(caseId: string, effectiveOn: string, percentage: string, idempotencyKey: string, options: { inputMode?: 'PERCENTAGE' | 'HOURS'; absenceHoursPerWeek?: string; expectedNextReviewOn?: string } = {}) {
  const inputMode = options.inputMode ?? 'PERCENTAGE'
  const expectedNextReviewOn = options.expectedNextReviewOn || null
  return inputMode === 'HOURS'
    ? { caseId, effectiveOn, inputMode, absenceHoursPerWeek: parseDecimalInput(options.absenceHoursPerWeek ?? ''), expectedNextReviewOn, idempotencyKey }
    : { caseId, effectiveOn, absencePercentage: parseDecimalInput(percentage), expectedNextReviewOn, idempotencyKey }
}

function parseDecimalInput(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function getReportableAbsenceEmploymentOptions<T extends { id: string }>(options: readonly T[], cases: readonly { employmentId: string; status: string }[]): T[] {
  const openEmploymentIds = new Set(cases.filter((item) => item.status === 'ACTIVE' || item.status === 'RECOVERY_WINDOW').map((item) => item.employmentId))
  return options.filter((option) => !openEmploymentIds.has(option.id))
}

export function getDefaultAbsenceCapacityEffectiveOn(currentCase: { spells: Array<{ capacityEffectiveOn: string | null }> } | null | undefined, now = new Date()): string {
  const today = now.toISOString().slice(0, 10)
  return today
}
