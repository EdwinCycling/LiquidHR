export const ACTUAL_WORK_LEAVE_FAMILIES = ['WORK', 'ADDITIONAL', 'OVERTIME'] as const

export type ActualWorkLeaveFamily = typeof ACTUAL_WORK_LEAVE_FAMILIES[number]

type WorkHourTypeForSelection = {
  id: string
  family: string | null
  is_active: boolean
}

export type WorkedHoursSourceEntry = {
  employment_id: string
  work_hour_type_id: string
  subject_period_start: string
  subject_period_end: string
  hours: number
  status: string
}

export type WorkedHoursSourceMapping = {
  accrual_rule_id: string
  work_hour_type_id: string
}

export type WorkedHoursSourceType = {
  id: string
  family: string | null
}

export function isActualWorkLeaveFamily(value: string | null | undefined): value is ActualWorkLeaveFamily {
  return value !== null && value !== undefined && (ACTUAL_WORK_LEAVE_FAMILIES as readonly string[]).includes(value)
}

export function selectActualWorkLeaveTypes<T extends WorkHourTypeForSelection>(types: readonly T[]): T[] {
  return types.filter((type) => type.is_active && isActualWorkLeaveFamily(type.family))
}

export function calculateWorkedHoursAccrual(input: {
  hours: number
  accrualRate: number
  status: string
  family: string | null | undefined
  employmentValid?: boolean
}): number {
  if (input.employmentValid === false || input.status !== 'APPROVED' || !isActualWorkLeaveFamily(input.family)) return 0
  if (!Number.isFinite(input.hours) || !Number.isFinite(input.accrualRate)) return 0
  return input.hours * input.accrualRate
}

export function sumQualifyingWorkedHours(input: {
  entries: readonly WorkedHoursSourceEntry[]
  mappings: readonly WorkedHoursSourceMapping[]
  types: readonly WorkedHoursSourceType[]
  employmentId: string
  ruleId: string
  sliceStart: string
  sliceEnd: string
}): number {
  const mappedTypeIds = new Set(input.mappings
    .filter((mapping) => mapping.accrual_rule_id === input.ruleId)
    .map((mapping) => mapping.work_hour_type_id))
  const familyByTypeId = new Map(input.types.map((type) => [type.id, type.family]))

  return input.entries
    .filter((entry) => entry.employment_id === input.employmentId
      && mappedTypeIds.has(entry.work_hour_type_id)
      && entry.subject_period_start < input.sliceEnd
      && entry.subject_period_end > input.sliceStart
      && isActualWorkLeaveFamily(familyByTypeId.get(entry.work_hour_type_id)))
    .reduce((total, entry) => total + (entry.status === 'APPROVED' && Number.isFinite(Number(entry.hours)) ? Number(entry.hours) : 0), 0)
}
