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

export function buildAbsenceCapacityPayload(caseId: string, effectiveOn: string, percentage: string, idempotencyKey: string) {
  return {
    caseId,
    effectiveOn,
    absencePercentage: Number(percentage),
    expectedNextReviewOn: null,
    idempotencyKey,
  }
}

export function getDefaultAbsenceCapacityEffectiveOn(currentCase: { spells: Array<{ capacityEffectiveOn: string | null }> } | null | undefined, now = new Date()): string {
  const today = now.toISOString().slice(0, 10)
  const latestCapacityDate = (currentCase?.spells ?? []).reduce<string | null>((latest, spell) => {
    if (!spell.capacityEffectiveOn) return latest
    return latest === null || spell.capacityEffectiveOn > latest ? spell.capacityEffectiveOn : latest
  }, null)
  const baseDate = latestCapacityDate !== null && latestCapacityDate >= today ? latestCapacityDate : today
  const nextDate = new Date(`${baseDate}T00:00:00.000Z`)
  if (baseDate === latestCapacityDate) nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  return nextDate.toISOString().slice(0, 10)
}
