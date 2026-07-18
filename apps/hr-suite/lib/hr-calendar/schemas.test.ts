import { describe, expect, it } from 'vitest'
import { calendarQuerySchema } from './schemas'
describe('calendar query',()=>{it('accepts valid month filters',()=>expect(calendarQuerySchema.parse({month:'2026-07',type:['SCHEDULE_CHANGED']})).toMatchObject({month:'2026-07'}));it('rejects invalid months',()=>expect(()=>calendarQuerySchema.parse({month:'2026-13'})).toThrow())})
