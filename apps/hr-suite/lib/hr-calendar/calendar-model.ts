import type { HrChangeEvent } from '@/lib/hr-events/types'
import type { CalendarTypeEvent } from './calendar-service'
import type { Locale } from '@/lib/i18n/config'
import type { WeekNumberingSystem } from '@/lib/preferences/user-preferences'

const DATE_LOCALES: Record<Locale, string> = { nl: 'nl-NL', en: 'en-GB' }
const DAY_IN_MS = 24 * 60 * 60 * 1000

export interface CalendarWeekSegment {
  weekNumber: number
  startDate: string
  endDate: string
  startIndex: number
  span: number
}

export interface CalendarWeekOption {
  weekNumber: number
  startDate: string
}

export interface CalendarDayOccupancy {
  date: string
  employeeCount: number
  availableMinutes: number
  maximumMinutes: number
  availabilityPercentage: number
}

interface CalendarOccupancyEmployee {
  workDays: Record<string, { isWorkingDay: boolean; scheduledMinutes: number }>
}

export function buildMonthDays(month: string): string[] {
  const [year, value] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}

export function formatCalendarMonth(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`))
}

export function formatCalendarWeekday(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`)).replace('.', '')
}

export function groupEventsByEmployee(events: HrChangeEvent[]): Map<string, Map<string, HrChangeEvent[]>> {
  const result = new Map<string, Map<string, HrChangeEvent[]>>()
  for (const event of events) {
    const employee = result.get(event.employeeId) ?? new Map<string, HrChangeEvent[]>()
    employee.set(event.eventDate, [...(employee.get(event.eventDate) ?? []), event])
    result.set(event.employeeId, employee)
  }
  return result
}

export function groupCalendarTypeEventsByEmployee(events: CalendarTypeEvent[]): Map<string, Map<string, CalendarTypeEvent[]>> {
  const result = new Map<string, Map<string, CalendarTypeEvent[]>>()
  for (const event of events) {
    const employee = result.get(event.employeeId) ?? new Map<string, CalendarTypeEvent[]>()
    employee.set(event.date, [...(employee.get(event.date) ?? []), event])
    result.set(event.employeeId, employee)
  }
  return result
}

export function isWeekendDay(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6
}

export function formatScheduledHours(minutes: number): string {
  const hours = minutes / 60
  const formatted = Number.isInteger(hours) ? String(hours) : hours.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
  return `${formatted}u`
}

export function getEmployeePageSize(value: string | undefined, totalEmployees: number): number {
  if (value === 'all') return Math.min(totalEmployees, 100)
  return value === '25' ? 25 : 10
}

export function getCalendarDayOccupancy(
  days: string[],
  employees: CalendarOccupancyEmployee[],
): CalendarDayOccupancy[] {
  return days.map((date) => {
    let employeeCount = 0
    let availableMinutes = 0
    let maximumMinutes = 0

    for (const employee of employees) {
      const workDay = employee.workDays[date]
      if (!workDay?.isWorkingDay || workDay.scheduledMinutes <= 0) continue
      employeeCount += 1
      availableMinutes += workDay.scheduledMinutes
      maximumMinutes += workDay.scheduledMinutes
    }

    return {
      date,
      employeeCount,
      availableMinutes,
      maximumMinutes,
      availabilityPercentage: maximumMinutes > 0 ? Math.round((availableMinutes / maximumMinutes) * 100) : 0,
    }
  })
}

export function getCalendarWeekNumber(day: string, system: WeekNumberingSystem): number {
  return getCalendarWeekInfo(day, system).weekNumber
}

export function getCalendarWeekOptions(year: number, system: WeekNumberingSystem): CalendarWeekOption[] {
  const totalWeeks = system === 'ISO' ? getIsoWeeksInYear(year) : Math.ceil(getDaysInYear(year) / 7)
  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekNumber = index + 1
    return {
      weekNumber,
      startDate: formatDateKey(getCalendarWeekStartDate(year, weekNumber, system)),
    }
  })
}

export function getCalendarWeekSegments(month: string, system: WeekNumberingSystem): CalendarWeekSegment[] {
  const days = buildMonthDays(month)
  const segments: CalendarWeekSegment[] = []

  for (const [index, day] of days.entries()) {
    const info = getCalendarWeekInfo(day, system)
    const previous = segments.at(-1)
    if (previous && previous.weekNumber === info.weekNumber && previous.startDate === info.startDate) {
      previous.span += 1
      previous.endDate = day
      continue
    }

    segments.push({
      weekNumber: info.weekNumber,
      startDate: info.startDate,
      endDate: day,
      startIndex: index,
      span: 1,
    })
  }

  return segments
}

export function getCalendarWeekStartDate(year: number, weekNumber: number, system: WeekNumberingSystem): Date {
  if (system === 'ISO') return getIsoWeekStartDate(year, weekNumber)
  const startOfYear = createUtcDate(year, 1, 1)
  return addDays(startOfYear, (weekNumber - 1) * 7)
}

function getCalendarWeekInfo(day: string, system: WeekNumberingSystem): { weekNumber: number; startDate: string } {
  if (system === 'ISO') {
    const weekNumber = getIsoWeekNumber(day)
    return {
      weekNumber,
      startDate: formatDateKey(getIsoWeekStartForDay(day)),
    }
  }

  const date = parseDate(day)
  const startOfYear = createUtcDate(date.getUTCFullYear(), 1, 1)
  const dayIndex = Math.floor((date.getTime() - startOfYear.getTime()) / DAY_IN_MS)
  const weekNumber = Math.floor(dayIndex / 7) + 1
  return {
    weekNumber,
    startDate: formatDateKey(addDays(startOfYear, (weekNumber - 1) * 7)),
  }
}

function getIsoWeekNumber(day: string): number {
  const date = parseDate(day)
  date.setUTCDate(date.getUTCDate() + 4 - getIsoWeekday(date))
  const yearStart = createUtcDate(date.getUTCFullYear(), 1, 1)
  return Math.ceil((((date.getTime() - yearStart.getTime()) / DAY_IN_MS) + 1) / 7)
}

function getIsoWeekStartForDay(day: string): Date {
  const date = parseDate(day)
  return addDays(date, 1 - getIsoWeekday(date))
}

function getIsoWeekStartDate(year: number, weekNumber: number): Date {
  const januaryFourth = createUtcDate(year, 1, 4)
  const firstWeekStart = addDays(januaryFourth, 1 - getIsoWeekday(januaryFourth))
  return addDays(firstWeekStart, (weekNumber - 1) * 7)
}

function getIsoWeeksInYear(year: number): number {
  return getIsoWeekNumber(`${year}-12-28`)
}

function getIsoWeekday(date: Date): number {
  return date.getUTCDay() || 7
}

function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * DAY_IN_MS)
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
