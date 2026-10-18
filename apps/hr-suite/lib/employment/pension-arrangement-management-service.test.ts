import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  createPensionArrangement,
  createPensionArrangementSuccessorForPensionManager,
  PensionArrangementManagementError,
} from './pension-arrangement-management-service'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  hrGroup: '20000000-0000-4000-8000-000000000001',
  administration: '30000000-0000-4000-8000-000000000001',
  arrangement: '60000000-0000-4000-8000-000000000001',
  version: '70000000-0000-4000-8000-000000000001',
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

const input = {
  code: 'PFZW-2026',
  name: 'PFZW Kinderopvang 2026',
  arrangementType: 'FLAT_PREMIUM' as const,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  transitionDate: null,
  grandfatheringMode: 'NONE' as const,
  flatTotalRate: 20,
  employeeSharePct: 40,
  employerSharePct: 60,
  annualFranchise: 15000,
  annualPensionableSalaryCap: null,
  provider: 'PFZW',
  sourceReference: 'https://example.test/pfzw-2026',
  sourceValidationStatus: 'EMPLOYER_RECORDED' as const,
  pensionableSalaryMethod: 'Defined by the recorded fund source.',
  partTimeMethod: 'Pro rata by contractual hours.',
  partMonthMethod: 'Explicit scheme day method recorded by HR Admin.',
  eligibilityRule: 'Participation follows the recorded employment conditions.',
  contractClassification: 'UNKNOWN' as const,
  contractClassificationSourceReference: '',
  contractClassificationStatus: 'UNVERIFIED' as const,
  tiers: [],
}

function configureClient(options: { readonly rpcData?: unknown; readonly predecessor?: object | null } = {}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: options.predecessor === undefined ? { id: ids.version } : options.predecessor,
      error: null,
    })),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  const rpc = vi.fn(async () => ({
    data: options.rpcData ?? {
      arrangement_id: ids.arrangement,
      version_id: ids.version,
      version_number: 1,
    },
    error: null,
  }))
  const client = {
    from: vi.fn(() => query),
    rpc,
  }
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { client, query, rpc }
}

describe('pension arrangement management', () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockResolvedValue(managerContext)
  })

  afterEach(() => vi.clearAllMocks())

  it('stores a scoped arrangement and its initial version through the atomic Core RPC', async () => {
    const { rpc } = configureClient()

    await expect(createPensionArrangement(input)).resolves.toEqual({
      arrangementId: ids.arrangement,
      versionId: ids.version,
      versionNumber: 1,
    })

    expect(requirePermission).toHaveBeenCalledWith('pension:manage')
    expect(rpc).toHaveBeenCalledWith('create_pension_arrangement', {
      p_input: expect.objectContaining({
        tenant_id: ids.tenant,
        hr_group_id: ids.hrGroup,
        administration_id: ids.administration,
        code: 'PFZW-2026',
        effective_from: '2026-01-01',
        contract_classification: 'UNKNOWN',
        pensionable_salary_definition: expect.objectContaining({
          provider: 'PFZW',
          partMonthMethod: 'Explicit scheme day method recorded by HR Admin.',
        }),
        tiers: [],
      }),
    })
  })

  it('rejects an invalid premium split before authorization or write', async () => {
    const { rpc } = configureClient()

    await expect(createPensionArrangement({ ...input, employeeSharePct: 41 }))
      .rejects.toMatchObject({ code: 'PENSION_ARRANGEMENT_INPUT_INVALID', status: 400 } satisfies Partial<PensionArrangementManagementError>)

    expect(requirePermission).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires an HR Admin or Tenant Admin role in addition to the permission', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ ...managerContext, activeRoles: ['HR_MANAGER'] })
    const { rpc } = configureClient()

    await expect(createPensionArrangement(input))
      .rejects.toMatchObject({ code: 'PENSION_ARRANGEMENT_FORBIDDEN', status: 403 })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('uses the scoped pension-manager successor wrapper and validates readback', async () => {
    const { rpc, query } = configureClient({ rpcData: ids.version })

    await expect(createPensionArrangementSuccessorForPensionManager({
      predecessorVersionId: ids.version,
      successor: {
        effective_from: '2027-01-01',
        effective_to: null,
        arrangement_type: 'FLAT_PREMIUM',
        grandfathering_mode: 'NONE',
        flat_total_rate: 20,
        employer_share_pct: 60,
        employee_share_pct: 40,
        annual_franchise: 15000,
        annual_pensionable_salary_cap: null,
        pensionable_salary_definition: {},
        eligibility_rule: {},
        contract_classification: 'UNKNOWN',
        contract_classification_provenance: { status: 'UNVERIFIED' },
        provenance_json: { status: 'USER_RECORDED' },
        supersession_reason: 'Annual source update.',
        supersession_provenance: { status: 'USER_RECORDED' },
        tiers: [],
      },
    })).resolves.toEqual({ versionId: ids.version })

    expect(query.eq.mock.calls).toEqual(expect.arrayContaining([
      ['tenant_id', ids.tenant],
      ['hr_group_id', ids.hrGroup],
      ['administration_id', ids.administration],
    ]))
    expect(rpc).toHaveBeenCalledWith('create_pension_arrangement_successor', expect.any(Object))
  })

  it('fails closed when the scoped predecessor is not readable', async () => {
    const { rpc } = configureClient({ predecessor: null })

    await expect(createPensionArrangementSuccessorForPensionManager({
      predecessorVersionId: ids.version,
      successor: {},
    })).rejects.toMatchObject({ code: 'PENSION_ARRANGEMENT_PREDECESSOR_NOT_FOUND', status: 404 })

    expect(rpc).not.toHaveBeenCalled()
  })
})
