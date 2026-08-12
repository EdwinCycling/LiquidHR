import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { createJourneyTemplateService, type JourneyTemplateRepository } from './template-service'
import type { JourneyTemplateDraft } from './domain'

const context: AuthContext = {
  tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: null,
  userId: 'user-a', employeeId: 'employee-a', activeRoles: ['TENANT_ADMIN'], permissions: [],
}

const draft: JourneyTemplateDraft = {
  name: { nl: 'Onboarding', en: 'Onboarding' }, description: { nl: 'Start', en: 'Start' },
  journeyType: 'ONBOARDING', anchorRule: 'EMPLOYMENT_START_DATE',
  phases: [{ key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10 }],
  roles: [{ key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 }],
  moments: [{ key: 'welcome', phaseKey: 'start', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: 0, availabilityOffsetDays: 0, sortOrder: 10 }],
  topics: [],
}

function setup() {
  const repository: JourneyTemplateRepository = {
    list: vi.fn().mockResolvedValue([]), get: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'template-a', draftId: 'draft-a', revision: 1 }),
    save: vi.fn().mockResolvedValue({ id: 'template-a', draftId: 'draft-a', revision: 2 }),
    publish: vi.fn().mockResolvedValue({ id: 'template-a', draftId: 'draft-a', publishedVersionId: 'version-a', versionNumber: 1, revision: 2 }),
    retire: vi.fn().mockResolvedValue(undefined),
  }
  const authorize = vi.fn().mockResolvedValue(context)
  const requireModule = vi.fn().mockResolvedValue(undefined)
  return { repository, authorize, requireModule, service: createJourneyTemplateService({ repository, authorize, requireModule }) }
}

describe('Journey template service authorization', () => {
  it('eist module en readpermission voor de catalogus', async () => {
    const { service, authorize, requireModule } = setup()
    await service.listTemplates()
    expect(authorize).toHaveBeenCalledWith(['journey-template:read', 'journey-template:write', 'journey-template:publish'])
    expect(requireModule).toHaveBeenCalledWith('JOURNEYS')
  })

  it('eist writepermission en gebruikt uitsluitend de actieve tenant en HR-groep bij create', async () => {
    const { service, repository, authorize } = setup()
    await service.createTemplate({ key: 'onboarding', draft })
    expect(authorize).toHaveBeenCalledWith(['journey-template:write'])
    expect(repository.create).toHaveBeenCalledWith('tenant-a', 'group-a', 'onboarding', draft)
  })

  it('publiceert alleen met publishpermission en optimistic revision', async () => {
    const { service, repository, authorize } = setup()
    await service.publishJourneyTemplate('draft-a', 2)
    expect(authorize).toHaveBeenCalledWith(['journey-template:publish'])
    expect(repository.publish).toHaveBeenCalledWith('draft-a', 2)
  })

  it('stopt ongeldige templates vóór de repositorywrite', async () => {
    const { service, repository } = setup()
    await expect(service.saveTemplate('draft-a', 1, { ...draft, moments: [] })).rejects.toMatchObject({ code: 'JOURNEY_TEMPLATE_INVALID', status: 422 })
    expect(repository.save).not.toHaveBeenCalled()
  })
})
