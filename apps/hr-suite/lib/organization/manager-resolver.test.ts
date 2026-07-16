import { describe, expect, it } from 'vitest'

async function loadResolver() {
  try {
    return await import('./manager-resolver')
  } catch {
    return null
  }
}

const departments = [
  { id: 'root', parentId: null },
  { id: 'team', parentId: 'root' },
]

const placement = {
  employeeId: 'target',
  departmentId: 'team',
  directManagerId: 'manager-direct',
  directManagerDeputyId: 'manager-deputy',
}

describe('resolveManagerForEmployee', () => {
  it('gebruikt de directe manageroverride voor DIRECT_MANAGER', async () => {
    const resolver = await loadResolver()
    expect(resolver).not.toBeNull()
    if (!resolver) return

    const result = resolver.resolveManagerForEmployee({
      roleCode: 'DIRECT_MANAGER',
      placement,
      departments,
      assignments: [],
      unavailableEmployeeIds: [],
    })

    expect(result).toEqual({ employeeId: 'manager-direct', departmentId: 'team', source: 'direct' })
  })

  it('gebruikt de expliciete deputy alleen wanneer de manager als afwezig is aangeleverd', async () => {
    const resolver = await loadResolver()
    expect(resolver).not.toBeNull()
    if (!resolver) return

    const result = resolver.resolveManagerForEmployee({
      roleCode: 'DIRECT_MANAGER',
      placement,
      departments,
      assignments: [],
      unavailableEmployeeIds: ['manager-direct'],
    })

    expect(result).toEqual({ employeeId: 'manager-deputy', departmentId: 'team', source: 'direct-deputy' })
  })

  it('klimt naar een bovenliggende afdeling wanneer lokaal geen rolhouder bestaat', async () => {
    const resolver = await loadResolver()
    expect(resolver).not.toBeNull()
    if (!resolver) return

    const result = resolver.resolveManagerForEmployee({
      roleCode: 'HR_MANAGER',
      placement: { ...placement, directManagerId: null, directManagerDeputyId: null },
      departments,
      assignments: [
        {
          departmentId: 'root',
          roleCode: 'HR_MANAGER',
          employeeId: 'hr-root',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ],
      asOfDate: '2026-07-14',
      unavailableEmployeeIds: [],
    })

    expect(result).toEqual({ employeeId: 'hr-root', departmentId: 'root', source: 'department' })
  })

  it('weigert stil een eerste rolhouder te kiezen bij meerdere geldige kandidaten', async () => {
    const resolver = await loadResolver()
    expect(resolver).not.toBeNull()
    if (!resolver) return

    expect(() =>
      resolver.resolveManagerForEmployee({
        roleCode: 'HR_MANAGER',
        placement: { ...placement, directManagerId: null, directManagerDeputyId: null },
        departments,
        assignments: [
          {
            departmentId: 'team',
            roleCode: 'HR_MANAGER',
            employeeId: 'hr-1',
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
          {
            departmentId: 'team',
            roleCode: 'HR_MANAGER',
            employeeId: 'hr-2',
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
        ],
        asOfDate: '2026-07-14',
        unavailableEmployeeIds: [],
      }),
    ).toThrow(resolver.AmbiguousManagerError)
  })

  it('gebruikt de gekoppelde deputyrol wanneer de primaire rolhouder als afwezig is aangeleverd', async () => {
    const resolver = await loadResolver()
    expect(resolver).not.toBeNull()
    if (!resolver) return

    const result = resolver.resolveManagerForEmployee({
      roleCode: 'HR_MANAGER',
      placement: { ...placement, directManagerId: null, directManagerDeputyId: null },
      departments,
      assignments: [
        {
          departmentId: 'team',
          roleCode: 'HR_MANAGER',
          employeeId: 'hr-primary',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
        {
          departmentId: 'team',
          roleCode: 'DEPUTY_HR_MANAGER',
          employeeId: 'hr-deputy',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ],
      deputyRoleCodes: { HR_MANAGER: 'DEPUTY_HR_MANAGER' },
      asOfDate: '2026-07-14',
      unavailableEmployeeIds: ['hr-primary'],
    })

    expect(result).toEqual({ employeeId: 'hr-deputy', departmentId: 'team', source: 'department-deputy' })
  })
})
