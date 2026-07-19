import { describe, expect, it } from 'vitest'
import { buildMonthDays, formatCalendarMonth, formatCalendarWeekday, formatScheduledHours, getCalendarDayOccupancy, getCalendarWeekNumber, getCalendarWeekOptions, getCalendarWeekSegments, getEmployeePageSize, groupEventsByEmployee, isWeekendDay } from './calendar-model'
import type { HrChangeEvent } from '@/lib/hr-events/types'
const event=(id:string):HrChangeEvent=>({id,eventDate:'2026-07-15',eventType:'SCHEDULE_CHANGED',employeeId:'11111111-1111-4111-8111-111111111111',employmentId:null,titleKey:'key',titleValues:{},sourceHref:'/x',severity:'INFO'})
describe('calendar model',()=>{it('builds actual month days',()=>expect(buildMonthDays('2026-07')).toHaveLength(31));it('groups multiple employee events on one day',()=>expect(groupEventsByEmployee([event('a'),event('b')]).get(event('a').employeeId)?.get('2026-07-15')).toHaveLength(2))})

describe('employee calendar pagination', () => {
  it('ondersteunt 10, 25 en alle medewerkers met een harde limiet van 100', () => {
    expect(getEmployeePageSize('10', 72)).toBe(10)
    expect(getEmployeePageSize('25', 72)).toBe(25)
    expect(getEmployeePageSize('all', 72)).toBe(72)
    expect(getEmployeePageSize('all', 140)).toBe(100)
  })
})

describe('calendar locale formatting', () => {
  it('formats month and weekday names in the active language', () => {
    expect(formatCalendarMonth('2026-07', 'nl')).toBe('juli 2026')
    expect(formatCalendarMonth('2026-07', 'en')).toBe('July 2026')
    expect(formatCalendarWeekday('2026-07-01', 'nl')).toBe('wo')
    expect(formatCalendarWeekday('2026-07-01', 'en')).toBe('Wed')
  })
})

describe('calendar day helpers', () => {
  it('detects weekends and formats scheduled hours compactly', () => {
    expect(isWeekendDay('2026-07-04')).toBe(true)
    expect(isWeekendDay('2026-07-06')).toBe(false)
    expect(formatScheduledHours(480)).toBe('8u')
    expect(formatScheduledHours(450)).toBe('7,5u')
  })

  it('berekent dagbezetting op basis van de zichtbare medewerkers en hun rooster', () => {
    expect(getCalendarDayOccupancy(
      ['2026-07-01', '2026-07-02'],
      [
        {
          workDays: {
            '2026-07-01': { isWorkingDay: true, scheduledMinutes: 480 },
            '2026-07-02': { isWorkingDay: false, scheduledMinutes: 0 },
          },
        },
        {
          workDays: {
            '2026-07-01': { isWorkingDay: true, scheduledMinutes: 240 },
            '2026-07-02': { isWorkingDay: true, scheduledMinutes: 300 },
          },
        },
      ],
    )).toEqual([
      {
        date: '2026-07-01',
        employeeCount: 2,
        availableMinutes: 720,
        maximumMinutes: 720,
        availabilityPercentage: 100,
      },
      {
        date: '2026-07-02',
        employeeCount: 1,
        availableMinutes: 300,
        maximumMinutes: 300,
        availabilityPercentage: 100,
      },
    ])
  })
})

describe('calendar week numbering', () => {
  it('onderscheidt internationale en iso-weeknummers', () => {
    expect(getCalendarWeekNumber('2027-01-01', 'JANUARY_FIRST')).toBe(1)
    expect(getCalendarWeekNumber('2027-01-08', 'JANUARY_FIRST')).toBe(2)
    expect(getCalendarWeekNumber('2027-01-01', 'ISO')).toBe(53)
    expect(getCalendarWeekNumber('2027-01-04', 'ISO')).toBe(1)
  })

  it('bouwt weeksegmenten boven de maanddagen', () => {
    expect(getCalendarWeekSegments('2026-07', 'JANUARY_FIRST').slice(0, 2)).toEqual([
      { weekNumber: 26, startDate: '2026-06-25', endDate: '2026-07-01', startIndex: 0, span: 1 },
      { weekNumber: 27, startDate: '2026-07-02', endDate: '2026-07-08', startIndex: 1, span: 7 },
    ])
    expect(getCalendarWeekSegments('2026-07', 'ISO').slice(0, 2)).toEqual([
      { weekNumber: 27, startDate: '2026-06-29', endDate: '2026-07-05', startIndex: 0, span: 5 },
      { weekNumber: 28, startDate: '2026-07-06', endDate: '2026-07-12', startIndex: 5, span: 7 },
    ])
  })

  it('geeft selecteerbare weekopties voor het zichtjaar', () => {
    expect(getCalendarWeekOptions(2026, 'JANUARY_FIRST').slice(0, 3)).toEqual([
      { weekNumber: 1, startDate: '2026-01-01' },
      { weekNumber: 2, startDate: '2026-01-08' },
      { weekNumber: 3, startDate: '2026-01-15' },
    ])
    expect(getCalendarWeekOptions(2026, 'ISO').slice(0, 2)).toEqual([
      { weekNumber: 1, startDate: '2025-12-29' },
      { weekNumber: 2, startDate: '2026-01-05' },
    ])
  })
})
