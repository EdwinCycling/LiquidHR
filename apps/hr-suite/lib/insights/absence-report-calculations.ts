export interface AbsenceSpellInterval {
  id: string
  startedOn: string
  recoveredOn: string | null
}

export function uniqueAbsenceSpells<T extends { id: string }>(spells: readonly T[]): T[] {
  const unique = new Map<string, T>()
  for (const spell of spells) if (!unique.has(spell.id)) unique.set(spell.id, spell)
  return [...unique.values()]
}

export function countOverlappingAbsenceSpellPairs(
  spells: readonly AbsenceSpellInterval[],
  startDate: string,
  endDate: string,
): number {
  const overlapping = uniqueAbsenceSpells(spells)
    .filter((spell) => spell.startedOn <= endDate && (spell.recoveredOn === null || spell.recoveredOn >= startDate))
    .sort((left, right) => left.startedOn.localeCompare(right.startedOn) || (left.recoveredOn ?? endDate).localeCompare(right.recoveredOn ?? endDate))
  let pairs = 0
  for (let leftIndex = 0; leftIndex < overlapping.length; leftIndex += 1) {
    const left = overlapping[leftIndex]
    const leftEnd = left.recoveredOn === null || left.recoveredOn > endDate ? endDate : left.recoveredOn
    for (let rightIndex = leftIndex + 1; rightIndex < overlapping.length; rightIndex += 1) {
      const right = overlapping[rightIndex]
      if (right.startedOn > leftEnd) break
      const rightEnd = right.recoveredOn === null || right.recoveredOn > endDate ? endDate : right.recoveredOn
      if (right.startedOn <= leftEnd && rightEnd >= left.startedOn) pairs += 1
    }
  }
  return pairs
}

export interface AbsenceEmploymentMetric {
  employeeId: string
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  status: string
  firstAbsenceOn: string
  availableHours: number
  availableDays: number
  sickHours: number
  sickDays: number
  unknownScheduleDays: number
  unknownCapacityDays: number
  unknownPlacements: number
  overlappingSpellPairs: number
  caseIds: readonly string[]
  spellIds: readonly string[]
}

export interface AbsenceEmployeeMetric {
  employeeId: string
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  status: string
  firstAbsenceOn: string
  availableHours: number
  availableDays: number
  sickHours: number
  sickDays: number
  unknownScheduleDays: number
  unknownCapacityDays: number
  unknownPlacements: number
  overlappingSpellPairs: number
  caseIds: Set<string>
  spellIds: Set<string>
}

/** Aggregate all in-scope employments before calculating the employee rate. */
export function aggregateAbsenceEmployeeMetrics(metrics: readonly AbsenceEmploymentMetric[]): AbsenceEmployeeMetric[] {
  const byEmployee = new Map<string, AbsenceEmployeeMetric>()

  for (const metric of metrics) {
    const current = byEmployee.get(metric.employeeId) ?? {
      employeeId: metric.employeeId,
      employeeName: metric.employeeName,
      departmentId: metric.departmentId,
      departmentName: metric.departmentName,
      status: metric.status,
      firstAbsenceOn: metric.firstAbsenceOn,
      availableHours: 0,
      availableDays: 0,
      sickHours: 0,
      sickDays: 0,
      unknownScheduleDays: 0,
      unknownCapacityDays: 0,
      unknownPlacements: 0,
      overlappingSpellPairs: 0,
      caseIds: new Set<string>(),
      spellIds: new Set<string>(),
    }

    current.availableHours += metric.availableHours
    current.availableDays += metric.availableDays
    current.sickHours += metric.sickHours
    current.sickDays += metric.sickDays
    current.unknownScheduleDays += metric.unknownScheduleDays
    current.unknownCapacityDays += metric.unknownCapacityDays
    current.unknownPlacements += metric.unknownPlacements
    current.overlappingSpellPairs += metric.overlappingSpellPairs
    for (const caseId of metric.caseIds) current.caseIds.add(caseId)
    for (const spellId of metric.spellIds) current.spellIds.add(spellId)

    if (metric.firstAbsenceOn > current.firstAbsenceOn) {
      current.firstAbsenceOn = metric.firstAbsenceOn
      current.status = metric.status
    }
    if (current.departmentId === null && metric.departmentId !== null) {
      current.departmentId = metric.departmentId
      current.departmentName = metric.departmentName
    }
    byEmployee.set(metric.employeeId, current)
  }

  return [...byEmployee.values()]
}
