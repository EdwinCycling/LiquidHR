import { describe, expect, it } from 'vitest'
import { calendarQuerySchema } from './schemas'
describe('calendar query',()=>{
  it('accepts valid month filters and display toggles',()=>{
    expect(calendarQuerySchema.parse({month:'2026-07',type:['SCHEDULE_CHANGED'],showReminders:'0',showScheduledHours:'1',showDayOccupancy:'1'})).toMatchObject({month:'2026-07',showReminders:'0',showDayOccupancy:'1'})
  })

  it('accepts database UUID values without an RFC variant marker',()=>{
    expect(calendarQuerySchema.parse({month:'2026-07',job:'6105c3c1-ec44-f4db-6f4f-457f50871581'}).job).toBe('6105c3c1-ec44-f4db-6f4f-457f50871581')
  })

  it('rejects invalid months',()=>{
    expect(()=>calendarQuerySchema.parse({month:'2026-13'})).toThrow()
  })

  it('rejects malformed calendar identifiers',()=>{
    expect(()=>calendarQuerySchema.parse({month:'2026-07',job:'not-an-id'})).toThrow()
  })
})
