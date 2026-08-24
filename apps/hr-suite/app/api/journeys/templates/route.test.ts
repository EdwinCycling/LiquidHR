import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JourneyTemplateDraft } from '@/lib/journeys'
import { JourneyTemplateServiceError } from '@/lib/journeys/template-service'

const { listTemplates, createTemplate } = vi.hoisted(() => ({ listTemplates: vi.fn(), createTemplate: vi.fn() }))
vi.mock('@/lib/journeys', () => ({ journeyTemplates: { listTemplates, createTemplate } }))

import { GET, POST } from './route'

const draft: JourneyTemplateDraft = {
  name: { nl: 'R4 catalogus', en: 'R4 catalog' },
  description: { nl: 'Catalogustest', en: 'Catalog test' },
  journeyType: 'ONBOARDING',
  anchorRule: 'EMPLOYMENT_START_DATE',
  phases: [{ key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10 }],
  roles: [{ key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 }],
  moments: [{ key: 'welcome', phaseKey: 'start', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: 0, availabilityOffsetDays: 0, sortOrder: 10 }],
  topics: [],
}

describe('Journey template catalog API', () => {
  beforeEach(() => {
    listTemplates.mockResolvedValue([])
    createTemplate.mockResolvedValue({ id: 'b4b241c2-6955-46f9-9ca0-c2c370533ade', draftId: 'fd3f6020-a7df-af87-7d4d-d611c6b906a3', revision: 1 })
  })

  it('returns the catalog response for an authenticated read', async () => {
    const catalog = [{ id: 'template-a', key: 'onboarding', lifecycle: 'DRAFT' }]
    listTemplates.mockResolvedValue(catalog)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: catalog })
  })

  it('preserves the create API contract and returns the created id', async () => {
    const request = new Request('http://localhost/api/journeys/templates', {
      body: JSON.stringify({ key: 'r4_jny_cat_test', draft }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: { id: 'b4b241c2-6955-46f9-9ca0-c2c370533ade', draftId: 'fd3f6020-a7df-af87-7d4d-d611c6b906a3', revision: 1 } })
    expect(createTemplate).toHaveBeenCalledWith({ key: 'r4_jny_cat_test', draft })
  })

  it('rejects invalid keys before the service is called', async () => {
    const response = await POST(new Request('http://localhost', {
      body: JSON.stringify({ key: 'Invalid key', draft }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'JOURNEY_TEMPLATE_INPUT_INVALID' })
    expect(createTemplate).not.toHaveBeenCalled()
  })

  it('passes through duplicate-key conflicts', async () => {
    createTemplate.mockRejectedValue(new JourneyTemplateServiceError('JOURNEY_TEMPLATE_KEY_CONFLICT', 409))

    const response = await POST(new Request('http://localhost', {
      body: JSON.stringify({ key: 'r4_jny_cat_duplicate', draft }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }))

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'JOURNEY_TEMPLATE_KEY_CONFLICT' })
  })
})
