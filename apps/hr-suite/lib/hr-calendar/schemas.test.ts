import { describe, expect, it } from 'vitest'
import { calendarQuerySchema } from './schemas'
describe('calendar query',()=>{
  it('accepts valid month filters and display toggles',()=>{
    expect(calendarQuerySchema.parse({month:'2026-07',type:['SCHEDULE_CHANGED'],showReminders:'0',showScheduledHours:'1',showDayOccupancy:'1'})).toMatchObject({month:'2026-07',showReminders:'0',showDayOccupancy:'1'})
  })

  it('rejects invalid months',()=>{
    expect(()=>calendarQuerySchema.parse({month:'2026-13'})).toThrow()
  })
})
