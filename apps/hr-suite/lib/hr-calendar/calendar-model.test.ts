import { describe, expect, it } from 'vitest'
import { buildMonthDays, getEmployeePageSize, groupEventsByEmployee } from './calendar-model'
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
