import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { cancelActionDraft, confirmActionDraft } from './action-drafts'

const context: AuthContext = {
  tenantId: 'tenant-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: [],
  permissions: [],
}

describe('confirmActionDraft', () => {
  it('annuleert uitsluitend een eigen nog openstaand concept', async () => {
    const cancelDraft = vi.fn().mockResolvedValue(true)
    await expect(cancelActionDraft(context, 'draft-1', { cancelDraft })).resolves.toBeUndefined()
    expect(cancelDraft).toHaveBeenCalledWith(context, 'draft-1')
  })
  it('claimt en voert een geldig concept precies eenmaal uit', async () => {
    const claimDraft = vi.fn()
      .mockResolvedValueOnce({
        id: 'draft-1',
        actionType: 'PERSONAL_REMINDER',
        version: 3,
        expiresAt: '2099-01-01T00:00:00.000Z',
        payload: { title: 'Bel terug' },
      })
      .mockResolvedValueOnce(null)
    const executeAction = vi.fn().mockResolvedValue({ entityId: 'reminder-1' })
    const markSucceeded = vi.fn()

    await expect(confirmActionDraft(context, {
      draftId: 'draft-1', expectedVersion: 3,
    }, { claimDraft, executeAction, markSucceeded, markFailed: vi.fn() }))
      .resolves.toEqual({ entityId: 'reminder-1' })

    await expect(confirmActionDraft(context, {
      draftId: 'draft-1', expectedVersion: 3,
    }, { claimDraft, executeAction, markSucceeded, markFailed: vi.fn() }))
      .rejects.toMatchObject({ code: 'DRAFT_NOT_CONFIRMABLE' })

    expect(executeAction).toHaveBeenCalledTimes(1)
    expect(markSucceeded).toHaveBeenCalledWith(context, 'draft-1')
  })

  it('markeert een mislukte domeinactie zonder succes te claimen', async () => {
    const failure = new Error('DOMAIN_WRITE_FAILED')
    const markFailed = vi.fn()

    await expect(confirmActionDraft(context, {
      draftId: 'draft-1', expectedVersion: 1,
    }, {
      claimDraft: async () => ({
        id: 'draft-1', actionType: 'PERSONAL_REMINDER', version: 1,
        expiresAt: '2099-01-01T00:00:00.000Z', payload: {},
      }),
      executeAction: async () => { throw failure },
      markSucceeded: vi.fn(),
      markFailed,
    })).rejects.toBe(failure)

    expect(markFailed).toHaveBeenCalledWith(context, 'draft-1', 'DOMAIN_WRITE_FAILED')
  })

  it.each([
    {
      actionType: 'EMPLOYEE_ADDRESS_CHANGE' as const,
      payload: {
        employeeId: '10000000-0000-4000-8000-000000000001',
        addressId: '10000000-0000-4000-8000-000000000002',
        expectedUpdatedAt: '2026-07-17T08:00:00.000Z',
        input: { street: 'Nieuwstraat', houseNumber: '2', postalCode: '1234AB', city: 'Utrecht', countryCode: 'NL', validFrom: '2026-08-01' },
      },
      dependency: 'updateEmployeeAddress' as const,
      expectedArguments: [
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        { street: 'Nieuwstraat', houseNumber: '2', postalCode: '1234AB', city: 'Utrecht', countryCode: 'NL', validFrom: '2026-08-01' },
        '2026-07-17T08:00:00.000Z',
      ],
    },
    {
      actionType: 'EMPLOYMENT_SALARY_CHANGE' as const,
      payload: {
        employmentId: '10000000-0000-4000-8000-000000000003',
        mutation: { timeline: 'SALARY', effectiveOn: '2026-08-01', reason: 'Jaarlijkse verhoging', warningCodes: [], acknowledgements: {}, payload: { paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', salaryBasis: 'MANUAL', fulltimeAmount: 6500, currencyCode: 'EUR' } },
      },
      dependency: 'applyTimelineMutation' as const,
      expectedArguments: [
        '10000000-0000-4000-8000-000000000003',
        { timeline: 'SALARY', effectiveOn: '2026-08-01', reason: 'Jaarlijkse verhoging', warningCodes: [], acknowledgements: {}, payload: { paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', salaryBasis: 'MANUAL', fulltimeAmount: 6500, currencyCode: 'EUR' } },
      ],
    },
    {
      actionType: 'EMPLOYMENT_SCHEDULE_CHANGE' as const,
      payload: {
        employmentId: '10000000-0000-4000-8000-000000000003',
        mutation: { timeline: 'SCHEDULE', effectiveOn: '2026-08-01', reason: 'Nieuwe werkweek', warningCodes: [], acknowledgements: {}, payload: { scheduleType: 'HOURS_AND_AVG_DAYS', startWeek: 1, averageDaysPerWeek: 4, averageHoursPerWeek: 32, partTimeFactor: 0.8, timeForTimeAccrual: 0 } },
      },
      dependency: 'applyTimelineMutation' as const,
      expectedArguments: [
        '10000000-0000-4000-8000-000000000003',
        { timeline: 'SCHEDULE', effectiveOn: '2026-08-01', reason: 'Nieuwe werkweek', warningCodes: [], acknowledgements: {}, payload: { scheduleType: 'HOURS_AND_AVG_DAYS', startWeek: 1, averageDaysPerWeek: 4, averageHoursPerWeek: 32, partTimeFactor: 0.8, timeForTimeAccrual: 0 } },
      ],
    },
    {
      actionType: 'ORGANIZATION_PLACEMENT_CHANGE' as const,
      payload: {
        placementId: '10000000-0000-4000-8000-000000000004',
        expectedUpdatedAt: '2026-07-17T08:00:00.000Z',
        input: { jobTitle: 'Senior adviseur' },
      },
      dependency: 'updatePlacement' as const,
      expectedArguments: ['10000000-0000-4000-8000-000000000004', { jobTitle: 'Senior adviseur' }, '2026-07-17T08:00:00.000Z'],
    },
  ])('voert $actionType via de bestaande domeinservice uit', async ({ actionType, payload, dependency, expectedArguments }) => {
    const adapter = vi.fn().mockResolvedValue('change-1')
    const dependencies = {
      claimDraft: async () => ({ id: 'draft-1', actionType, version: 1, expiresAt: '2099-01-01T00:00:00.000Z', payload }),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(),
      [dependency]: adapter,
    }

    await expect(confirmActionDraft(context, { draftId: 'draft-1', expectedVersion: 1 }, dependencies))
      .resolves.toEqual({ entityId: 'change-1' })
    expect(adapter).toHaveBeenCalledOnce()
    expect(adapter).toHaveBeenCalledWith(...expectedArguments)
  })
})
