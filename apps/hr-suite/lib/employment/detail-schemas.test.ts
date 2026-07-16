import { describe, expect, it } from 'vitest'
import {
  followUpSchema,
  profileLinkSchema,
  rollbackTimelineSchema,
  timelineMutationSchema,
} from './detail-schemas'

describe('timelineMutationSchema', () => {
  it('valideert arbeidsvoorwaarden, rooster en salaris per domein', () => {
    expect(timelineMutationSchema.safeParse({
      timeline: 'LABOR_CONDITIONS', effectiveOn: '2026-08-01', reason: 'Nieuwe CAO',
      payload: { conditionGroup: 'CAO Metalektro' },
    }).success).toBe(true)
    expect(timelineMutationSchema.safeParse({
      timeline: 'SCHEDULE', effectiveOn: '2026-08-01', reason: 'Meer uren',
      payload: { scheduleType: 'HOURS_AND_SPECIFIC_DAYS', averageDaysPerWeek: 4,
        averageHoursPerWeek: 32, partTimeFactor: 0.8, mondayHours: 8, tuesdayHours: 8,
        wednesdayHours: 8, thursdayHours: 8 },
    }).success).toBe(true)
    expect(timelineMutationSchema.safeParse({
      timeline: 'SALARY', effectiveOn: '2026-08-01', reason: 'Salarisverhoging',
      payload: { paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
        salaryBasis: 'MANUAL', fulltimeAmount: 4200, currencyCode: 'EUR' },
    }).success).toBe(true)
  })

  it('weigert onvolledige salaris- en kostenverdelingsmutaties', () => {
    expect(timelineMutationSchema.safeParse({
      timeline: 'SALARY', effectiveOn: '2026-08-01', reason: 'Onvolledig',
      payload: { paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', salaryBasis: 'MANUAL' },
    }).success).toBe(false)
    expect(timelineMutationSchema.safeParse({
      timeline: 'COST_ALLOCATION', effectiveOn: '2026-08-01', reason: 'Verdelen',
      payload: { allocations: [{ costCenterId: crypto.randomUUID(), percentage: 90 }] },
    }).success).toBe(false)
  })
})

describe('ondersteunende schemas', () => {
  it('vereist een reden bij rollback', () => {
    expect(rollbackTimelineSchema.safeParse({ effectiveOn: '2026-08-01', reason: '' }).success).toBe(false)
  })

  it('accepteert uitsluitend https-profielkoppelingen', () => {
    expect(profileLinkSchema.safeParse({ linkType: 'LINKEDIN', label: 'LinkedIn', url: 'https://linkedin.com/in/test' }).success).toBe(true)
    expect(profileLinkSchema.safeParse({ linkType: 'WEBSITE', label: 'Website', url: 'http://example.com' }).success).toBe(false)
  })

  it('valideert een concrete opvolgactie', () => {
    expect(followUpSchema.safeParse({ subject: 'Reiskosten controleren', priority: 'HIGH', dueOn: '2026-08-15' }).success).toBe(true)
  })
})

