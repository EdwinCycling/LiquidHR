import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, loadActiveContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadActiveContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/context/server-context', () => ({ loadActiveContext }))

import { AuthorizationError, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from './calculation-repository'
import { getMySalaryStatement, type EmployeePayrollDependencies } from './payroll-professional-service'

const identities = {
  lisa: {
    userId: 'test-user-lisa',
    employeeId: '10000000-0000-4000-8000-000000000001',
    tenantId: '50000000-0000-4000-8000-000000000001',
    hrGroupId: '50000000-0000-4000-8000-000000000002',
    administrationId: '50000000-0000-4000-8000-000000000003',
    selfPermissions: ['self:salary:read'],
  },
  jaap: {
    userId: 'test-user-jaap',
    employeeId: '10000000-0000-4000-8000-000000000002',
    tenantId: '50000000-0000-4000-8000-000000000001',
    hrGroupId: '50000000-0000-4000-8000-000000000002',
    administrationId: '50000000-0000-4000-8000-000000000003',
    selfPermissions: ['self:salary:read'],
  },
} as const

type TestIdentity = {
  userId: string
  employeeId: string
  tenantId: string
  hrGroupId: string
  administrationId: string
  selfPermissions: readonly string[]
}

let activeIdentity: TestIdentity = identities.lisa

function result(data: unknown) {
  return Promise.resolve({ data, error: null })
}

function createIdentityClient(identity: TestIdentity) {
  return {
    auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: identity.userId } }, error: null })) },
    from(table: string) {
      if (table === 'user_hr_group_access') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          limit: () => result([{ management_role_id: 'employee-role' }]),
        }
        return builder
      }
      if (table === 'employees') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: () => result({ id: identity.employeeId, tenant_id: identity.tenantId }),
        }
        return builder
      }
      if (table === 'department_management') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          lte: () => builder,
          or: () => result([]),
        }
        return builder
      }
      if (table === 'employments') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          order: () => builder,
          limit: () => result([{ starts_on: '2020-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }]),
        }
        return builder
      }
      if (table === 'employee_ess_access') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: () => result({ status: 'ACTIVE' }),
        }
        return builder
      }
      if (table === 'management_roles') {
        let selection = ''
        const builder = {
          select: (columns: string) => { selection = columns; return builder },
          eq: () => builder,
          or: () => result([{ id: 'employee-role', tenant_id: identity.tenantId }]),
          in: (_column: string, roleIds: string[]) => {
            if (selection === 'code') return result(roleIds.map(() => ({ code: 'EMPLOYEE' })))
            if (selection === 'id,code,tenant_id') {
              return result(roleIds.map((id) => ({ id, code: 'EMPLOYEE', tenant_id: identity.tenantId })))
            }
            throw new Error(`Unexpected management_roles projection: ${selection}`)
          },
        }
        return builder
      }
      if (table === 'role_permissions') {
        return {
          select: () => ({
            in: (_column: string, roleIds: string[]) => result(roleIds.flatMap((roleId) =>
              roleId === 'employee-role' ? identity.selfPermissions.map((_, index) => ({ permission_id: `self-${index}` })) : [],
            )),
          }),
        }
      }
      if (table === 'permissions') {
        return {
          select: () => ({
            in: () => result(identity.selfPermissions.map((code) => ({ code }))),
          }),
        }
      }
      throw new Error(`Unexpected authorization table: ${table}`)
    },
  }
}

function activeContext(identity: TestIdentity) {
  return {
    tenant: { id: identity.tenantId },
    activeHrGroup: {
      id: identity.hrGroupId,
      tenantId: identity.tenantId,
      employeePortalMode: 'SELF_SERVICE',
      managerPortalMode: 'MANAGER',
      administrations: [{ id: identity.administrationId }],
    },
    activeAdministration: { id: identity.administrationId },
  }
}

function makeArtifacts(employeeId: string, runId: string, employmentId: string): PayrollCalculationArtifacts {
  return {
    run: { id: runId, status: 'SUCCEEDED' },
    inputSet: { input_hash: 'a'.repeat(64) },
    sourceSnapshot: {
      source_employee_id: employeeId,
      source_employment_id: employmentId,
      source_payload: {
        pension: { assignments: [{ arrangement: { id: 'arrangement-1', name: 'Bedrijfspensioen' } }] },
        payrollOwned: { pensionCalculationSummary: { arrangementId: 'arrangement-1', pensionableBase: '46828.00', rate: '15.0000' } },
        confidentialSourceValue: 'must-not-be-returned',
      },
    },
    payrollPeriod: { id: `period-${employeeId}`, period_year: 2026, period_month: 10 },
    componentResults: [
      { component_key: 'gross_salary', amount: 5500, result_payload: { amount: 5500 } },
      { component_key: 'employee_pension', amount: 195.12, result_payload: { amount: 195.12 } },
    ],
    trace: { trace_payload: { rawTraceValue: 'must-not-be-returned' } },
    controls: [],
    goldenCase: null,
  } as unknown as PayrollCalculationArtifacts
}

const runIds = {
  lisa: '30000000-0000-4000-8000-000000000001',
  jaap: '30000000-0000-4000-8000-000000000002',
}
const employmentIds = {
  lisa: '20000000-0000-4000-8000-000000000001',
  jaap: '20000000-0000-4000-8000-000000000002',
}
const fixtureScope = {
  tenantId: identities.lisa.tenantId,
  hrGroupId: identities.lisa.hrGroupId,
  administrationId: identities.lisa.administrationId,
}

function makeDependencies(
  options: { readonly forcedEmployeeId?: string } = {},
) {
  const artifactsByEmployee = new Map<string, PayrollCalculationArtifacts>([
    [identities.lisa.employeeId, makeArtifacts(identities.lisa.employeeId, runIds.lisa, employmentIds.lisa)],
    [identities.jaap.employeeId, makeArtifacts(identities.jaap.employeeId, runIds.jaap, employmentIds.jaap)],
  ])
  const summariesByRun = new Map([...artifactsByEmployee.values()].map((artifacts) => [artifacts.run.id, {
    run: artifacts.run,
    inputSet: artifacts.inputSet,
    sourceSnapshot: artifacts.sourceSnapshot,
    payrollPeriod: artifacts.payrollPeriod,
  } as PayrollRunSummary]))
  const finalizedByRun = new Set([runIds.lisa])
  const scopeMatches = (scope: typeof fixtureScope) => scope.tenantId === fixtureScope.tenantId
    && scope.hrGroupId === fixtureScope.hrGroupId
    && scope.administrationId === fixtureScope.administrationId
  const listPayrollRunSummaries = vi.fn(async (scope: typeof fixtureScope, _administrationId: string, query: { employeeId?: string }) => {
    if (!scopeMatches(scope)) return []
    const selectedEmployeeId = options.forcedEmployeeId ?? query.employeeId
    const artifacts = artifactsByEmployee.get(selectedEmployeeId ?? '')
    const summary = artifacts ? summariesByRun.get(artifacts.run.id) : null
    return summary ? [summary] : []
  })
  const getLatestSyntheticArtifacts = vi.fn(async (scope: typeof fixtureScope, _administrationId: string, _compositionId: string | undefined, runId: string) => {
    if (!scopeMatches(scope)) return null
    return [...artifactsByEmployee.values()].find((artifacts) => artifacts.run.id === runId) ?? null
  })
  const listLifecycleEvents = vi.fn(async (_scope: typeof fixtureScope, _administrationId: string, _periodId: string, employmentId: string) => {
    const runId = employmentId === employmentIds.lisa ? runIds.lisa : runIds.jaap
    return finalizedByRun.has(runId)
      ? [{ calculation_run_id: runId, event_type: 'FINALIZED' }]
      : [{ calculation_run_id: runId, event_type: 'CONCEPT' }]
  })
  const dependencies = {
    requireAuthContext,
    requirePermission,
    isEnabled: () => true,
    createPayrollRepository: () => ({
      getPayrollAdministration: async (scope: typeof fixtureScope) => scopeMatches(scope)
        ? { id: '60000000-0000-4000-8000-000000000001', status: 'ACTIVE', capabilityEnabled: true }
        : null,
    }),
    createCalculationRepository: () => ({ listPayrollRunSummaries, getLatestSyntheticArtifacts }),
    createPayrunRepository: () => ({ listLifecycleEvents }),
  } as unknown as EmployeePayrollDependencies
  return { dependencies, listPayrollRunSummaries, listLifecycleEvents }
}

describe('My Salary authorization with the production permission guard', () => {
  beforeEach(() => {
    activeIdentity = identities.lisa
    createClient.mockReset().mockImplementation(async () => createIdentityClient(activeIdentity))
    loadActiveContext.mockReset().mockImplementation(async (userId: string) => {
      const identity = activeIdentity.userId === userId
        ? activeIdentity
        : Object.values(identities).find((entry) => entry.userId === userId)
      if (!identity) throw new Error('Unknown controlled test identity')
      return activeContext(identity)
    })
  })

  it('allows Lisa to read only Lisa FINALIZED salary even when a client-supplied Jaap id is ignored', async () => {
    const { dependencies, listPayrollRunSummaries } = makeDependencies()
    const callAsClientCouldSupplyId = getMySalaryStatement as unknown as (
      deps: EmployeePayrollDependencies,
      requestedEmployeeId: string,
    ) => ReturnType<typeof getMySalaryStatement>
    const statement = await callAsClientCouldSupplyId(dependencies, identities.jaap.employeeId)

    expect(statement?.components[0]).toEqual({ key: 'gross_salary', amount: 5500 })
    expect(listPayrollRunSummaries).toHaveBeenCalledWith(
      fixtureScope,
      '60000000-0000-4000-8000-000000000001',
      expect.objectContaining({ employeeId: identities.lisa.employeeId, runType: 'INDIVIDUAL_PAYROLL' }),
    )
  })

  it.each([
    ['Lisa', identities.lisa, identities.jaap.employeeId],
    ['Jaap', identities.jaap, identities.lisa.employeeId],
  ] as const)('%s cannot receive another employee’s artifact even if a repository returns it', async (_name, identity, otherEmployeeId) => {
    activeIdentity = identity
    const { dependencies, listPayrollRunSummaries } = makeDependencies({ forcedEmployeeId: otherEmployeeId })

    await expect(getMySalaryStatement(dependencies)).resolves.toBeNull()
    expect(listPayrollRunSummaries).toHaveBeenCalledWith(
      fixtureScope,
      '60000000-0000-4000-8000-000000000001',
      expect.objectContaining({ employeeId: identity.employeeId }),
    )
  })

  it('does not expose Jaap’s own CONCEPT run as an employee salary statement', async () => {
    activeIdentity = identities.jaap
    const { dependencies } = makeDependencies()
    await expect(getMySalaryStatement(dependencies)).resolves.toBeNull()
  })

  it.each([
    ['tenant', { tenantId: '50000000-0000-4000-8000-000000000011' }],
    ['HR group', { hrGroupId: '50000000-0000-4000-8000-000000000012' }],
    ['administration', { administrationId: '50000000-0000-4000-8000-000000000013' }],
  ] as const)('does not return a statement across a mismatched %s scope', async (_scopeName, scopeOverride) => {
    activeIdentity = { ...identities.lisa, ...scopeOverride }
    const { dependencies } = makeDependencies()
    await expect(getMySalaryStatement(dependencies)).resolves.toBeNull()
  })

  it('denies a self-salary request when the authenticated identity lacks self:salary:read', async () => {
    activeIdentity = { ...identities.lisa, selfPermissions: [] }
    const { dependencies, listPayrollRunSummaries } = makeDependencies()
    await expect(getMySalaryStatement(dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    expect(listPayrollRunSummaries).not.toHaveBeenCalled()
  })

  it('returns only the allow-listed finalized projection without hashes, source payload, or trace', async () => {
    const { dependencies } = makeDependencies()
    const statement = await getMySalaryStatement(dependencies)
    const serialized = JSON.stringify(statement)
    expect(serialized).not.toMatch(/input_hash|rawTraceValue|confidentialSourceValue|must-not-be-returned/i)
    expect(statement).toMatchObject({ periodYear: 2026, periodMonth: 10, pensionReadiness: 'CALCULATED' })
  })
})
