import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  assignEmploymentPensionArrangement,
  createPensionArrangementSuccessor,
  EmploymentPensionArrangementError,
} from './pension-arrangement-service'
import {
  SYNTHETIC_PENSION_FIXTURE_CLAIM,
  SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM,
} from './pension-arrangement-policy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  hrGroup: '20000000-0000-4000-8000-000000000001',
  administration: '30000000-0000-4000-8000-000000000001',
  employee: '40000000-0000-4000-8000-000000000001',
  employment: '50000000-0000-4000-8000-000000000001',
  arrangement: '60000000-0000-4000-8000-000000000001',
  request: '70000000-0000-4000-8000-000000000001',
  mapping: '80000000-0000-4000-8000-000000000001',
  assignment: '90000000-0000-4000-8000-000000000001',
}

const managerContext: AuthContext = {
  tenantId: ids.tenant,
  hrGroupId: ids.hrGroup,
  administrationId: ids.administration,
  userId: 'a0000000-0000-4000-8000-000000000001',
  employeeId: null,
  activeRoles: ['HR_ADMIN'],
  permissions: ['pension:manage'],
}

function assignmentInput(overrides: Partial<Parameters<typeof assignEmploymentPensionArrangement>[0]> = {}) {
  return {
    employeeId: ids.employee,
    employmentId: ids.employment,
    arrangementId: ids.arrangement,
    participationStartDate: '2026-09-01',
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    participantGroup: 'NEW_ENTRANT' as const,
    confirmMapping: true,
    requestKey: ids.request,
    provenance: { status: 'USER_RECORDED' as const },
    ...overrides,
  }
}

function configureClient(options: {
  readonly employment?: Record<string, unknown> | null
  readonly predecessorVersionId?: string
  readonly appMetadata?: Record<string, unknown>
  readonly rpcResult?: unknown
} = {}) {
  let currentTable = ''
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: currentTable === 'pension_arrangement_versions'
        ? { id: options.predecessorVersionId ?? 'b0000000-0000-4000-8000-000000000001' }
        : options.employment === undefined
          ? { id: ids.employment, employee_id: ids.employee }
          : options.employment,
      error: null,
    })),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  const rpc = vi.fn(async () => ({
    data: options.rpcResult ?? {
      assignment_id: ids.assignment,
      mapping_id: ids.mapping,
      assignment_version: 1,
      mapping_version: 1,
      assignment_reused: false,
      mapping_reused: false,
    },
    error: null,
  }))
  const client = {
    from: vi.fn((table: string) => {
      currentTable = table
      return query
    }),
    rpc,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { app_metadata: options.appMetadata ?? {} } },
        error: null,
      })),
    },
  }
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { client, query, rpc }
}

describe('assignEmploymentPensionArrangement', () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockResolvedValue(managerContext)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('writes one explicit, scoped assignment and mapping through the authorized RPC', async () => {
    const { client, query, rpc } = configureClient()

    const result = await assignEmploymentPensionArrangement(assignmentInput())

    expect(requirePermission).toHaveBeenCalledWith('pension:manage', ids.employee)
    expect(client.from).toHaveBeenCalledWith('employments')
    expect(query.eq.mock.calls).toEqual(expect.arrayContaining([
      ['id', ids.employment],
      ['employee_id', ids.employee],
      ['tenant_id', ids.tenant],
      ['hr_group_id', ids.hrGroup],
      ['administration_id', ids.administration],
    ]))
    expect(rpc).toHaveBeenCalledWith('apply_employment_pension_arrangement', {
      p_input: expect.objectContaining({
        employee_id: ids.employee,
        employment_id: ids.employment,
        arrangement_id: ids.arrangement,
        request_key: ids.request,
        effective_from: '2026-09-01',
        effective_to: null,
        confirm_mapping: true,
        provenance_json: expect.objectContaining({ status: 'USER_RECORDED' }),
      }),
    })
    expect(result).toEqual({
      assignmentId: ids.assignment,
      mappingId: ids.mapping,
      assignmentVersion: 1,
      mappingVersion: 1,
      assignmentReused: false,
      mappingReused: false,
    })
  })

  it('rejects a missing mapping confirmation before authorization or write', async () => {
    const { rpc } = configureClient()

    await expect(assignEmploymentPensionArrangement(assignmentInput({ confirmMapping: false })))
      .rejects.toMatchObject({ code: 'PENSION_ASSIGNMENT_INPUT_INVALID', status: 400 })

    expect(requirePermission).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not write when the target employment is outside the authorized scope or missing', async () => {
    configureClient({ employment: null })

    await expect(assignEmploymentPensionArrangement(assignmentInput()))
      .rejects.toMatchObject({ code: 'EMPLOYMENT_NOT_FOUND', status: 404 })
  })

  it('requires an HR Admin role even if a broader permission check returns another role', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ ...managerContext, activeRoles: ['HR_MANAGER'] })
    const { rpc } = configureClient()

    await expect(assignEmploymentPensionArrangement(assignmentInput()))
      .rejects.toMatchObject({ code: 'PENSION_ASSIGNMENT_FORBIDDEN', status: 403 })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('denies Employee callers before the pension assignment RPC', async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      ...managerContext,
      employeeId: ids.employee,
      activeRoles: ['EMPLOYEE'],
    })
    const { rpc } = configureClient()

    await expect(assignEmploymentPensionArrangement(assignmentInput()))
      .rejects.toMatchObject({ code: 'PENSION_ASSIGNMENT_FORBIDDEN', status: 403 })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires both the explicit non-production flag and trusted matching app-metadata claims', async () => {
    vi.stubEnv('PENSION_TEST_FIXTURES_ENABLED', 'true')
    vi.stubEnv('LIQUIDHR_RUNTIME_ENV', 'test')
    const { client, rpc } = configureClient()

    await expect(assignEmploymentPensionArrangement(assignmentInput({
      provenance: { status: 'SYNTHETIC_TEST_FIXTURE', scenario: 'PAY-RULE-002 — FRITS_PFZW_2026' },
    }))).rejects.toMatchObject({ code: 'PENSION_TEST_FIXTURE_DISABLED', status: 403 })

    expect(client.auth.getUser).toHaveBeenCalledOnce()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('records explicit synthetic TEST provenance when both runtime and trusted claims match', async () => {
    vi.stubEnv('PENSION_TEST_FIXTURES_ENABLED', 'true')
    vi.stubEnv('LIQUIDHR_RUNTIME_ENV', 'test')
    const { client, rpc } = configureClient({ appMetadata: {
      [SYNTHETIC_PENSION_FIXTURE_CLAIM]: true,
      [SYNTHETIC_PENSION_FIXTURE_ENVIRONMENT_CLAIM]: 'test',
    } })

    await assignEmploymentPensionArrangement(assignmentInput({
      provenance: { status: 'SYNTHETIC_TEST_FIXTURE', scenario: 'PAY-RULE-002 — FRITS_PFZW_2026' },
    }))

    expect(client.auth.getUser).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('apply_employment_pension_arrangement', {
      p_input: expect.objectContaining({
        provenance_json: expect.objectContaining({
          status: 'SYNTHETIC_TEST_FIXTURE',
          sourceClassification: 'SYNTHETIC_TEST_FIXTURE — PAY-RULE-002 — FRITS_PFZW_2026',
        }),
      }),
    })
  })

  it('fails closed on malformed RPC readback instead of returning a partial assignment', async () => {
    configureClient({ rpcResult: { assignment_id: ids.assignment, mapping_id: null } })

    await expect(assignEmploymentPensionArrangement(assignmentInput()))
      .rejects.toMatchObject({
        code: 'PENSION_ASSIGNMENT_WRITE_READBACK_INVALID',
        status: 500,
      } satisfies Partial<EmploymentPensionArrangementError>)
  })
})

describe('createPensionArrangementSuccessor', () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockResolvedValue(managerContext)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('uses the pension manager permission and preserves employment scope for the successor RPC', async () => {
    const predecessorVersionId = 'b0000000-0000-4000-8000-000000000001'
    const successorVersionId = 'c0000000-0000-4000-8000-000000000001'
    const successor = { effective_from: '2026-01-01', pensionable_salary_definition: { method: 'PFZW_2026_KINDEROPVANG' } }
    const { client, query, rpc } = configureClient({ rpcResult: successorVersionId, predecessorVersionId })

    const result = await createPensionArrangementSuccessor({
      employeeId: ids.employee,
      employmentId: ids.employment,
      predecessorVersionId,
      successor,
    })

    expect(requirePermission).toHaveBeenCalledWith('pension:manage', ids.employee)
    expect(client.from).toHaveBeenCalledWith('employments')
    expect(client.from).toHaveBeenCalledWith('pension_arrangement_versions')
    expect(query.eq.mock.calls).toEqual(expect.arrayContaining([
      ['id', ids.employment],
      ['id', predecessorVersionId],
      ['employee_id', ids.employee],
      ['tenant_id', ids.tenant],
      ['hr_group_id', ids.hrGroup],
      ['administration_id', ids.administration],
    ]))
    expect(rpc).toHaveBeenCalledWith('create_pension_arrangement_successor', {
      p_predecessor_version_id: predecessorVersionId,
      p_successor: successor,
    })
    expect(result).toEqual({ versionId: successorVersionId })
  })
})
