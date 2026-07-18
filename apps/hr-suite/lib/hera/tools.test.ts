import { describe, expect, it, vi } from 'vitest'
import { executeHeRaTool } from './tools'

describe('executeHeRaTool', () => {
  it('maakt voor een persoonlijke reminder uitsluitend een concept en voert niets uit', async () => {
    const createPersonalReminder = vi.fn()

    const result = await executeHeRaTool(
      { tenantId: 'tenant', administrationId: null, userId: 'user', employeeId: null, activeRoles: [], permissions: [] },
      { name: 'draft_personal_reminder', args: { title: 'Bel terug', remindAt: '2026-07-17T09:00:00.000Z' } },
      { createPersonalReminder },
      new Date('2026-07-17T08:00:00.000Z'),
    )

    expect(result.kind).toBe('DRAFT')
    expect(createPersonalReminder).not.toHaveBeenCalled()
  })

  it('weigert een reminderconcept in het verleden', async () => {
    await expect(executeHeRaTool(
      { tenantId: 'tenant', administrationId: null, userId: 'user', employeeId: null, activeRoles: [], permissions: [] },
      { name: 'draft_personal_reminder', args: { title: 'Oud', remindAt: '2025-01-01T09:00:00.000Z' } },
      {},
      new Date('2026-07-17T10:00:00.000Z'),
    )).rejects.toThrow('HERA_REMINDER_MUST_BE_FUTURE')
  })

  it.each([
    ['draft_employee_address_change', {
      employeeId: '10000000-0000-4000-8000-000000000001', addressId: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-07-17T08:00:00.000Z',
      currentValue: { city: 'Amsterdam' }, input: { street: 'Nieuwstraat', houseNumber: '2', postalCode: '1234AB', city: 'Utrecht', countryCode: 'NL', validFrom: '2026-08-01' },
    }],
    ['draft_employment_salary_change', {
      employmentId: '10000000-0000-4000-8000-000000000003', currentValue: { fulltimeAmount: 6000 },
      mutation: { timeline: 'SALARY', effectiveOn: '2026-08-01', reason: 'Verhoging', warningCodes: [], acknowledgements: {}, payload: { paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', salaryBasis: 'MANUAL', fulltimeAmount: 6500, currencyCode: 'EUR' } },
    }],
    ['draft_employment_schedule_change', {
      employmentId: '10000000-0000-4000-8000-000000000003', currentValue: { averageHoursPerWeek: 40 },
      mutation: { timeline: 'SCHEDULE', effectiveOn: '2026-08-01', reason: 'Nieuwe werkweek', warningCodes: [], acknowledgements: {}, payload: { scheduleType: 'HOURS_AND_AVG_DAYS', startWeek: 1, averageDaysPerWeek: 4, averageHoursPerWeek: 32, partTimeFactor: 0.8, timeForTimeAccrual: 0 } },
    }],
    ['draft_organization_placement_change', {
      placementId: '10000000-0000-4000-8000-000000000004', expectedUpdatedAt: '2026-07-17T08:00:00.000Z', currentValue: { jobTitle: 'Adviseur' }, input: { jobTitle: 'Senior adviseur' },
    }],
  ])('maakt voor %s alleen een controleerbaar concept', async (name, args) => {
    const result = await executeHeRaTool(
      { tenantId: 'tenant', administrationId: 'administration', userId: 'user', employeeId: null, activeRoles: [], permissions: [] },
      { name, args },
    )
    expect(result).toMatchObject({ kind: 'DRAFT', toolName: name })
    if (result.kind === 'DRAFT') {
      const newValue = 'input' in args ? args.input : args.mutation
      expect(result.controlPayload).toMatchObject({ oldValue: args.currentValue, newValue })
    }
  })
})
