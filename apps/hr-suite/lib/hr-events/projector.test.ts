import { describe, expect, it } from 'vitest'
import { projectHrEvents } from './projector'
import type { HrChangeEventRow } from './types'
const row = (id: string, date: string, type = 'SCHEDULE_CHANGED'): HrChangeEventRow => ({ event_id:id,event_date:date,event_type:type,employee_id:'11111111-1111-4111-8111-111111111111',employment_id:null,title_key:'key',title_values:{hours:36},source_href:'/source',severity:'INFO' })
describe('HR event projector', () => {
  it('orders deterministically by effective date and id', () => expect(projectHrEvents([row('b','2026-07-01'),row('a','2026-07-01'),row('c','2026-08-01')],{canReadSalary:true}).map((item)=>item.id)).toEqual(['c','a','b']))
  it('fully omits salary events without salary capability', () => expect(projectHrEvents([row('salary','2026-07-01','SALARY_CHANGED')],{canReadSalary:false})).toEqual([]))
  it('does not invent gap events', () => expect(projectHrEvents([row('one','2026-01-01'),row('two','2026-04-01')],{canReadSalary:true})).toHaveLength(2))
})
