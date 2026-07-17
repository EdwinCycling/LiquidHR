import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  countVisibleSalariesAbove,
  getVisibleEmployment,
  getVisibleOrganization,
  searchVisibleEmployees,
} from './read-tools'

const context: AuthContext = {
  tenantId: 'tenant-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['HR_MANAGER'],
  permissions: ['salary:read'],
}

describe('countVisibleSalariesAbove', () => {
  it('telt alleen zichtbare vaste maandsalarissen binnen de vertrouwde scope', async () => {
    const authorizeSalaryRead = vi.fn().mockResolvedValue(context)
    const listVisibleCurrentSalaries = vi.fn().mockResolvedValue([
      { employeeId: 'employee-1', amount: 6500, currency: 'EUR', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY' },
      { employeeId: 'employee-2', amount: 5000, currency: 'EUR', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY' },
      { employeeId: 'employee-3', amount: 7000, currency: 'EUR', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'FOUR_WEEKLY' },
      { employeeId: 'employee-4', amount: null, currency: 'EUR', paymentType: 'HOURLY_VARIABLE', paymentFrequency: 'MONTHLY' },
    ])

    const result = await countVisibleSalariesAbove(context, {
      amount: 6000,
      asOfDate: '2026-07-17',
    }, { authorizeSalaryRead, listVisibleCurrentSalaries })

    expect(authorizeSalaryRead).toHaveBeenCalledTimes(1)
    expect(listVisibleCurrentSalaries).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      administrationId: 'administration-1',
      asOfDate: '2026-07-17',
    })
    expect(result).toEqual({
      source: 'LIQUID_HR',
      data: {
        matchedCount: 1,
        populationCount: 2,
        currency: 'EUR',
        salaryBasis: 'MONTHLY_BASE',
        canRevealIndividuals: false,
      },
      scope: { population: 'Zichtbare actuele vaste maandsalarissen', visibleCount: 2 },
      filters: [
        { field: 'fulltime_amount', operator: '>', value: '6000' },
        { field: 'payment_type', operator: '=', value: 'PERIODIC_FIXED' },
        { field: 'payment_frequency', operator: '=', value: 'MONTHLY' },
        { field: 'currency_code', operator: '=', value: 'EUR' },
      ],
      asOfDate: '2026-07-17',
      uncertainties: ['Variabele beloning, toeslagen en vierwekensalarissen zijn niet meegerekend.'],
    })
  })

  it('weigert wanneer de opnieuw bepaalde autorisatiecontext afwijkt', async () => {
    await expect(countVisibleSalariesAbove(context, {
      amount: 6000,
      asOfDate: '2026-07-17',
    }, {
      authorizeSalaryRead: async () => ({ ...context, tenantId: 'tenant-2' }),
      listVisibleCurrentSalaries: async () => [],
    })).rejects.toMatchObject({ code: 'HERA_SCOPE_MISMATCH' })
  })
})

describe('additional authorized HR read tools', () => {
  it('zoekt alleen minimale medewerkergegevens uit de zichtbare repositoryset', async () => {
    const result = await searchVisibleEmployees(context, { query: 'Eva', limit: 10 }, {
      authorizeEmployeeRead: async () => context,
      searchEmployees: async () => [
        { employeeId: 'employee-2', employeeNumber: 'M-002', firstName: 'Eva', lastName: 'Jansen' },
      ],
    })

    expect(result.data.items).toEqual([
      { employeeId: 'employee-2', employeeNumber: 'M-002', displayName: 'Eva Jansen' },
    ])
    expect(result.source).toBe('LIQUID_HR')
  })

  it('leest een dienstverband pas na doelgerichte contractautorisatie', async () => {
    const authorizeEmploymentRead = vi.fn().mockResolvedValue(context)
    const result = await getVisibleEmployment(context, {
      employeeId: 'employee-2',
      asOfDate: '2026-07-17',
    }, {
      authorizeEmploymentRead,
      loadEmployment: async () => ({
        employmentId: 'employment-2',
        startsOn: '2025-01-01',
        endsOn: null,
        contractType: 'INDEFINITE',
        employmentType: 'EMPLOYEE',
      }),
    })

    expect(authorizeEmploymentRead).toHaveBeenCalledWith('employee-2')
    expect(result.data.employmentId).toBe('employment-2')
  })

  it('retourneert alleen afdelingen met zichtbare plaatsingstellingen', async () => {
    const result = await getVisibleOrganization(context, { asOfDate: '2026-07-17' }, {
      authorizeOrganizationRead: async () => context,
      loadOrganization: async () => ({
        departments: [
          { departmentId: 'department-1', code: 'HR', name: 'Human Resources' },
          { departmentId: 'department-2', code: 'FIN', name: 'Finance' },
        ],
        placements: [
          { departmentId: 'department-1' },
          { departmentId: 'department-1' },
        ],
      }),
    })

    expect(result.data.departments).toEqual([
      { departmentId: 'department-1', code: 'HR', name: 'Human Resources', visiblePlacementCount: 2 },
      { departmentId: 'department-2', code: 'FIN', name: 'Finance', visiblePlacementCount: 0 },
    ])
  })
})
