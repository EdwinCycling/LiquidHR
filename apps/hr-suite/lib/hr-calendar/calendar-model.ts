import type { HrChangeEvent } from '@/lib/hr-events/types'
import type { Locale } from '@/lib/i18n/config'

const DATE_LOCALES: Record<Locale, string> = { nl: 'nl-NL', en: 'en-GB' }

export function buildMonthDays(month:string):string[]{const [year,value]=month.split('-').map(Number);const count=new Date(Date.UTC(year,value,0)).getUTCDate();return Array.from({length:count},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`)}
export function formatCalendarMonth(month: string, locale: Locale): string { return new Intl.DateTimeFormat(DATE_LOCALES[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) }
export function formatCalendarWeekday(day: string, locale: Locale): string { return new Intl.DateTimeFormat(DATE_LOCALES[locale], { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)).replace('.', '') }
export function groupEventsByEmployee(events:HrChangeEvent[]):Map<string,Map<string,HrChangeEvent[]>>{const result=new Map<string,Map<string,HrChangeEvent[]>>();for(const event of events){const employee=result.get(event.employeeId)??new Map<string,HrChangeEvent[]>();employee.set(event.eventDate,[...(employee.get(event.eventDate)??[]),event]);result.set(event.employeeId,employee)}return result}

export function getEmployeePageSize(value: string | undefined, totalEmployees: number): number {
  if (value === 'all') return Math.min(totalEmployees, 100)
  return value === '25' ? 25 : 10
}
