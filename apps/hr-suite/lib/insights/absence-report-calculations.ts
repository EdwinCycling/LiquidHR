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
      caseIds: new Set<string>(),
      spellIds: new Set<string>(),
    }

    current.availableHours += metric.availableHours
    current.availableDays += metric.availableDays
    current.sickHours += metric.sickHours
    current.sickDays += metric.sickDays
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
