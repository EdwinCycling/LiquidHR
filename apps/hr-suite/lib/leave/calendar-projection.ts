export type LeaveProjectionScheduleDay = {
  date: string
  scheduledMinutes: number
  isWorkingDay?: boolean
}

export type LeaveProjectionRequest = {
  id: string
  employeeId: string
  employmentId: string
  startDate: string
  endDate: string
  requestMode: 'DIRECT' | 'PRIORITY'
  timeMode: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'
  specificStart: string | null
  specificEnd: string | null
  requestedMinutes: number
  status: string
}

export type LeaveProjectionAllocation = {
  requestId: string
  leaveTypeId: string
  allocatedHours: number
  sortOrder: number
}

export type LeaveDayProjection = {
  id: string
  requestId: string
  employeeId: string
  employmentId: string
  date: string
  leaveTypeId: string
  hours: number
  requestMode: 'DIRECT' | 'PRIORITY'
  timeMode: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'
  status: string
  specificStart: string | null
  specificEnd: string | null
  sortOrder: number
}

type ProjectionInput = {
  requests: readonly LeaveProjectionRequest[]
  allocations: readonly LeaveProjectionAllocation[]
  scheduleDaysByEmployment: ReadonlyMap<string, ReadonlyMap<string, LeaveProjectionScheduleDay>>
  holidayDates?: ReadonlySet<string>
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date)
  return dates
}

function roundHours(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function isWorkingDay(day: LeaveProjectionScheduleDay | undefined, holidayDates: ReadonlySet<string>): boolean {
  return Boolean(day && day.scheduledMinutes > 0 && day.isWorkingDay !== false && !holidayDates.has(day.date))
}

export function projectApprovedLeave(input: ProjectionInput): LeaveDayProjection[] {
  const allocationsByRequest = new Map<string, LeaveProjectionAllocation[]>()
  for (const allocation of input.allocations) {
    if (allocation.allocatedHours <= 0 || !Number.isFinite(allocation.allocatedHours)) continue
    allocationsByRequest.set(allocation.requestId, [...(allocationsByRequest.get(allocation.requestId) ?? []), allocation])
  }
  for (const allocations of allocationsByRequest.values()) {
    allocations.sort((left, right) => left.sortOrder - right.sortOrder || left.leaveTypeId.localeCompare(right.leaveTypeId))
  }

  const holidayDates = input.holidayDates ?? new Set<string>()
  const result: LeaveDayProjection[] = []

  for (const request of input.requests) {
    if (request.status !== 'APPROVED') continue
    const allocations = allocationsByRequest.get(request.id) ?? []
    if (allocations.length === 0) continue
    const scheduleDays = input.scheduleDaysByEmployment.get(request.employmentId)
    if (!scheduleDays) continue

    const remainingByAllocation = allocations.map((allocation) => allocation.allocatedHours)
    let remainingRequestHours = Math.max(0, request.requestedMinutes / 60)
    const requestDates = dateRange(request.startDate, request.endDate)

    for (const date of requestDates) {
      const scheduleDay = scheduleDays.get(date)
      if (!isWorkingDay(scheduleDay, holidayDates)) continue
      if (request.timeMode !== 'FULL_DAY' && date !== request.startDate) continue

      const dayCapacityHours = Number(scheduleDay?.scheduledMinutes ?? 0) / 60
      const dayHours = Math.min(dayCapacityHours, remainingRequestHours)
      if (dayHours <= 0) continue

      let remainingDayHours = dayHours
      for (let index = 0; index < allocations.length && remainingDayHours > 0; index += 1) {
        const allocation = allocations[index]
        const allocatedHours = Math.min(remainingDayHours, remainingByAllocation[index] ?? 0)
        if (allocatedHours <= 0) continue
        remainingByAllocation[index] = roundHours((remainingByAllocation[index] ?? 0) - allocatedHours)
        remainingDayHours = roundHours(remainingDayHours - allocatedHours)
        result.push({
          id: `${request.id}:${date}:${allocation.leaveTypeId}`,
          requestId: request.id,
          employeeId: request.employeeId,
          employmentId: request.employmentId,
          date,
          leaveTypeId: allocation.leaveTypeId,
          hours: roundHours(allocatedHours),
          requestMode: request.requestMode,
          timeMode: request.timeMode,
          status: request.status,
          specificStart: request.specificStart,
          specificEnd: request.specificEnd,
          sortOrder: allocation.sortOrder,
        })
      }
      remainingRequestHours = roundHours(remainingRequestHours - dayHours)
      if (remainingRequestHours <= 0) break
    }
  }

  return result.sort((left, right) => left.date.localeCompare(right.date)
    || left.employeeId.localeCompare(right.employeeId)
    || left.requestId.localeCompare(right.requestId)
    || left.sortOrder - right.sortOrder
    || left.leaveTypeId.localeCompare(right.leaveTypeId))
}
