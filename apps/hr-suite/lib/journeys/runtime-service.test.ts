import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { createJourneyRuntimeService, JourneyRuntimeServiceError, type JourneyRuntimeRepository } from './runtime-service'
import type { JourneyActivationTemplate } from './runtime-domain'

const context: AuthContext = { tenantId: 'tenant', hrGroupId: 'group', administrationId: null, userId: 'user', employeeId: 'actor', activeRoles: ['HR_ADMIN'], permissions: ['journey:read', 'journey:write'] }
const template: JourneyActivationTemplate = {
  templateId: '10000000-0000-4000-8000-000000000001', templateVersionId: '10000000-0000-4000-8000-000000000002', templateVersionNumber: 1,
  name: { nl: 'Onboarding', en: 'Onboarding' }, description: { nl: 'Start', en: 'Start' }, journeyType: 'ONBOARDING', anchorRule: 'MANUAL_DATE',
  phases: [{ key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10 }],
  roles: [{ key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 }],
  moments: [{ key: 'day-one', phaseKey: 'start', name: { nl: 'Dag één', en: 'Day one' }, dateOffsetDays: 0, availabilityOffsetDays: -1, sortOrder: 10 }], topics: [],
}

function repository(overrides: Partial<JourneyRuntimeRepository> = {}): JourneyRuntimeRepository {
  return {
    listStartOptions: vi.fn().mockResolvedValue({ templates: [], employees: [], employments: [] }),
    getActivationTemplate: vi.fn().mockResolvedValue(template),
    resolveParticipants: vi.fn().mockResolvedValue({ targetEmployeeName: 'Noah Hendriks', resolutions: [{ roleKey: 'employee', status: 'RESOLVED', employees: [{ employeeId: '20000000-0000-4000-8000-000000000001', name: 'Noah Hendriks', source: 'TARGET_EMPLOYEE' }] }] }),
    activate: vi.fn().mockResolvedValue({ id: '30000000-0000-4000-8000-000000000001', version: 1, idempotentReplay: false }),
    list: vi.fn().mockResolvedValue([]), get: vi.fn().mockResolvedValue(null), transition: vi.fn(), replaceParticipant: vi.fn(),
    ...overrides,
  }
}

describe('Journey runtime service', () => {
  it('maakt een preview zonder activate aan te roepen', async () => {
    const repo = repository()
    const service = createJourneyRuntimeService({ repository: repo, authorize: vi.fn().mockResolvedValue(context), requireModule: vi.fn() })
    const preview = await service.preview({ templateVersionId: template.templateVersionId, targetEmployeeId: '20000000-0000-4000-8000-000000000001', employmentId: null, anchorDate: '2026-09-01', manualParticipants: {} })
    expect(preview.canActivate).toBe(true)
    expect(preview.moments[0]?.availableOn).toBe('2026-08-31')
    expect(repo.activate).not.toHaveBeenCalled()
  })

  it('weigert activatie als de serverpreview een required issue bevat', async () => {
    const repo = repository({ resolveParticipants: vi.fn().mockResolvedValue({ targetEmployeeName: 'Noah Hendriks', resolutions: [{ roleKey: 'employee', status: 'MISSING', blocking: true, employees: [] }] }) })
    const service = createJourneyRuntimeService({ repository: repo, authorize: vi.fn().mockResolvedValue(context), requireModule: vi.fn() })
    await expect(service.activate({ templateVersionId: template.templateVersionId, targetEmployeeId: '20000000-0000-4000-8000-000000000001', employmentId: null, anchorDate: '2026-09-01', manualParticipants: {}, idempotencyKey: 'journey-request-001' })).rejects.toMatchObject({ code: 'JOURNEY_ACTIVATION_BLOCKED' } satisfies Partial<JourneyRuntimeServiceError>)
    expect(repo.activate).not.toHaveBeenCalled()
  })

  it('geeft de idempotente replay uit de transactionele schrijfweg door', async () => {
    const repo = repository({ activate: vi.fn().mockResolvedValue({ id: '30000000-0000-4000-8000-000000000001', version: 1, idempotentReplay: true }) })
    const service = createJourneyRuntimeService({ repository: repo, authorize: vi.fn().mockResolvedValue(context), requireModule: vi.fn() })
    const result = await service.activate({ templateVersionId: template.templateVersionId, targetEmployeeId: '20000000-0000-4000-8000-000000000001', employmentId: null, anchorDate: '2026-09-01', manualParticipants: {}, idempotencyKey: 'journey-request-001' })
    expect(result.idempotentReplay).toBe(true)
  })
})
